import { app, BrowserWindow, Menu } from 'electron';
import { createWindow } from './window';
import { registerIpcHandlers } from './ipc-handlers';
import { applyAppIcon } from './app-icon';

let mainWindow: BrowserWindow | null = null;

if (process.platform === 'win32') {
  app.setAppUserModelId('com.merkaba.desktop');
}

app.whenReady().then(async () => {
  applyAppIcon();  Menu.setApplicationMenu(null);
  mainWindow = createWindow();
  registerIpcHandlers(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
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
