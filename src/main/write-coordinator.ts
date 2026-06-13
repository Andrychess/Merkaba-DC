import type { FileSystem } from './file-system';
import type { SearchIndexer } from './indexer';
import type { SyncEngine } from './sync-engine';

const REBUILD_DEBOUNCE_MS = 900;
const UPLOAD_DEBOUNCE_MS = 2500;

let getSync: (() => SyncEngine) | null = null;
let getFs: (() => FileSystem) | null = null;
let searchIndexer: SearchIndexer | null = null;

let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
const uploadTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingUploads = new Map<string, string>();

export function initWriteCoordinator(deps: {
  getSync: () => SyncEngine;
  getFs: () => FileSystem;
  searchIndexer: SearchIndexer;
}): void {
  getSync = deps.getSync;
  getFs = deps.getFs;
  searchIndexer = deps.searchIndexer;
}

export function scheduleSearchRebuild(): void {
  if (!searchIndexer || !getFs) return;
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    void searchIndexer!.buildIndex(getFs!());
  }, REBUILD_DEBOUNCE_MS);
}

export async function rebuildSearchNow(): Promise<void> {
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
    rebuildTimer = null;
  }
  if (searchIndexer && getFs) {
    await searchIndexer.buildIndex(getFs());
  }
}

export function scheduleCloudUpload(relativePath: string, content: string): void {
  if (!getSync) return;
  const norm = relativePath.replace(/\\/g, '/');
  pendingUploads.set(norm, content);

  const existing = uploadTimers.get(norm);
  if (existing) clearTimeout(existing);

  uploadTimers.set(
    norm,
    setTimeout(() => {
      uploadTimers.delete(norm);
      void flushCloudUpload(norm);
    }, UPLOAD_DEBOUNCE_MS)
  );
}

async function flushCloudUpload(norm: string): Promise<void> {
  const content = pendingUploads.get(norm);
  if (!content || !getSync) return;
  pendingUploads.delete(norm);

  try {
    await getSync().pushFile(norm, content);
  } catch {
    // pushFile ставит файл в очередь при ошибке (в т.ч. 423)
  }
}

/** Немедленная загрузка в облако (создание заметки, конфликты и т.п.) */
export async function uploadCloudNow(relativePath: string, content: string): Promise<void> {
  const norm = relativePath.replace(/\\/g, '/');
  pendingUploads.delete(norm);
  const timer = uploadTimers.get(norm);
  if (timer) {
    clearTimeout(timer);
    uploadTimers.delete(norm);
  }
  if (!getSync) return;
  try {
    await getSync().pushFile(norm, content);
  } catch {
    // очередь отложенных загрузок
  }
}

/** Перед ручной синхронизацией — отправить все отложенные правки */
export async function flushAllCloudUploads(): Promise<void> {
  const paths = [...pendingUploads.keys()];
  for (const norm of paths) {
    const timer = uploadTimers.get(norm);
    if (timer) {
      clearTimeout(timer);
      uploadTimers.delete(norm);
    }
    await flushCloudUpload(norm);
  }
}
