import { contextBridge, ipcRenderer } from 'electron';
import type { Config, TreeScanOptions } from '../shared/types';

contextBridge.exposeInMainWorld('merkaba', {
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('fs:writeFile', path, content) as Promise<string>,
  deleteFile: (path: string) => ipcRenderer.invoke('fs:deleteFile', path),
  deleteFolder: (path: string) => ipcRenderer.invoke('fs:deleteFolder', path),
  moveItem: (itemPath: string, targetFolderPath: string) =>
    ipcRenderer.invoke('fs:moveItem', itemPath, targetFolderPath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:renameFile', oldPath, newPath),
  createFolder: (path: string) => ipcRenderer.invoke('fs:createFolder', path),
  createNote: (folderPath: string, name: string, noteType?: string) =>
    ipcRenderer.invoke('fs:createNote', folderPath, name, noteType),
  getFileTree: (options?: TreeScanOptions) => ipcRenderer.invoke('fs:getFileTree', options),
  getArchiveTree: (options?: TreeScanOptions) => ipcRenderer.invoke('fs:getArchiveTree', options),
  clearArchive: () => ipcRenderer.invoke('fs:clearArchive'),
  getPinnedNotes: () => ipcRenderer.invoke('pinned:get'),
  pinNote: (path: string) => ipcRenderer.invoke('pinned:pin', path),
  unpinNote: (path: string) => ipcRenderer.invoke('pinned:unpin', path),
  watchFolder: (callback: (event: string, path: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: string, filePath: string) =>
      callback(event, filePath);
    ipcRenderer.on('fs:changed', handler);
    return () => {
      ipcRenderer.removeListener('fs:changed', handler);
    };
  },
  search: (query: string) => ipcRenderer.invoke('search:query', query),
  rebuildIndex: () => ipcRenderer.invoke('search:rebuild'),
  getStickers: () => ipcRenderer.invoke('stickers:get'),
  createSticker: (input?: {
    title?: string;
    content?: string;
    color?: number;
    x?: number;
    y?: number;
    linkedNotePath?: string | null;
  }) => ipcRenderer.invoke('stickers:create', input),
  updateSticker: (
    id: string,
    patch: Partial<{
      title: string;
      content: string;
      color: number;
      rotation: number;
      pinX: number;
      x: number;
      y: number;
      linkedNotePath: string | null;
    }>
  ) => ipcRenderer.invoke('stickers:update', id, patch),
  deleteSticker: (id: string) => ipcRenderer.invoke('stickers:delete', id),
  toggleTask: (filePath: string, line: number) => ipcRenderer.invoke('tasks:toggle', filePath, line),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: Partial<Config>) => ipcRenderer.invoke('config:set', config),
  getConflicts: () => ipcRenderer.invoke('conflicts:get'),
  resolveConflict: (file: string, choice: 'main' | 'conflict') =>
    ipcRenderer.invoke('conflicts:resolve', file, choice),
  setTitle: (title: string) => ipcRenderer.invoke('window:setTitle', title),
  setWindowBackground: (color: string) => ipcRenderer.invoke('window:setBackground', color),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onPrepareShutdown: (callback: () => void | Promise<void>) => {
    const handler = async () => {
      try {
        await callback();
      } finally {
        ipcRenderer.send('app:shutdown-ready');
      }
    };
    ipcRenderer.on('app:prepare-shutdown', handler);
    return () => {
      ipcRenderer.removeListener('app:prepare-shutdown', handler);
    };
  },
  onStatus: (callback: (message: string) => void) => {
    ipcRenderer.on('status:message', (_, message) => callback(message));
  },
  // Яндекс.Диск
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),
  getCredentialsInfo: () => ipcRenderer.invoke('auth:credentialsInfo'),
  saveCredentials: (clientId: string, clientSecret: string) =>
    ipcRenderer.invoke('auth:saveCredentials', clientId, clientSecret),
  startYandexAuth: () => ipcRenderer.invoke('auth:start'),
  startDeviceAuth: () => ipcRenderer.invoke('auth:startDevice'),
  pollDeviceAuth: (deviceCode: string) => ipcRenderer.invoke('auth:pollDevice', deviceCode),
  saveManualToken: (token: string) => ipcRenderer.invoke('auth:saveToken', token),
  exchangeAuthCode: (code: string) => ipcRenderer.invoke('auth:exchange', code),
  logout: () => ipcRenderer.invoke('auth:logout'),
  initCloudVault: () => ipcRenderer.invoke('vault:initCloud'),
  restoreSession: () => ipcRenderer.invoke('session:restore'),
  syncPull: () => ipcRenderer.invoke('sync:pull'),
  retryFailedSync: (paths?: string[]) => ipcRenderer.invoke('sync:retryFailed', paths),
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),
  getFileSyncStatuses: () => ipcRenderer.invoke('sync:fileStatuses'),
  getSyncFailedOps: () => ipcRenderer.invoke('sync:failedOps'),
});
