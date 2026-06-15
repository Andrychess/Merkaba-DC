export const YANDEX_OAUTH_URL = 'https://oauth.yandex.ru';
export const YANDEX_DISK_API = 'https://cloud-api.yandex.net/v1/disk';
export const YANDEX_REDIRECT_URI = 'https://oauth.yandex.ru/verification_code';
// Корневая папка на Яндекс.Диске (нужны права disk.read + disk.write)
export const YANDEX_CLOUD_ROOT = 'disk:/Merkaba';
// Не передаём scope в URL — Яндекс использует права, указанные при регистрации приложения.
// Явный scope может вызвать ошибку, если он не совпадает с зарегистрированными.
export const YANDEX_SCOPES = '';

export interface YandexCredentials {
  clientId: string;
  clientSecret: string;
}

export interface YandexTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  login?: string;
}

export interface DiskResource {
  name: string;
  path: string;
  type: 'file' | 'dir';
  modified?: string;
  md5?: string;
  size?: number;
  _embedded?: {
    items: DiskResource[];
  };
}

export interface SyncStatus {
  syncing: boolean;
  lastSync: string | null;
  error: string | null;
  pendingCount?: number;
  progress?: number;
  progressLabel?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  login?: string;
}

export interface VaultInitResult {
  rootPath: string;
  isNew: boolean;
  synced: boolean;
}
