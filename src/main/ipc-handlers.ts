import { ipcMain, dialog, type BrowserWindow } from 'electron';
import fs from 'fs';
import { type FileSystem, updateModified } from './file-system';
import { ConfigManager } from './config';
import { SearchIndexer } from './indexer';
import { ConflictDetector, toggleCheckboxInFile } from './conflict-detector';
import { StickerStore } from './sticker-store';
import { PinnedStore } from './pinned-store';
import { archiveFile, archiveFolder, clearArchive } from './archive-ops';
import { ARCHIVE_FOLDER, isArchivePath, isProtectedPath } from '../shared/archive';
import { SyncEngine, initLocalFileSystem } from './sync-engine';
import {
  flushAllCloudUploads,
  getPendingUploadPaths,
  initWriteCoordinator,
  rebuildSearchNow,
  scheduleCloudUpload,
  scheduleSearchRebuild,
} from './write-coordinator';
import {
  startYandexAuth,
  startDeviceAuth,
  pollDeviceToken,
  exchangeAuthCode,
  getAuthStatus,
  validateClientId,
  saveManualToken,
} from './yandex-oauth';
import { clearAuth as clearYandexAuth, initVaultPath } from './auth-store';
import { saveYandexCredentials, getCredentialsInfo } from './yandex-config';
import { bindAppShutdown, markAppQuitting, resetShutdownState, syncBeforeExit } from './app-shutdown';
import type { AuthStatus, SyncStatus, VaultInitResult } from '../shared/yandex';

let fileSystem: FileSystem | null = null;
let configManager: ConfigManager | null = null;
let syncEngine: SyncEngine | null = null;
const searchIndexer = new SearchIndexer();
const conflictDetector = new ConflictDetector();
let watcher: fs.FSWatcher | null = null;
let mainWindow: BrowserWindow | null = null;

function getStickerStore(): StickerStore {
  return new StickerStore(getFs(), getSync);
}

function getPinnedStore(): PinnedStore {
  return new PinnedStore(getFs(), getSync);
}

function sendStatus(message: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status:message', message);
  }
}

function getFs(): FileSystem {
  if (!fileSystem) throw new Error('Хранилище не инициализировано');
  return fileSystem;
}

function getConfigManager(): ConfigManager {
  if (!configManager) throw new Error('Конфиг не инициализирован');
  return configManager;
}

function getSync(): SyncEngine {
  if (!syncEngine) throw new Error('Синхронизация не инициализирована');
  return syncEngine;
}

async function rebuildAll(): Promise<void> {
  await rebuildSearchNow();
}

function initWritePipeline(): void {
  initWriteCoordinator({
    getSync,
    getFs,
    searchIndexer,
  });
}

function startWatcher(rootPath: string): void {
  if (watcher) watcher.close();

  watcher = fs.watch(rootPath, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const normalized = filename.replace(/\\/g, '/');
    const isStickers = normalized.includes('stickers.json');
    const isPinned = normalized.includes('pinned.json');
    if (normalized.includes('.merkaba') && !isStickers && !isPinned && !normalized.includes('config.json')) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('fs:changed', _event, filename);
    }
    scheduleSearchRebuild();
  });
}

function notifyFsChanged(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('fs:changed', 'sync', '');
  }
}

const AUTO_SYNC_INTERVAL_MS = 60_000;

function applyAutoSyncPolicy(config: Config): void {
  if (!syncEngine) return;
  syncEngine.stopPeriodicSync();
  if (config.autoSync) {
    syncEngine.startPeriodicSync(AUTO_SYNC_INTERVAL_MS, flushAllCloudUploads);
  }
}

async function initVaultLocalFirst(): Promise<VaultInitResult> {
  await initVaultPath();
  syncEngine = new SyncEngine(sendStatus);
  const { isNew } = await syncEngine.initializeLocal();

  const localRoot = syncEngine.getLocalRoot();
  fileSystem = await initLocalFileSystem();
  configManager = new ConfigManager(localRoot);
  const config = await configManager.load();
  const merged = await configManager.set({ ...config, rootPath: localRoot });

  syncEngine.bindAutoSync(() => getConfigManager().get().autoSync);

  initWritePipeline();
  scheduleSearchRebuild();
  startWatcher(localRoot);
  applyAutoSyncPolicy(merged);

  return { rootPath: localRoot, isNew, synced: false };
}

export function registerIpcHandlers(win: BrowserWindow): void {
  mainWindow = win;
  bindAppShutdown({
    getMainWindow: () => mainWindow,
    getSyncEngine: () => syncEngine,
    onStatus: sendStatus,
  });

  // --- Яндекс OAuth и синхронизация ---

  ipcMain.handle('auth:status', async (): Promise<AuthStatus> => {
    return getAuthStatus();
  });

  ipcMain.handle('auth:credentialsInfo', async () => {
    return getCredentialsInfo();
  });

  ipcMain.handle('auth:saveCredentials', async (_, clientId: string, clientSecret: string) => {
    saveYandexCredentials({ clientId, clientSecret });
    const validation = await validateClientId(clientId);
    if (!validation.valid) {
      throw new Error(
        `Яндекс не находит это приложение: ${validation.error}. Создайте новое на oauth.yandex.ru/client/new`
      );
    }
    return getCredentialsInfo();
  });

  ipcMain.handle('auth:start', async () => {
    return startYandexAuth();
  });

  ipcMain.handle('auth:startDevice', async () => {
    return startDeviceAuth();
  });

  ipcMain.handle('auth:pollDevice', async (_, deviceCode: string) => {
    try {
      await pollDeviceToken(deviceCode);
      return { done: true, ...(await getAuthStatus()) };
    } catch (err) {
      if (String(err).includes('authorization_pending')) {
        return { done: false, pending: true };
      }
      throw err;
    }
  });

  ipcMain.handle('auth:saveToken', async (_, token: string) => {
    await saveManualToken(token);
    return getAuthStatus();
  });

  ipcMain.handle('auth:exchange', async (_, code: string) => {
    await exchangeAuthCode(code);
    return getAuthStatus();
  });

  ipcMain.handle('auth:logout', async () => {
    await syncBeforeExit();
    syncEngine?.stopPeriodicSync();
    await clearYandexAuth();
    fileSystem = null;
    configManager = null;
    syncEngine = null;
    resetShutdownState();
    if (watcher) {
      watcher.close();
      watcher = null;
    }
  });

  ipcMain.handle('sync:status', async (): Promise<SyncStatus> => {
    return syncEngine?.getStatus() ?? { syncing: false, lastSync: null, error: null };
  });

  ipcMain.handle('sync:fileStatuses', async () => {
    if (!syncEngine) return {};
    return syncEngine.getFileSyncStatuses(getPendingUploadPaths());
  });

  ipcMain.handle('sync:failedOps', async () => {
    if (!syncEngine) return [];
    return syncEngine.getFailedOps();
  });

  ipcMain.handle('sync:pull', async () => {
    await getSync().runPullSync(async () => {
      getSync().reportProgress(2, 'Отправка локальных правок...');
      await flushAllCloudUploads();
      getSync().reportProgress(6, 'Проверка структуры на Диске...');
      await getSync().ensureCloudStructure();
    });
    await rebuildSearchNow();
    notifyFsChanged();
  });

  ipcMain.handle('sync:retryFailed', async (_, paths?: string[]) => {
    await getSync().retryFailed(paths);
    await getSync().syncAll();
    return getSync().getStatus().failedCount ?? 0;
  });

  ipcMain.handle('vault:initCloud', async (): Promise<VaultInitResult> => {
    return initVaultLocalFirst();
  });

  ipcMain.handle('session:restore', async (): Promise<VaultInitResult | null> => {
    const auth = await getAuthStatus();
    if (!auth.authenticated) return null;
    try {
      return await initVaultLocalFirst();
    } catch {
      return null;
    }
  });

  // --- Файловые операции (локальный кэш + push в облако) ---

  ipcMain.handle('fs:readFile', async (_, relativePath: string) => {
    return getFs().readFile(relativePath);
  });

  ipcMain.handle('fs:writeFile', async (_, relativePath: string, content: string) => {
    const updated = updateModified(content);
    await getFs().writeFile(relativePath, updated);
    scheduleCloudUpload(relativePath, updated);
    scheduleSearchRebuild();
    return updated;
  });

  ipcMain.handle('fs:deleteFile', async (_, relativePath: string) => {
    if (isProtectedPath(relativePath) || isArchivePath(relativePath)) {
      throw new Error('Этот элемент нельзя архивировать');
    }
    const archivePath = await archiveFile(getFs(), relativePath);
    await getPinnedStore().removePath(relativePath);
    await getSync().pushRenameOrQueue(relativePath, archivePath);
    await rebuildAll();
    return { archivePath, mdFiles: [relativePath] };
  });

  ipcMain.handle('fs:deleteFolder', async (_, relativePath: string) => {
    if (relativePath === ARCHIVE_FOLDER || isArchivePath(relativePath)) {
      throw new Error('Эту папку нельзя архивировать');
    }
    const mdFiles = await getFs().listMdFilesInFolder(relativePath);
    const archivePath = await archiveFolder(getFs(), relativePath);
    await getPinnedStore().removePath(relativePath);
    await getSync().pushRenameOrQueue(relativePath, archivePath);
    await rebuildAll();
    return { archivePath, mdFiles };
  });

  ipcMain.handle('fs:moveItem', async (_, itemPath: string, targetFolderPath: string) => {
    if (itemPath === ARCHIVE_FOLDER) {
      throw new Error('Нельзя переместить архив');
    }
    const newPath = await getFs().moveItem(itemPath, targetFolderPath);
    await getPinnedStore().remapPath(itemPath, newPath);
    await getSync().pushRenameOrQueue(itemPath, newPath);
    await rebuildAll();
    return newPath;
  });

  ipcMain.handle('fs:renameFile', async (_, oldPath: string, newPath: string) => {
    await getFs().renameFile(oldPath, newPath);
    await getPinnedStore().remapPath(oldPath, newPath);
    await getSync().pushRenameOrQueue(oldPath, newPath);
    scheduleSearchRebuild();
  });

  ipcMain.handle('fs:createFolder', async (_, relativePath: string) => {
    await getFs().createFolder(relativePath);
    void getSync().pushFolderOrQueue(relativePath).catch(() => {
      // папка подтянется при следующей синхронизации
    });
    scheduleSearchRebuild();
  });

  ipcMain.handle('fs:createNote', async (_, folderPath: string, name: string, noteType?: string) => {
    const { path: notePath, content } = await getFs().createNote(folderPath, name, noteType);
    scheduleCloudUpload(notePath, content);
    scheduleSearchRebuild();
    return notePath;
  });

  ipcMain.handle('fs:getFileTree', async (_, options?: { withMeta?: boolean }) => {
    return getFs().getFileTree(options);
  });

  ipcMain.handle('fs:getArchiveTree', async (_, options?: { withMeta?: boolean }) => {
    return getFs().getArchiveTree(options);
  });

  ipcMain.handle('fs:clearArchive', async () => {
    const mdFiles = await clearArchive(getFs());
    for (const file of mdFiles) {
      await getPinnedStore().removePath(file);
    }
    await getSync().clearArchiveRemoteOrQueue();
    await rebuildAll();
    notifyFsChanged();
    return { mdFiles };
  });

  ipcMain.handle('pinned:get', async () => {
    return getPinnedStore().getAll();
  });

  ipcMain.handle('pinned:pin', async (_, filePath: string) => {
    return getPinnedStore().pin(filePath);
  });

  ipcMain.handle('pinned:unpin', async (_, filePath: string) => {
    return getPinnedStore().unpin(filePath);
  });

  ipcMain.handle('search:query', async (_, query: string) => {
    return searchIndexer.search(query);
  });

  ipcMain.handle('search:rebuild', async () => {
    await rebuildAll();
  });

  ipcMain.handle('stickers:get', async () => {
    return getStickerStore().getAll();
  });

  ipcMain.handle('stickers:create', async (_, input) => {
    return getStickerStore().create(input);
  });

  ipcMain.handle('stickers:update', async (_, id: string, patch) => {
    return getStickerStore().update(id, patch);
  });

  ipcMain.handle('stickers:delete', async (_, id: string) => {
    await getStickerStore().delete(id);
  });

  ipcMain.handle('tasks:toggle', async (_, filePath: string, line: number) => {
    await toggleCheckboxInFile(getFs(), filePath, line);
    const content = await getFs().readFile(filePath);
    scheduleCloudUpload(filePath, content);
    scheduleSearchRebuild();
  });

  ipcMain.handle('config:get', async () => {
    return getConfigManager().get();
  });

  ipcMain.handle('config:set', async (_, partial: Partial<Config>) => {
    const updated = await getConfigManager().set(partial);
    applyAutoSyncPolicy(updated);
    try {
      await getSync().pushFileOrQueue('.merkaba/config.json', JSON.stringify(updated, null, 2));
    } catch {
      // очередь отложенных загрузок подхватит при следующем sync
    }
    return updated;
  });

  ipcMain.handle('conflicts:get', async () => {
    return conflictDetector.getConflicts(getFs());
  });

  ipcMain.handle('conflicts:resolve', async (_, file: string, choice: 'main' | 'conflict') => {
    const result = await conflictDetector.resolveConflict(getFs(), file, choice);
    if (result) {
      const sync = getSync();
      await sync.pushFileOrQueue(result.mainPath, result.content);
      await sync.pushDeleteOrQueue(result.conflictPath);
    }
    await rebuildAll();
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Выберите папку',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('window:setTitle', async (_, title: string) => {
    win.setTitle(title);
  });

  ipcMain.handle('window:setBackground', async (_, color: string) => {
    win.setBackgroundColor(color);
  });

  ipcMain.handle('window:minimize', () => {
    win.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle('window:close', async () => {
    await syncBeforeExit();
    markAppQuitting();
    win.close();
  });
}
