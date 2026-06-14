import type { AppSlice, AppState } from '../app-state';
import { fetchVaultBootstrap, vaultStateFromBootstrap } from '../vault-bootstrap';

export const createSessionSlice: AppSlice<Pick<
  AppState,
  | 'initialized'
  | 'restoreSession'
  | 'confirmAuthCode'
  | 'saveManualToken'
  | 'syncPull'
>> = (set, get) => ({
  initialized: false,

  restoreSession: async () => {
    try {
      const result = await window.merkaba.restoreSession();
      if (!result) return false;

      const data = await fetchVaultBootstrap(result.rootPath);
      const auth = await window.merkaba.getAuthStatus();
      set(
        vaultStateFromBootstrap(
          data,
          auth.login
            ? `Загружено с устройства (${auth.login})`
            : 'Загружено с устройства'
        )
      );
      return true;
    } catch {
      return false;
    }
  },

  confirmAuthCode: async (code) => {
    try {
      const auth = await window.merkaba.exchangeAuthCode(code);
      const result = await window.merkaba.initCloudVault();
      const data = await fetchVaultBootstrap(result.rootPath);

      set(
        vaultStateFromBootstrap(
          data,
          result.isNew
            ? `Создано локально (${auth.login})`
            : `Загружено с устройства (${auth.login})`
        )
      );
    } catch (err) {
      set({ statusMessage: `Ошибка: ${err}` });
      throw err;
    }
  },

  saveManualToken: async (token) => {
    try {
      const auth = await window.merkaba.saveManualToken(token);
      const result = await window.merkaba.initCloudVault();
      const data = await fetchVaultBootstrap(result.rootPath);

      set(
        vaultStateFromBootstrap(data, `Загружено с устройства (${auth.login})`, { showConflicts: false })
      );
    } catch (err) {
      set({ statusMessage: `Ошибка: ${err}` });
      throw err;
    }
  },

  syncPull: async () => {
    try {
      await window.merkaba.syncPull();
      await get().refreshFileTree();
      await get().refreshArchiveTree();
      await get().loadPinnedNotes();
      await get().loadConflicts();
      set({ statusMessage: 'Синхронизировано' });
    } catch (err) {
      set({ statusMessage: `Ошибка синхронизации: ${err}` });
    }
  },
});
