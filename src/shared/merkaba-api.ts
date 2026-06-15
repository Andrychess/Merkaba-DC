import type {
  Config,
  ConflictFile,
  FileNode,
  GraphData,
  SearchResult,
  Sticker,
  TreeScanOptions,
} from './types';
import type { AuthStatus, SyncStatus, VaultInitResult } from './yandex';
import type { FileSyncStatusMap } from './sync';

export interface MerkabaAPI {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<string>;
  deleteFile: (path: string) => Promise<{ archivePath: string; mdFiles: string[] }>;
  deleteFolder: (path: string) => Promise<{ archivePath: string; mdFiles: string[] }>;
  moveItem: (itemPath: string, targetFolderPath: string) => Promise<string>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  createNote: (folderPath: string, name: string, noteType?: string) => Promise<string>;
  getFileTree: (options?: TreeScanOptions) => Promise<FileNode[]>;
  getArchiveTree: (options?: TreeScanOptions) => Promise<FileNode[]>;
  clearArchive: () => Promise<{ mdFiles: string[] }>;
  getPinnedNotes: () => Promise<string[]>;
  pinNote: (path: string) => Promise<string[]>;
  unpinNote: (path: string) => Promise<string[]>;
  watchFolder: (callback: (event: string, path: string) => void) => () => void;
  search: (query: string) => Promise<SearchResult[]>;
  rebuildIndex: () => Promise<void>;
  getGraph: () => Promise<GraphData>;
  getStickers: () => Promise<Sticker[]>;
  createSticker: (input?: {
    title?: string;
    content?: string;
    color?: number;
    x?: number;
    y?: number;
    linkedNotePath?: string | null;
  }) => Promise<Sticker>;
  updateSticker: (
    id: string,
    patch: Partial<
      Pick<Sticker, 'title' | 'content' | 'color' | 'rotation' | 'pinX' | 'x' | 'y' | 'linkedNotePath'>
    >
  ) => Promise<Sticker>;
  deleteSticker: (id: string) => Promise<void>;
  toggleTask: (filePath: string, line: number) => Promise<void>;
  getConfig: () => Promise<Config>;
  setConfig: (config: Partial<Config>) => Promise<Config>;
  getConflicts: () => Promise<ConflictFile[]>;
  resolveConflict: (file: string, choice: 'main' | 'conflict') => Promise<void>;
  setTitle: (title: string) => Promise<void>;
  setWindowBackground: (color: string) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  onStatus: (callback: (message: string) => void) => void;
  getAuthStatus: () => Promise<AuthStatus>;
  getCredentialsInfo: () => Promise<{ clientId: string; source: string } | null>;
  saveCredentials: (clientId: string, clientSecret: string) => Promise<{ clientId: string; source: string } | null>;
  startYandexAuth: () => Promise<string>;
  startDeviceAuth: () => Promise<{ userCode: string; verificationUrl: string; deviceCode: string; interval: number }>;
  pollDeviceAuth: (deviceCode: string) => Promise<{ done: boolean; pending?: boolean; authenticated?: boolean; login?: string }>;
  saveManualToken: (token: string) => Promise<AuthStatus>;
  exchangeAuthCode: (code: string) => Promise<AuthStatus>;
  logout: () => Promise<void>;
  initCloudVault: () => Promise<VaultInitResult>;
  restoreSession: () => Promise<VaultInitResult | null>;
  syncPull: () => Promise<void>;
  retryFailedSync: (paths?: string[]) => Promise<number>;
  getSyncStatus: () => Promise<SyncStatus>;
  getFileSyncStatuses: () => Promise<FileSyncStatusMap>;
}

declare global {
  interface Window {
    merkaba: MerkabaAPI;
  }
}
