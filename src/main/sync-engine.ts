import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { FileSystem } from './file-system';
import { YandexDiskApi, isDiskNotFoundError } from './yandex-disk-api';
import { SyncStateStore } from './sync-state';
import { YANDEX_CLOUD_ROOT, type SyncStatus } from '../shared/yandex';
import type { DiskResource } from '../shared/yandex';
import {
  isSyncableRelativePath,
  isYandexConflictPath,
  type FileSyncStatusMap,
} from '../shared/sync';
import type { SyncFailedOp } from '../shared/sync';
import { ARCHIVE_FOLDER } from '../shared/archive';
import {
  VAULT_INIT_MARKER,
  VAULT_LEGACY_MARKERS,
} from '../shared/vault';
import { getLocalVaultPath } from './auth-store';
import { mapPool } from './async-pool';
import type { SyncStateData } from '../shared/sync';
import { resolveSyncDirection } from '../shared/sync-resolve';

const MAX_PENDING_RETRIES = 5;
const SYNC_FILE_CONCURRENCY = 5;
const LOCAL_META_CONCURRENCY = 8;

interface LocalFileMeta {
  md5: string;
  mtimeMs: number;
  size: number;
}

type SyncWorkItem =
  | { action: 'download'; relative: string; cloudFile: DiskResource }
  | { action: 'upload'; relative: string; local: LocalFileMeta }
  | { action: 'conflict'; relative: string; local: LocalFileMeta; cloudFile: DiskResource };

function contentMd5(content: string): string {
  return crypto.createHash('md5').update(content.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

function filterCloudFile(file: DiskResource): boolean {
  const relative = YandexDiskApi.toRelativePath(file.path);
  return isSyncableRelativePath(relative) && !isYandexConflictPath(relative);
}

export class SyncEngine {
  private api = new YandexDiskApi();
  private localRoot: string;
  private stateStore: SyncStateStore;
  private syncing = false;
  private lastSync: string | null = null;
  private lastError: string | null = null;
  private pendingCount = 0;
  private failedCount = 0;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private onStatus?: (message: string) => void;
  private autoSyncEnabled: () => boolean = () => false;
  private syncProgress = 0;
  private syncProgressLabel = '';

  constructor(onStatus?: (message: string) => void) {
    this.localRoot = getLocalVaultPath();
    this.stateStore = new SyncStateStore(this.localRoot);
    this.onStatus = onStatus;
    void this.stateStore.load().then(async (state) => {
      await this.sanitizeSyncQueue(state);
      await this.stateStore.save(state);
      this.pendingCount = this.stateStore.pendingCount(state);
      this.failedCount = this.stateStore.failedCount(state);
    });
  }

  getStatus(): SyncStatus {
    return {
      syncing: this.syncing,
      lastSync: this.lastSync,
      error: this.lastError,
      pendingCount: this.pendingCount,
      failedCount: this.failedCount,
      progress: this.syncing ? this.syncProgress : undefined,
      progressLabel: this.syncing ? this.syncProgressLabel : undefined,
    };
  }

  /** Статус синхронизации по каждому локальному файлу */
  async getFileSyncStatuses(extraPendingPaths: string[] = []): Promise<FileSyncStatusMap> {
    const state = await this.stateStore.load();
    const pending = new Set(
      state.pending.filter((p) => p.retries < MAX_PENDING_RETRIES).map((p) => p.path.replace(/\\/g, '/'))
    );
    const failed = new Set(
      (state.failed ?? []).map((f) => f.path.replace(/\\/g, '/'))
    );
    for (const path of extraPendingPaths) {
      pending.add(path.replace(/\\/g, '/'));
    }

    const localMap = await this.listLocalSyncableFiles(state);
    const result: FileSyncStatusMap = {};

    for (const [rel, info] of localMap) {
      if (failed.has(rel)) {
        result[rel] = 'failed';
        continue;
      }
      if (pending.has(rel)) {
        result[rel] = 'pending';
        continue;
      }
      const prev = state.files[rel];
      if (!prev?.lastSyncedAt || (prev.localMd5 && prev.localMd5 !== info.md5)) {
        result[rel] = 'pending';
      } else {
        result[rel] = 'synced';
      }
    }

    return result;
  }

  async getFailedOps(): Promise<SyncFailedOp[]> {
    const state = await this.stateStore.load();
    return state.failed ?? [];
  }

  reportProgress(progress: number, label: string): void {
    this.syncProgress = Math.min(100, Math.max(0, Math.round(progress)));
    this.syncProgressLabel = label;
  }

  /** Полная синхронизация с подготовительным шагом (ручная кнопка) */
  async runPullSync(preamble: () => Promise<void>): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    this.reportProgress(0, 'Подготовка...');
    try {
      await preamble();
      await this.syncFilesCore(8);
      this.reportProgress(100, 'Синхронизировано');
    } catch (err) {
      this.lastError = String(err);
      this.status(`Ошибка синхронизации: ${err}`);
      throw err;
    } finally {
      this.syncing = false;
      this.syncProgress = 0;
      this.syncProgressLabel = '';
    }
  }

  getLocalRoot(): string {
    return this.localRoot;
  }

  bindAutoSync(getter: () => boolean): void {
    this.autoSyncEnabled = getter;
  }

  private async queueUpload(relativePath: string): Promise<void> {
    const norm = relativePath.replace(/\\/g, '/');
    const state = await this.stateStore.load();
    this.stateStore.enqueueUpload(state, norm);
    await this.stateStore.save(state);
    this.pendingCount = this.stateStore.pendingCount(state);
    if (this.pendingCount > 0) {
      this.status(`Ожидает синхронизации: ${this.pendingCount}`);
    }
  }

  private async queueDelete(relativePath: string): Promise<void> {
    const norm = relativePath.replace(/\\/g, '/');
    const state = await this.stateStore.load();
    this.stateStore.enqueueDelete(state, norm);
    await this.stateStore.save(state);
    this.pendingCount = this.stateStore.pendingCount(state);
    if (this.pendingCount > 0) {
      this.status(`Ожидает синхронизации: ${this.pendingCount}`);
    }
  }

  /** Загрузить файл в облако или поставить в очередь (зависит от autoSync) */
  async pushFileOrQueue(relativePath: string, content: string): Promise<void> {
    if (this.autoSyncEnabled()) {
      await this.pushFile(relativePath, content);
    } else {
      await this.queueUpload(relativePath);
    }
  }

  async pushDeleteOrQueue(relativePath: string): Promise<void> {
    if (this.autoSyncEnabled()) {
      await this.pushDelete(relativePath);
    } else {
      await this.queueDelete(relativePath);
    }
  }

  async pushRenameOrQueue(oldPath: string, newPath: string): Promise<void> {
    if (this.autoSyncEnabled()) {
      await this.pushRename(oldPath, newPath);
      return;
    }
    const state = await this.stateStore.load();
    const fromNorm = oldPath.replace(/\\/g, '/');
    const toNorm = newPath.replace(/\\/g, '/');
    const toIsDir = await this.isLocalDirectory(toNorm);
    const fromIsDir = await this.isLocalDirectory(fromNorm);

    this.stateStore.enqueueDelete(state, fromNorm);

    if (toIsDir) {
      const files = await this.collectSyncableFilesUnder(toNorm);
      for (const file of files) {
        this.stateStore.enqueueUpload(state, file);
      }
    } else if (!fromIsDir && isSyncableRelativePath(toNorm)) {
      this.stateStore.enqueueUpload(state, toNorm);
    }

    await this.stateStore.save(state);
    this.pendingCount = this.stateStore.pendingCount(state);
    if (this.pendingCount > 0) {
      this.status(`Ожидает синхронизации: ${this.pendingCount}`);
    }
  }

  async pushFolderOrQueue(relativePath: string): Promise<void> {
    if (this.autoSyncEnabled()) {
      await this.pushFolder(relativePath);
    }
    // в ручном режиме папка создастся при загрузке файлов
  }

  async clearArchiveRemoteOrQueue(): Promise<void> {
    await this.clearArchiveRemote();
  }

  private purgeArchiveFromSyncState(state: Awaited<ReturnType<SyncStateStore['load']>>): void {
    for (const key of Object.keys(state.files)) {
      if (key === ARCHIVE_FOLDER || key.startsWith(`${ARCHIVE_FOLDER}/`)) {
        this.stateStore.removeFileState(state, key);
      }
    }
    state.pending = state.pending.filter(
      (p) => p.path !== ARCHIVE_FOLDER && !p.path.startsWith(`${ARCHIVE_FOLDER}/`)
    );
  }

  private async applyArchiveCloudClear(): Promise<void> {
    await this.pushDeleteFolder(ARCHIVE_FOLDER);
    await this.pushFolder(ARCHIVE_FOLDER);
  }

  private async queueArchiveCloudClear(state: Awaited<ReturnType<SyncStateStore['load']>>): Promise<void> {
    this.stateStore.enqueueDelete(state, ARCHIVE_FOLDER);
    await this.stateStore.save(state);
    this.pendingCount = this.stateStore.pendingCount(state);
    if (this.pendingCount > 0) {
      this.status(`Ожидает синхронизации: ${this.pendingCount}`);
    }
  }

  private status(msg: string): void {
    this.onStatus?.(msg);
  }

  private async isLocalDirectory(relativePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path.join(this.localRoot, relativePath));
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private async collectSyncableFilesUnder(relativeDir: string): Promise<string[]> {
    const paths: string[] = [];
    await this.walkLocalPaths(relativeDir.replace(/\\/g, '/'), paths);
    return paths;
  }

  /** Разворачивает upload папок в upload файлов; чистит битые записи */
  private async sanitizeSyncQueue(state: SyncStateData): Promise<void> {
    const newPending: SyncPendingOp[] = [];

    for (const op of state.pending) {
      if (op.op === 'delete') {
        newPending.push(op);
        continue;
      }
      const targets = await this.resolveUploadTargets(op.path);
      if (targets.length === 0) continue;
      const norm = op.path.replace(/\\/g, '/');
      if (targets.length === 1 && targets[0] === norm) {
        newPending.push(op);
      } else {
        for (const file of targets) {
          newPending.push({
            op: 'upload',
            path: file,
            retries: op.retries,
            at: op.at,
          });
        }
      }
    }
    state.pending = this.dedupePendingOps(newPending);

    if (!state.failed?.length) return;

    const remainingFailed: SyncFailedOp[] = [];
    for (const item of state.failed) {
      if (item.op === 'delete') {
        remainingFailed.push(item);
        continue;
      }
      const targets = await this.resolveUploadTargets(item.path);
      if (targets.length === 0) continue;
      for (const file of targets) {
        this.stateStore.enqueueUpload(state, file);
      }
    }
    state.failed = remainingFailed;
    state.pending = this.dedupePendingOps(state.pending);
  }

  private dedupePendingOps(ops: SyncPendingOp[]): SyncPendingOp[] {
    const seen = new Set<string>();
    const result: SyncPendingOp[] = [];
    for (const op of ops) {
      const key = `${op.op}:${op.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(op);
    }
    return result;
  }

  private async resolveUploadTargets(relativePath: string): Promise<string[]> {
    const norm = relativePath.replace(/\\/g, '/');
    const full = path.join(this.localRoot, norm);
    try {
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        return this.collectSyncableFilesUnder(norm);
      }
      if (stat.isFile() && isSyncableRelativePath(norm)) {
        return [norm];
      }
    } catch {
      return [];
    }
    return [];
  }

  private async readLocalMeta(
    relativePath: string,
    state: SyncStateData
  ): Promise<LocalFileMeta | null> {
    const localPath = path.join(this.localRoot, relativePath);
    try {
      const stat = await fs.stat(localPath);
      const prev = state.files[relativePath];
      if (
        prev?.localMd5 &&
        prev.localMtimeMs === stat.mtimeMs &&
        prev.localSize === stat.size
      ) {
        return {
          md5: prev.localMd5,
          mtimeMs: stat.mtimeMs,
          size: stat.size,
        };
      }

      const content = await fs.readFile(localPath, 'utf-8');
      return {
        md5: contentMd5(content),
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      };
    } catch {
      return null;
    }
  }

  private async collectLocalSyncablePaths(): Promise<string[]> {
    const paths: string[] = [];
    await this.walkLocalPaths('', paths);
    return paths;
  }

  private async walkLocalPaths(relativeDir: string, paths: string[]): Promise<void> {
    const dirPath = path.join(this.localRoot, relativeDir);
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const rel = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const norm = rel.replace(/\\/g, '/');

      if (entry.isDirectory()) {
        await this.walkLocalPaths(norm, paths);
        continue;
      }

      if (isSyncableRelativePath(norm)) {
        paths.push(norm);
      }
    }
  }

  private async listLocalSyncableFiles(
    state: SyncStateData
  ): Promise<Map<string, LocalFileMeta>> {
    const paths = await this.collectLocalSyncablePaths();
    const metas = await mapPool(
      paths,
      async (relative) => {
        const meta = await this.readLocalMeta(relative, state);
        return meta ? ([relative, meta] as const) : null;
      },
      LOCAL_META_CONCURRENCY
    );

    const files = new Map<string, LocalFileMeta>();
    for (const entry of metas) {
      if (entry) files.set(entry[0], entry[1]);
    }
    return files;
  }

  private async processPending(state: Awaited<ReturnType<SyncStateStore['load']>>): Promise<void> {
    await this.sanitizeSyncQueue(state);
    const remaining = state.pending.filter((op) => op.retries < MAX_PENDING_RETRIES);
    if (remaining.length === 0) return;

    await mapPool(
      remaining,
      async (op) => {
        try {
          if (op.op === 'upload') {
            const localPath = path.join(this.localRoot, op.path);
            const stat = await fs.stat(localPath);
            if (stat.isDirectory()) {
              this.stateStore.clearPendingForPath(state, op.path);
              const files = await this.collectSyncableFilesUnder(op.path);
              for (const file of files) {
                this.stateStore.enqueueUpload(state, file);
              }
              return { ok: false as const, op };
            }
            const content = await fs.readFile(localPath, 'utf-8');
            await this.api.uploadText(YandexDiskApi.toCloudPath(op.path), content);
            const meta = await this.readLocalMeta(op.path, state);
            if (meta) {
              this.stateStore.markSynced(
                state,
                op.path,
                meta.md5,
                meta.md5,
                undefined,
                meta.mtimeMs,
                meta.size
              );
            }
            return { ok: true as const, op };
          }
          if (op.op === 'delete') {
            const norm = op.path.replace(/\\/g, '/');
            if (norm === ARCHIVE_FOLDER) {
              await this.applyArchiveCloudClear();
              this.purgeArchiveFromSyncState(state);
            } else {
              await this.pushDelete(norm);
              this.stateStore.removeFileState(state, norm);
            }
            this.stateStore.clearPendingForPath(state, op.path);
            return { ok: true as const, op };
          }
        } catch (err) {
          this.stateStore.bumpRetry(state, op);
          if (op.retries >= MAX_PENDING_RETRIES) {
            this.stateStore.markFailed(state, op, String(err));
          }
        }
        return { ok: false as const, op };
      },
      SYNC_FILE_CONCURRENCY
    );

    state.pending = state.pending.filter((p) => p.retries < MAX_PENDING_RETRIES);
    this.pendingCount = this.stateStore.pendingCount(state);
    this.failedCount = this.stateStore.failedCount(state);
  }

  /** Повторить неудачные операции из очереди */
  async retryFailed(paths?: string[]): Promise<number> {
    const state = await this.stateStore.load();
    await this.sanitizeSyncQueue(state);
    const count = this.stateStore.retryFailed(state, paths);
    await this.sanitizeSyncQueue(state);
    await this.stateStore.save(state);
    this.pendingCount = this.stateStore.pendingCount(state);
    this.failedCount = this.stateStore.failedCount(state);
    return count;
  }

  private async downloadFile(
    relative: string,
    cloudFile: DiskResource,
    state: Awaited<ReturnType<SyncStateStore['load']>>
  ): Promise<void> {
    let content: string;
    try {
      content = await this.api.downloadText(cloudFile.path);
    } catch (err) {
      if (isDiskNotFoundError(err)) {
        this.stateStore.removeFileState(state, relative);
        return;
      }
      throw err;
    }
    const normalized = content.replace(/\r\n/g, '\n');
    const localPath = path.join(this.localRoot, relative);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, normalized, 'utf-8');
    const stat = await fs.stat(localPath);
    this.stateStore.markSynced(
      state,
      relative,
      contentMd5(normalized),
      cloudFile.md5,
      cloudFile.modified,
      stat.mtimeMs,
      stat.size
    );
  }

  private async uploadFile(
    relative: string,
    local: LocalFileMeta,
    state: Awaited<ReturnType<SyncStateStore['load']>>
  ): Promise<void> {
    const localPath = path.join(this.localRoot, relative);
    const content = await fs.readFile(localPath, 'utf-8');
    await this.api.uploadText(YandexDiskApi.toCloudPath(relative), content);
    this.stateStore.markSynced(
      state,
      relative,
      local.md5,
      local.md5,
      undefined,
      local.mtimeMs,
      local.size
    );
  }

  private conflictPathFor(relative: string): string {
    const ext = path.extname(relative);
    const base = relative.slice(0, relative.length - ext.length);
    const stamp = new Date().toLocaleString('ru-RU').replace(/[,:]/g, '-');
    return `${base} (конфликтная копия от ${stamp})${ext}`;
  }

  private async createConflictCopy(
    relative: string,
    cloudContent: string,
    state: Awaited<ReturnType<SyncStateStore['load']>>
  ): Promise<void> {
    const conflictRel = this.conflictPathFor(relative);
    const localPath = path.join(this.localRoot, conflictRel);
    const normalized = cloudContent.replace(/\r\n/g, '\n');
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, normalized, 'utf-8');
    const stat = await fs.stat(localPath);
    this.stateStore.markSynced(
      state,
      conflictRel,
      contentMd5(normalized),
      contentMd5(normalized),
      undefined,
      stat.mtimeMs,
      stat.size
    );
    this.status(`Конфликт: ${relative}`);
  }

  private resolveDirection(
    relative: string,
    local: LocalFileMeta,
    cloudFile: DiskResource,
    state: Awaited<ReturnType<SyncStateStore['load']>>
  ): 'skip' | 'download' | 'upload' | 'conflict' {
    return resolveSyncDirection(
      local,
      cloudFile.md5,
      cloudFile.modified,
      state.files[relative]
    );
  }

  /** Двусторонняя синхронизация через Яндекс.Диск */
  async syncAll(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    this.reportProgress(0, 'Синхронизация с Яндекс.Диском...');
    this.status('Синхронизация с Яндекс.Диском...');

    try {
      await this.syncFilesCore(0);
      this.reportProgress(100, 'Синхронизировано');
    } catch (err) {
      this.lastError = String(err);
      this.status(`Ошибка синхронизации: ${err}`);
      throw err;
    } finally {
      this.syncing = false;
      this.syncProgress = 0;
      this.syncProgressLabel = '';
    }
  }

  private async syncFilesCore(progressFrom: number): Promise<void> {
    this.api.resetFolderCache();
    const state = await this.stateStore.load();
    await this.sanitizeSyncQueue(state);
    await this.stateStore.save(state);
    const span = 92 - progressFrom;

    this.reportProgress(progressFrom + span * 0.02, 'Отправка очереди...');
    await this.processPending(state);

    this.reportProgress(progressFrom + span * 0.1, 'Чтение списка с Диска...');

    const cloudFiles = (await this.api.listAllFiles(YANDEX_CLOUD_ROOT)).filter(filterCloudFile);
    const cloudMap = new Map<string, DiskResource>();
    for (const file of cloudFiles) {
      cloudMap.set(YandexDiskApi.toRelativePath(file.path), file);
    }

    const localMap = await this.listLocalSyncableFiles(state);
    const allPaths = [...new Set([...cloudMap.keys(), ...localMap.keys()])];

    const workQueue: SyncWorkItem[] = [];
    for (const relative of allPaths) {
      const cloudFile = cloudMap.get(relative);
      const local = localMap.get(relative);

      if (cloudFile && !local) {
        workQueue.push({ action: 'download', relative, cloudFile });
        continue;
      }

      if (local && !cloudFile) {
        workQueue.push({ action: 'upload', relative, local });
        continue;
      }

      if (cloudFile && local) {
        const action = this.resolveDirection(relative, local, cloudFile, state);
        if (action === 'skip') {
          this.stateStore.markSynced(
            state,
            relative,
            local.md5,
            cloudFile.md5 ?? local.md5,
            cloudFile.modified,
            local.mtimeMs,
            local.size
          );
        } else if (action === 'download') {
          workQueue.push({ action: 'download', relative, cloudFile });
        } else if (action === 'upload') {
          workQueue.push({ action: 'upload', relative, local });
        } else {
          workQueue.push({ action: 'conflict', relative, local, cloudFile });
        }
      }
    }

    const uploadedThisRun = new Set<string>();
    let completed = 0;
    const totalWork = workQueue.length;

    await mapPool(
      workQueue,
      async (item) => {
        try {
          if (item.action === 'download') {
            await this.downloadFile(item.relative, item.cloudFile, state);
          } else if (item.action === 'upload') {
            await this.uploadFile(item.relative, item.local, state);
            uploadedThisRun.add(item.relative);
          } else {
            let cloudContent: string;
            try {
              cloudContent = await this.api.downloadText(item.cloudFile.path);
            } catch (err) {
              if (isDiskNotFoundError(err)) {
                this.stateStore.removeFileState(state, item.relative);
                return;
              }
              throw err;
            }
            await this.createConflictCopy(item.relative, cloudContent, state);
            this.stateStore.markSynced(
              state,
              item.relative,
              item.local.md5,
              item.cloudFile.md5 ?? contentMd5(cloudContent),
              item.cloudFile.modified,
              item.local.mtimeMs,
              item.local.size
            );
          }
        } finally {
          completed++;
          const fileLabel =
            totalWork > 24
              ? `Файлы: ${completed} / ${totalWork}`
              : item.relative.split('/').pop() ?? item.relative;
          this.reportProgress(
            progressFrom + span * 0.12 + (completed / Math.max(totalWork, 1)) * span * 0.78,
            fileLabel
          );
        }
      },
      SYNC_FILE_CONCURRENCY
    );

    this.reportProgress(progressFrom + span * 0.94, 'Завершение...');

    for (const [relative] of localMap) {
      if (cloudMap.has(relative) || uploadedThisRun.has(relative)) continue;
      if (isYandexConflictPath(relative)) continue;
      const prev = state.files[relative];
      if (!prev?.lastSyncedAt) continue;

      const localPath = path.join(this.localRoot, relative);
      await fs.unlink(localPath).catch(() => {});
      this.stateStore.removeFileState(state, relative);
    }

    await this.stateStore.save(state);
    this.pendingCount = this.stateStore.pendingCount(state);
    this.failedCount = this.stateStore.failedCount(state);
    this.lastSync = new Date().toISOString();
    this.lastError = null;
    this.status(
      this.failedCount > 0
        ? `Синхронизировано, ошибок: ${this.failedCount}`
        : this.pendingCount > 0
          ? `Синхронизировано, в очереди: ${this.pendingCount}`
          : 'Синхронизировано с Яндекс.Диском'
    );
  }

  /** @deprecated Используйте syncAll */
  async pullAll(): Promise<void> {
    return this.syncAll();
  }

  async pushFile(relativePath: string, content: string): Promise<void> {
    const norm = relativePath.replace(/\\/g, '/');
    const state = await this.stateStore.load();

    try {
      await this.api.uploadText(YandexDiskApi.toCloudPath(norm), content);
      const hash = contentMd5(content);
      let mtimeMs: number | undefined;
      let size: number | undefined;
      try {
        const stat = await fs.stat(path.join(this.localRoot, norm));
        mtimeMs = stat.mtimeMs;
        size = stat.size;
      } catch {
        // file may not exist locally yet
      }
      this.stateStore.markSynced(state, norm, hash, hash, undefined, mtimeMs, size);
      await this.stateStore.save(state);
      this.pendingCount = this.stateStore.pendingCount(state);
      this.lastSync = new Date().toISOString();
      this.lastError = null;
    } catch (err) {
      this.stateStore.enqueueUpload(state, norm);
      await this.stateStore.save(state);
      this.pendingCount = this.stateStore.pendingCount(state);
      this.lastError = String(err);
      throw err;
    }
  }

  async pushDelete(relativePath: string): Promise<void> {
    const norm = relativePath.replace(/\\/g, '/');
    const cloudPath = YandexDiskApi.toCloudPath(norm);
    const state = await this.stateStore.load();

    try {
      if (await this.api.exists(cloudPath)) {
        await this.api.delete(cloudPath);
      }
      this.stateStore.removeFileState(state, norm);
      await this.stateStore.save(state);
      this.pendingCount = this.stateStore.pendingCount(state);
      this.lastSync = new Date().toISOString();
    } catch (err) {
      this.stateStore.enqueueDelete(state, norm);
      await this.stateStore.save(state);
      this.pendingCount = this.stateStore.pendingCount(state);
      this.lastError = String(err);
      throw err;
    }
  }

  async pushDeleteFolder(relativePath: string): Promise<void> {
    const cloudPath = YandexDiskApi.toCloudPath(relativePath);
    if (await this.api.exists(cloudPath)) {
      await this.api.delete(cloudPath);
    }
  }

  async clearArchiveRemote(): Promise<void> {
    const state = await this.stateStore.load();
    this.purgeArchiveFromSyncState(state);
    await this.stateStore.save(state);

    try {
      await this.applyArchiveCloudClear();
      this.lastSync = new Date().toISOString();
      this.lastError = null;
      this.pendingCount = this.stateStore.pendingCount(state);
      this.failedCount = this.stateStore.failedCount(state);
      await this.stateStore.save(state);
    } catch (err) {
      const retryState = await this.stateStore.load();
      await this.queueArchiveCloudClear(retryState);
      this.lastError = String(err);
      throw err;
    }
  }

  async pushRename(oldPath: string, newPath: string): Promise<void> {
    const fromNorm = oldPath.replace(/\\/g, '/');
    const toNorm = newPath.replace(/\\/g, '/');
    const fromCloud = YandexDiskApi.toCloudPath(fromNorm);
    const toCloud = YandexDiskApi.toCloudPath(toNorm);
    const state = await this.stateStore.load();

    if (await this.api.exists(fromCloud)) {
      await this.api.move(fromCloud, toCloud);
    }

    if (state.files[fromNorm]) {
      state.files[toNorm] = { ...state.files[fromNorm] };
      delete state.files[fromNorm];
    }

    for (const op of state.pending) {
      if (op.path === fromNorm) op.path = toNorm;
    }

    await this.stateStore.save(state);
    this.lastSync = new Date().toISOString();
  }

  async pushFolder(relativePath: string): Promise<void> {
    const cloudPath = YandexDiskApi.toCloudPath(relativePath);
    await this.api.createFolder(cloudPath);
  }

  startPeriodicSync(intervalMs = 60_000, beforeSync?: () => Promise<void>): void {
    this.stopPeriodicSync();
    this.syncTimer = setInterval(() => {
      const run = async () => {
        if (beforeSync) await beforeSync();
        await this.syncAll();
      };
      run().catch((err) => {
        this.lastError = String(err);
      });
    }, intervalMs);
  }

  stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  async ensureLocalStructure(): Promise<{ isNew: boolean }> {
    const existed = await this.isVaultInitializedLocal();
    await fs.mkdir(this.localRoot, { recursive: true });
    await fs.mkdir(path.join(this.localRoot, '.merkaba'), { recursive: true });

    if (!existed) {
      await this.markVaultInitializedLocal();
      return { isNew: true };
    }

    return { isNew: false };
  }

  private async isVaultInitializedLocal(): Promise<boolean> {
    for (const rel of VAULT_LEGACY_MARKERS) {
      try {
        await fs.access(path.join(this.localRoot, rel));
        return true;
      } catch {
        // try next marker
      }
    }
    return false;
  }

  private async markVaultInitializedLocal(): Promise<void> {
    const markerPath = path.join(this.localRoot, VAULT_INIT_MARKER);
    await fs.mkdir(path.dirname(markerPath), { recursive: true });
    try {
      await fs.access(markerPath);
    } catch {
      await fs.writeFile(markerPath, new Date().toISOString(), 'utf-8');
    }
  }

  private async markVaultInitializedCloud(): Promise<void> {
    const cloudMarker = `${YANDEX_CLOUD_ROOT}/${VAULT_INIT_MARKER}`;
    if (!(await this.api.exists(cloudMarker))) {
      await this.api.uploadText(cloudMarker, new Date().toISOString());
    }
  }

  async ensureCloudStructure(): Promise<void> {
    await this.api.createFolder(YANDEX_CLOUD_ROOT);
    await this.api.createFolder(`${YANDEX_CLOUD_ROOT}/.merkaba`);
    await this.markVaultInitializedCloud();
  }

  private backgroundSyncPromise: Promise<void> | null = null;

  /** Синхронизация с облаком в фоне — не блокирует UI */
  runBackgroundSync(onComplete?: () => void): Promise<void> {
    if (this.backgroundSyncPromise) {
      return this.backgroundSyncPromise;
    }

    this.backgroundSyncPromise = (async () => {
      try {
        await this.ensureCloudStructure();
        await this.syncAll();
      } catch {
        // syncAll уже сообщает об ошибке через status
      } finally {
        this.backgroundSyncPromise = null;
        onComplete?.();
      }
    })();

    return this.backgroundSyncPromise;
  }

  async initializeLocal(): Promise<{ isNew: boolean }> {
    return this.ensureLocalStructure();
  }

  async initialize(): Promise<{ isNew: boolean }> {
    return this.initializeLocal();
  }
}

export async function initLocalFileSystem(): Promise<FileSystem> {
  const localRoot = getLocalVaultPath();
  await fs.mkdir(localRoot, { recursive: true });
  return new FileSystem(localRoot);
}
