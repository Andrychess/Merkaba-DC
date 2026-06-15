import type { AppSlice, AppState } from '../app-state';
import { fetchVaultBootstrap, vaultStateFromBootstrap } from '../vault-bootstrap';

async function applySyncResult(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState
): Promise<boolean> {
  await get().refreshFileTree();
  await get().refreshArchiveTree();
  await get().loadPinnedNotes();
  await get().loadConflicts();

  const status = await window.merkaba.getSyncStatus().catch(() => null);
  if (status?.error) {
    set({ statusMessage: `Ошибка синхронизации: ${status.error}` });
    return false;
  }
  if (status?.failedCount) {
    set({ statusMessage: `Синхронизировано, ошибок: ${status.failedCount}` });
    return true;
  }
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
      void get().syncPull({ initial: true });
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
    if (options?.initial) {
      set({ statusMessage: 'Синхронизация с Яндекс.Диском...' });
    }
    try {
      await window.merkaba.syncPull();
      await applySyncResult(set, get);
    } catch (err) {
      set({ statusMessage: `Ошибка синхронизации: ${err}` });
    }
  },

  retryFailedSync: async (paths?: string[]) => {
    set({ statusMessage: 'Повторная отправка...' });
    try {
      const count = await window.merkaba.retryFailedSync(paths);
      if (count > 0) {
        await applySyncResult(set, get);
      } else {
        set({ statusMessage: 'Нет файлов с ошибкой' });
      }
    } catch (err) {
      set({ statusMessage: `Ошибка синхронизации: ${err}` });
    }
  },
});
