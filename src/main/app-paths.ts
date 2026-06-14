import path from 'path';
import { app } from 'electron';

/** Настройка путей до app.whenReady — избегает конфликтов кэша Chromium на Windows */
export function configureAppPaths(): void {
  const isDev = !app.isPackaged;

  if (isDev) {
    const devUserData = path.join(app.getPath('appData'), 'merkaba-desktop-dev');
    app.setPath('userData', devUserData);
    app.commandLine.appendSwitch(
      'disk-cache-dir',
      path.join(devUserData, 'chromium-cache')
    );
    app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  }
}

export function ensureSingleInstance(onSecondInstance: () => void): boolean {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return false;
  }

  app.on('second-instance', () => {
    onSecondInstance();
  });

  return true;
}
