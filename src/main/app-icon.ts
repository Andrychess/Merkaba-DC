import { app, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';

function tryLoadIcon(iconPath: string): Electron.NativeImage | undefined {
  if (!fs.existsSync(iconPath)) return undefined;
  const image = nativeImage.createFromPath(iconPath);
  return image.isEmpty() ? undefined : image;
}

/** Пути к иконке приложения (PNG предпочтительнее SVG на Windows). */
export function resolveAppIconPaths(): string[] {
  const baseDirs = [
    path.join(__dirname, '../renderer'),
    path.join(__dirname, '../../src/renderer/public'),
    path.join(process.resourcesPath, 'icons'),
    path.join(app.getAppPath(), 'build'),
  ];

  const names = ['icon.png', 'icon.svg'];
  const paths: string[] = [];

  for (const dir of baseDirs) {
    for (const name of names) {
      paths.push(path.join(dir, name));
    }
  }

  return paths;
}

export function loadAppIcon(): Electron.NativeImage | undefined {
  for (const iconPath of resolveAppIconPaths()) {
    const image = tryLoadIcon(iconPath);
    if (image) return image;
  }
  return undefined;
}

export function applyAppIcon(): void {
  const icon = loadAppIcon();
  if (!icon) return;

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon);
  }
}
