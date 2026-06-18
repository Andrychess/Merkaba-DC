import type { SyncFailedOp } from '@shared/sync';

/** Список failed-операций; работает и со старым preload без getSyncFailedOps */
export async function fetchSyncFailedOps(): Promise<SyncFailedOp[]> {
  try {
    const getFailed = window.merkaba.getSyncFailedOps;
    if (typeof getFailed === 'function') {
      return await getFailed();
    }
  } catch {
    // preload ещё не обновлён — см. fallback ниже
  }

  try {
    const statuses = await window.merkaba.getFileSyncStatuses();
    return Object.entries(statuses)
      .filter(([, status]) => status === 'failed')
      .map(([path]) => ({
        op: 'upload' as const,
        path,
        error: 'не удалось синхронизировать',
        retries: 5,
        at: '',
      }));
  } catch {
    return [];
  }
}
