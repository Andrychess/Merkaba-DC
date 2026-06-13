import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import type { YandexTokenData } from '../shared/yandex';

const AUTH_FILE = 'auth.json';

function authPath(): string {
  return path.join(app.getPath('userData'), AUTH_FILE);
}

export async function saveAuth(data: YandexTokenData): Promise<void> {
  await fs.writeFile(authPath(), JSON.stringify(data, null, 2), 'utf-8');
}

export async function loadAuth(): Promise<YandexTokenData | null> {
  try {
    const raw = await fs.readFile(authPath(), 'utf-8');
    return JSON.parse(raw) as YandexTokenData;
  } catch {
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  try {
    await fs.unlink(authPath());
  } catch {
    // уже удалён
  }
}

export function getLocalVaultPath(): string {
  return path.join(app.getPath('userData'), 'vault');
}
