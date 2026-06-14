import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { FileSystem } from './file-system';
import { YandexDiskApi } from './yandex-disk-api';
import { SyncStateStore } from './sync-state';
import { YANDEX_CLOUD_ROOT, type SyncStatus } from '../shared/yandex';
import type { DiskResource } from '../shared/yandex';
import {
  isSyncableRelativePath,
  isYandexConflictPath,
} from '../shared/sync';
import { ARCHIVE_FOLDER } from '../shared/archive';
import { getLocalVaultPath } from './auth-store';

const README_CONTENT = `# Merkaba

Личный блокнот с синхронизацией через Яндекс.Диск.
`;

const WELCOME_NOTE = `---
title: Добро пожаловать в Merkaba
created: ${new Date().toISOString()}
modified: ${new Date().toISOString()}
tags: [приветствие]
---

# Добро пожаловать в Merkaba

Это ваша первая заметка. Начните писать!

## Возможности

- Редактирование Markdown
- Wiki-ссылки: [[README]]
- Синхронизация с Яндекс.Диском
- Поиск и граф связей
`;

const FOLDERS = ['notes', 'daily', 'projects', 'attachments', '_archive'];
const MAX_PENDING_RETRIES = 5;

interface LocalFileInfo {
  md5: string;
  mtimeMs: number;
}

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
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private onStatus?: (message: string) => void;
  private autoSyncEnabled: () => boolean = () => false;

  constructor(onStatus?: (message: string) => void) {
    this.localRoot = getLocalVaultPath();
    this.stateStore = new SyncStateStore(this.localRoot);
    this.onStatus = onStatus;
  }

  getStatus(): SyncStatus {
    return {
      syncing: this.syncing,
      lastSync: this.lastSync,
      error: this.lastError,
      pendingCount: this.pendingCount,
    };
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
    this.stateStore.enqueueDelete(state, oldPath.replace(/\\/g, '/'));
    this.stateStore.enqueueUpload(state, newPath.replace(/\\/g, '/'));
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
    if (this.autoSyncEnabled()) {
      await this.clearArchiveRemote();
    }
    // в ручном режиме — при следующей синхронизации
  }

  private status(msg: string): void {
    this.onStatus?.(msg);
  }

  private async readLocalFile(relativePath: string): Promise<LocalFileInfo> {
    const localPath = path.join(this.localRoot, relativePath);
    const content = await fs.readFile(localPath, 'utf-8');
    const stat = await fs.stat(localPath);
    return { md5: contentMd5(content), mtimeMs: stat.mtimeMs };
  }

  private async listLocalSyncableFiles(): Promise<Map<string, LocalFileInfo>> {
    const files = new Map<string, LocalFileInfo>();
    await this.walkLocal('', files);
    return files;
  }

  private async walkLocal(relativeDir: string, files: Map<string, LocalFileInfo>): Promise<void> {
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
        await this.walkLocal(norm, files);
        continue;
      }

      if (!isSyncableRelativePath(norm)) continue;
      try {
        files.set(norm, await this.readLocalFile(norm));
      } catch {
        // skip unreadable
      }
    }
  }

  private async processPending(state: Awaited<ReturnType<SyncStateStore['load']>>): Promise<void> {
    const remaining = [...state.pending];

    for (const op of remaining) {
      if (op.retries >= MAX_PENDING_RETRIES) continue;

      try {
        if (op.op === 'upload') {
          const localPath = path.join(this.localRoot, op.path);
          const content = await fs.readFile(localPath, 'utf-8');
          await this.api.uploadText(YandexDiskApi.toCloudPath(op.path), content);
          const info = await this.readLocalFile(op.path);
          this.stateStore.markSynced(state, op.path, info.md5);
        } else if (op.op === 'delete') {
          await this.pushDelete(op.path);
          this.stateStore.removeFileState(state, op.path);
        }
      } catch {
        this.stateStore.bumpRetry(state, op);
      }
    }

    state.pending = state.pending.filter((p) => p.retries < MAX_PENDING_RETRIES);
    this.pendingCount = this.stateStore.pendingCount(state);
  }

  private async downloadFile(
    relative: string,
    cloudFile: DiskResource,
    state: Awaited<ReturnType<SyncStateStore['load']>>
  ): Promise<void> {
    const content = await this.api.downloadText(cloudFile.path);
    const normalized = content.replace(/\r\n/g, '\n');
    const localPath = path.join(this.localRoot, relative);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, normalized, 'utf-8');
    this.stateStore.markSynced(
      state,
      relative,
      contentMd5(normalized),
      cloudFile.md5,
      cloudFile.modified
    );
  }

  private async uploadFile(
    relative: string,
    local: LocalFileInfo,
    state: Awaited<ReturnType<SyncStateStore['load']>>
  ): Promise<void> {
    const localPath = path.join(this.localRoot, relative);
    const content = await fs.readFile(localPath, 'utf-8');
    await this.api.uploadText(YandexDiskApi.toCloudPath(relative), content);
    this.stateStore.markSynced(state, relative, local.md5, local.md5);
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
    this.stateStore.markSynced(state, conflictRel, contentMd5(normalized));
    this.status(`Конфликт: ${relative}`);
  }

  private resolveDirection(
    relative: string,
    local: LocalFileInfo,
    cloudFile: DiskResource,
    state: Awaited<ReturnType<SyncStateStore['load']>>
  ): 'skip' | 'download' | 'upload' | 'conflict' {
    const prev = state.files[relative];
    const cloudMd5 = cloudFile.md5;
    const cloudTime = cloudFile.modified ? new Date(cloudFile.modified).getTime() : 0;

    if (cloudMd5 && local.md5 === cloudMd5) return 'skip';
    if (prev?.localMd5 && prev?.cloudMd5 && prev.localMd5 === local.md5 && prev.cloudMd5 === cloudMd5) {
      return 'skip';
    }

    const localChanged = !prev?.localMd5 || prev.localMd5 !== local.md5;
    const cloudChanged = !prev?.cloudMd5 || (cloudMd5 ? prev.cloudMd5 !== cloudMd5 : cloudTime > 0);

    if (localChanged && cloudChanged) {
      if (cloudTime > local.mtimeMs) return 'download';
      if (local.mtimeMs > cloudTime) return 'upload';
      return 'conflict';
    }

    if (cloudChanged && !localChanged) return 'download';
    if (localChanged && !cloudChanged) return 'upload';

    if (cloudTime > local.mtimeMs) return 'download';
    if (local.mtimeMs > cloudTime) return 'upload';
    return 'skip';
  }

  /** Двусторонняя синхронизация через Яндекс.Диск */
  async syncAll(): Promise<void> {
    if (this.syncing) return;

    this.syncing = true;
    this.status('Синхронизация с Яндекс.Диском...');

    const state = await this.stateStore.load();

    try {
      await this.processPending(state);

      const cloudFiles = (await this.api.listAllFiles(YANDEX_CLOUD_ROOT)).filter(filterCloudFile);
      const cloudMap = new Map<string, DiskResource>();
      for (const file of cloudFiles) {
        cloudMap.set(YandexDiskApi.toRelativePath(file.path), file);
      }

      const localMap = await this.listLocalSyncableFiles();
      const allPaths = new Set([...cloudMap.keys(), ...localMap.keys()]);
      const uploadedThisRun = new Set<string>();

      for (const relative of allPaths) {
        const cloudFile = cloudMap.get(relative);
        const local = localMap.get(relative);

        if (cloudFile && !local) {
          await this.downloadFile(relative, cloudFile, state);
          continue;
        }

        if (local && !cloudFile) {
          await this.uploadFile(relative, local, state);
          uploadedThisRun.add(relative);
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
              cloudFile.modified
            );
          } else if (action === 'download') {
            await this.downloadFile(relative, cloudFile, state);
          } else if (action === 'upload') {
            await this.uploadFile(relative, local, state);
            uploadedThisRun.add(relative);
          } else {
            const cloudContent = await this.api.downloadText(cloudFile.path);
            await this.createConflictCopy(relative, cloudContent, state);
            this.stateStore.markSynced(
              state,
              relative,
              local.md5,
              cloudFile.md5 ?? contentMd5(cloudContent),
              cloudFile.modified
            );
          }
        }
      }

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
      this.lastSync = new Date().toISOString();
      this.lastError = null;
      this.status(
        this.pendingCount > 0
          ? `Синхронизировано, в очереди: ${this.pendingCount}`
          : 'Синхронизировано с Яндекс.Диском'
      );
    } catch (err) {
      this.lastError = String(err);
      await this.stateStore.save(state);
      this.pendingCount = this.stateStore.pendingCount(state);
      this.status(`Ошибка синхронизации: ${err}`);
      throw err;
    } finally {
      this.syncing = false;
    }
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
      this.stateStore.markSynced(state, norm, hash, hash);
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
    for (const key of Object.keys(state.files)) {
      if (key === ARCHIVE_FOLDER || key.startsWith(`${ARCHIVE_FOLDER}/`)) {
        this.stateStore.removeFileState(state, key);
      }
    }
    state.pending = state.pending.filter(
      (p) => p.path !== ARCHIVE_FOLDER && !p.path.startsWith(`${ARCHIVE_FOLDER}/`)
    );

    try {
      await this.pushDeleteFolder(ARCHIVE_FOLDER);
      await this.pushFolder(ARCHIVE_FOLDER);
      await this.stateStore.save(state);
      this.lastSync = new Date().toISOString();
    } catch (err) {
      await this.stateStore.save(state);
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
    const welcomePath = path.join(this.localRoot, 'notes/dobro-pozhalovat.md');
    let isNew = false;
    try {
      await fs.access(welcomePath);
    } catch {
      isNew = true;
    }

    await fs.mkdir(this.localRoot, { recursive: true });
    for (const folder of FOLDERS) {
      await fs.mkdir(path.join(this.localRoot, folder), { recursive: true });
    }
    await fs.mkdir(path.join(this.localRoot, '.merkaba'), { recursive: true });

    if (isNew) {
      const readmePath = path.join(this.localRoot, 'README.md');
      try {
        await fs.access(readmePath);
      } catch {
        await fs.writeFile(readmePath, README_CONTENT, 'utf-8');
      }
      await fs.writeFile(welcomePath, WELCOME_NOTE, 'utf-8');
    }

    return { isNew };
  }

  async ensureCloudStructure(): Promise<void> {
    const welcomeExists = await this.api.exists(`${YANDEX_CLOUD_ROOT}/notes/dobro-pozhalovat.md`);

    await this.api.createFolder(YANDEX_CLOUD_ROOT);
    await this.api.createFolder(`${YANDEX_CLOUD_ROOT}/.merkaba`);

    if (!welcomeExists) {
      for (const folder of FOLDERS) {
        await this.api.createFolder(`${YANDEX_CLOUD_ROOT}/${folder}`);
      }
      await this.api.uploadText(`${YANDEX_CLOUD_ROOT}/README.md`, README_CONTENT);
      await this.api.uploadText(`${YANDEX_CLOUD_ROOT}/notes/dobro-pozhalovat.md`, WELCOME_NOTE);
    }

    await this.api.createFolder(`${YANDEX_CLOUD_ROOT}/_archive`);
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
