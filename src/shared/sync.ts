export type FileSyncStatus = 'synced' | 'pending';

export type FileSyncStatusMap = Record<string, FileSyncStatus>;

export interface SyncFileState {
  localMd5?: string;
  cloudMd5?: string;
  cloudModified?: string;
  lastSyncedAt?: string;
  /** Кэш для быстрой проверки без перечитывания файла */
  localMtimeMs?: number;
  localSize?: number;
}

export interface SyncPendingUpload {
  op: 'upload';
  path: string;
  retries: number;
  at: string;
}

export interface SyncPendingDelete {
  op: 'delete';
  path: string;
  retries: number;
  at: string;
}

export type SyncPendingOp = SyncPendingUpload | SyncPendingDelete;

export interface SyncStateData {
  files: Record<string, SyncFileState>;
  pending: SyncPendingOp[];
}

export const SYNC_STATE_PATH = '.merkaba/sync-state.json';

export const SYNCABLE_MERKABA_FILES = ['stickers.json', 'pinned.json', 'config.json'] as const;

export function isSyncableRelativePath(relativePath: string): boolean {
  const norm = relativePath.replace(/\\/g, '/');
  if (norm === SYNC_STATE_PATH) return false;
  if (norm === 'README.md') return true;
  if (norm.endsWith('.md')) return true;
  if (norm.startsWith('.merkaba/')) {
    const name = norm.slice('.merkaba/'.length);
    return (SYNCABLE_MERKABA_FILES as readonly string[]).includes(name);
  }
  return false;
}

export function isYandexConflictPath(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  return lower.includes('конфликтная') || lower.includes('conflict');
}
