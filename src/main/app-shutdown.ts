import { ipcMain, type BrowserWindow } from 'electron';
import { getAuthStatus } from './yandex-oauth';
import { flushAllCloudUploads, rebuildSearchNow } from './write-coordinator';
import type { SyncEngine } from './sync-engine';

const SHUTDOWN_TIMEOUT_MS = 12_000;

let getMainWindow: (() => BrowserWindow | null) | null = null;
let getSyncEngine: (() => SyncEngine | null) | null = null;
let sendStatus: ((message: string) => void) | null = null;
let shutdownPromise: Promise<void> | null = null;
let shutdownDone = false;
let isQuitting = false;

export function bindAppShutdown(deps: {
  getMainWindow: () => BrowserWindow | null;
  getSyncEngine: () => SyncEngine | null;
  onStatus: (message: string) => void;
}): void {
  getMainWindow = deps.getMainWindow;
  getSyncEngine = deps.getSyncEngine;
  sendStatus = deps.onStatus;
}

function waitForRendererReady(win: BrowserWindow): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, SHUTDOWN_TIMEOUT_MS);
    const done = () => {
      clearTimeout(timeout);
      ipcMain.removeListener('app:shutdown-ready', onReady);
      resolve();
    };
    const onReady = () => done();
    ipcMain.once('app:shutdown-ready', onReady);
    win.webContents.send('app:prepare-shutdown');
  });
}

async function runSyncBeforeExit(): Promise<void> {
  const auth = await getAuthStatus();
  const syncEngine = getSyncEngine?.() ?? null;
  if (!auth.authenticated || !syncEngine) return;

  sendStatus?.('Синхронизация перед выходом...');

  const win = getMainWindow?.() ?? null;
  if (win && !win.isDestroyed()) {
    await waitForRendererReady(win);
  }

  try {
    await flushAllCloudUploads();
    await syncEngine.runPullSync(async () => {
      await syncEngine.ensureCloudStructure();
    });
    await rebuildSearchNow();
    sendStatus?.('Синхронизировано');
  } catch (err) {
    sendStatus?.(`Ошибка синхронизации: ${err}`);
  }
}

/** Сохранить заметки в renderer и синхронизировать с Диском перед закрытием. */
export function syncBeforeExit(): Promise<void> {
  if (shutdownDone) return Promise.resolve();
  if (!shutdownPromise) {
    shutdownPromise = runSyncBeforeExit()
      .then(() => {
        shutdownDone = true;
      })
      .finally(() => {
        shutdownPromise = null;
      });
  }
  return shutdownPromise;
}

export function markAppQuitting(): void {
  isQuitting = true;
}

export function isAppQuitting(): boolean {
  return isQuitting;
}

export function resetShutdownState(): void {
  shutdownDone = false;
  shutdownPromise = null;
  isQuitting = false;
}
