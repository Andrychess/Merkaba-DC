import { app, BrowserWindow, Menu } from 'electron';
import { configureAppPaths, ensureSingleInstance } from './app-paths';
import { createWindow } from './window';
import { registerIpcHandlers } from './ipc-handlers';
import { applyAppIcon } from './app-icon';
import { syncBeforeExit, isAppQuitting, markAppQuitting } from './app-shutdown';

let mainWindow: BrowserWindow | null = null;

configureAppPaths();

if (process.platform === 'win32') {
  app.setAppUserModelId('com.merkaba.desktop');
}

const isPrimaryInstance = ensureSingleInstance(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

if (isPrimaryInstance) {
  app.whenReady().then(async () => {
    applyAppIcon();
    Menu.setApplicationMenu(null);
    mainWindow = createWindow();
    registerIpcHandlers(mainWindow);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    app.on('before-quit', (event) => {
      if (isAppQuitting()) return;
      event.preventDefault();
      markAppQuitting();
      void syncBeforeExit().finally(() => {
        app.quit();
      });
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
        registerIpcHandlers(mainWindow);
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
