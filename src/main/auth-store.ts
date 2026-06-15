import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import type { YandexTokenData } from '../shared/yandex';

const AUTH_FILE = 'auth.json';

function authPath(): string {
  return path.join(app.getPath('userData'), AUTH_FILE);
}

function legacyVaultPath(): string {
  return path.join(app.getPath('userData'), 'vault');
}

function sanitizeLogin(login: string): string {
  return login.replace(/[^a-zA-Z0-9@._-]/g, '_') || 'user';
}

function accountVaultPath(login: string): string {
  return path.join(app.getPath('userData'), 'vaults', sanitizeLogin(login));
}

let vaultPathCache: string | null = null;

export async function saveAuth(data: YandexTokenData): Promise<void> {
  await fs.writeFile(authPath(), JSON.stringify(data, null, 2), 'utf-8');
  vaultPathCache = null;
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
  vaultPathCache = null;
}

/** Выбирает vault для текущего аккаунта; при первом входе переносит старый `vault/` */
export async function initVaultPath(): Promise<string> {
  const auth = await loadAuth();
  if (!auth?.login) {
    vaultPathCache = legacyVaultPath();
    await fs.mkdir(vaultPathCache, { recursive: true });
    return vaultPathCache;
  }

  const target = accountVaultPath(auth.login);
  try {
    await fs.access(target);
  } catch {
    const legacy = legacyVaultPath();
    try {
      await fs.access(legacy);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.rename(legacy, target);
    } catch {
      await fs.mkdir(target, { recursive: true });
    }
  }

  vaultPathCache = target;
  return target;
}

export function getLocalVaultPath(): string {
  return vaultPathCache ?? legacyVaultPath();
}
