import type { AppSlice, AppState } from '../app-state';
import { fetchVaultBootstrap, vaultStateFromBootstrap } from '../vault-bootstrap';
import { formatSyncFailedMessage } from '@renderer/utils/sync-error-format';
import { fetchSyncFailedOps } from '@renderer/utils/merkaba-sync';

function showSyncFailure(set: (partial: Partial<AppState>) => void, message: string): void {
  set({
    statusMessage: `Ошибка синхронизации: ${message}`,
    syncErrorMessage: message,
  });
}

function clearSyncError(set: (partial: Partial<AppState>) => void): void {
  set({ syncErrorMessage: null });
}

async function applySyncResult(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState
): Promise<boolean> {
  await get().enrichFileTree();
  await get().loadPinnedNotes();
  await get().loadConflicts();

  const status = await window.merkaba.getSyncStatus().catch(() => null);
  if (status?.error) {
    showSyncFailure(set, status.error);
    return false;
  }
  if (status?.failedCount) {
    const failedOps = await fetchSyncFailedOps();
    const msg =
      failedOps.length > 0
        ? formatSyncFailedMessage(failedOps)
        : `Не удалось синхронизировать ${status.failedCount} файл(ов).`;
    set({
      statusMessage: `Синхронизировано, ошибок: ${status.failedCount}`,
      syncErrorMessage: msg,
    });
    return true;
  }
  clearSyncError(set);
  if (status?.pendingCount) {
    set({ statusMessage: `Синхронизировано, в очереди: ${status.pendingCount}` });
    return true;
  }
  set({ statusMessage: 'Синхронизировано' });
  return true;
}

export const createSessionSlice: AppSlice<Pick<
  AppState,
  | 'initialized'
  | 'restoreSession'
  | 'bootstrapAfterAuth'
  | 'confirmAuthCode'
  | 'saveManualToken'
  | 'syncPull'
  | 'retryFailedSync'
>> = (set, get) => ({
  initialized: false,

  restoreSession: async () => {
    try {
      const result = await window.merkaba.restoreSession();
      if (!result) return false;

      const data = await fetchVaultBootstrap(result.rootPath);
      set(
        vaultStateFromBootstrap(
          data,
          'Синхронизация с Яндекс.Диском...',
          { showConflicts: false }
        )
      );
      await get().syncPull({ initial: true });
      return true;
    } catch {
      return false;
    }
  },

  bootstrapAfterAuth: async () => {
    const result = await window.merkaba.initCloudVault();
    const data = await fetchVaultBootstrap(result.rootPath);
    set(
      vaultStateFromBootstrap(
        data,
        'Синхронизация с Яндекс.Диском...',
        { showConflicts: false }
      )
    );
    await get().syncPull({ initial: true });
  },

  confirmAuthCode: async (code) => {
    try {
      await window.merkaba.exchangeAuthCode(code);
      const result = await window.merkaba.initCloudVault();
      const data = await fetchVaultBootstrap(result.rootPath);

      set(
        vaultStateFromBootstrap(
          data,
          'Синхронизация с Яндекс.Диском...',
          { showConflicts: false }
        )
      );
      await get().syncPull({ initial: true });
    } catch (err) {
      set({ statusMessage: `Ошибка: ${err}` });
      throw err;
    }
  },

  saveManualToken: async (token) => {
    try {
      await window.merkaba.saveManualToken(token);
      await get().bootstrapAfterAuth();
    } catch (err) {
      set({ statusMessage: `Ошибка: ${err}` });
      throw err;
    }
  },

  syncPull: async (options?: { initial?: boolean }) => {
    clearSyncError(set);
    if (options?.initial) {
      set({ statusMessage: 'Синхронизация с Яндекс.Диском...' });
    }
    try {
      await window.merkaba.syncPull();
      await applySyncResult(set, get);
    } catch (err) {
      showSyncFailure(set, String(err));
    }
  },

  retryFailedSync: async (paths?: string[]) => {
    set({ statusMessage: 'Повторная отправка...' });
    try {
      await window.merkaba.retryFailedSync(paths);
      await applySyncResult(set, get);
    } catch (err) {
      showSyncFailure(set, String(err));
    }
  },
});
