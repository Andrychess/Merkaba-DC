import fs from 'fs/promises';
import path from 'path';
import type { SyncStateData, SyncPendingOp } from '../shared/sync';
import { SYNC_STATE_PATH } from '../shared/sync';

const EMPTY_STATE: SyncStateData = { files: {}, pending: [], failed: [] };

export class SyncStateStore {
  constructor(private localRoot: string) {}

  private statePath(): string {
    return path.join(this.localRoot, SYNC_STATE_PATH);
  }

  async load(): Promise<SyncStateData> {
    try {
      const raw = await fs.readFile(this.statePath(), 'utf-8');
      const parsed = JSON.parse(raw) as Partial<SyncStateData>;
      return {
        files: parsed.files ?? {},
        pending: parsed.pending ?? [],
        failed: parsed.failed ?? [],
      };
    } catch {
      return { ...EMPTY_STATE, files: {}, pending: [], failed: [] };
    }
  }

  async save(state: SyncStateData): Promise<void> {
    const filePath = this.statePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  enqueueUpload(state: SyncStateData, relativePath: string): void {
    const norm = relativePath.replace(/\\/g, '/');
    state.pending = state.pending.filter(
      (p) => !(p.op === 'upload' && p.path === norm) && !(p.op === 'delete' && p.path === norm)
    );
    state.pending.push({ op: 'upload', path: norm, retries: 0, at: new Date().toISOString() });
  }

  enqueueDelete(state: SyncStateData, relativePath: string): void {
    const norm = relativePath.replace(/\\/g, '/');
    state.pending = state.pending.filter(
      (p) => !(p.op === 'upload' && p.path === norm) && !(p.op === 'delete' && p.path === norm)
    );
    state.pending.push({ op: 'delete', path: norm, retries: 0, at: new Date().toISOString() });
  }

  clearPendingForPath(state: SyncStateData, relativePath: string): void {
    const norm = relativePath.replace(/\\/g, '/');
    state.pending = state.pending.filter((p) => p.path !== norm);
  }

  markSynced(
    state: SyncStateData,
    relativePath: string,
    localMd5: string,
    cloudMd5?: string,
    cloudModified?: string,
    localMtimeMs?: number,
    localSize?: number
  ): void {
    const norm = relativePath.replace(/\\/g, '/');
    state.files[norm] = {
      localMd5,
      cloudMd5: cloudMd5 ?? localMd5,
      cloudModified,
      lastSyncedAt: new Date().toISOString(),
      ...(localMtimeMs !== undefined ? { localMtimeMs } : {}),
      ...(localSize !== undefined ? { localSize } : {}),
    };
    this.clearPendingForPath(state, norm);
  }

  removeFileState(state: SyncStateData, relativePath: string): void {
    const norm = relativePath.replace(/\\/g, '/');
    delete state.files[norm];
    this.clearPendingForPath(state, norm);
  }

  pendingCount(state: SyncStateData): number {
    return state.pending.length;
  }

  failedCount(state: SyncStateData): number {
    return state.failed?.length ?? 0;
  }

  markFailed(state: SyncStateData, op: SyncPendingOp, error: string): void {
    const norm = op.path.replace(/\\/g, '/');
    state.pending = state.pending.filter((p) => p !== op && p.path !== norm);
    if (!state.failed) state.failed = [];
    state.failed = state.failed.filter((f) => f.path !== norm);
    state.failed.push({
      op: op.op,
      path: norm,
      error,
      retries: op.retries,
      at: new Date().toISOString(),
    });
  }

  retryFailed(state: SyncStateData, paths?: string[]): number {
    if (!state.failed?.length) return 0;
    const wanted = paths?.map((p) => p.replace(/\\/g, '/'));
    const toRetry = wanted
      ? state.failed.filter((f) => wanted.includes(f.path))
      : [...state.failed];

    for (const item of toRetry) {
      state.failed = state.failed!.filter((f) => f.path !== item.path);
      if (item.op === 'upload') {
        this.enqueueUpload(state, item.path);
      } else {
        this.enqueueDelete(state, item.path);
      }
    }

    return toRetry.length;
  }

  bumpRetry(state: SyncStateData, op: SyncPendingOp): void {
    op.retries += 1;
    op.at = new Date().toISOString();
  }
}
