import { shell } from 'electron';
import { loadYandexCredentials } from './yandex-config';
import { saveAuth, loadAuth } from './auth-store';
import {
  YANDEX_OAUTH_URL,
  YANDEX_REDIRECT_URI,
  YANDEX_SCOPES,
  type YandexTokenData,
} from '../shared/yandex';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface YandexUserInfo {
  login: string;
  display_name?: string;
}

/** Открыть браузер для авторизации через Яндекс */
export async function startYandexAuth(): Promise<string> {
  const { clientId } = loadYandexCredentials();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: YANDEX_REDIRECT_URI,
  });

  // scope передаём только если явно задан — иначе берутся права из настроек приложения
  if (YANDEX_SCOPES) {
    params.set('scope', YANDEX_SCOPES);
  }

  const url = `${YANDEX_OAUTH_URL}/authorize?${params.toString()}`;
  await shell.openExternal(url);
  return url;
}

/** Обмен кода подтверждения на токены */
export async function exchangeAuthCode(code: string): Promise<YandexTokenData> {
  const { clientId, clientSecret } = loadYandexCredentials();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code.trim(),
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: YANDEX_REDIRECT_URI,
  });

  const response = await fetch(`${YANDEX_OAUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ошибка авторизации: ${err}`);
  }

  const data = (await response.json()) as TokenResponse;
  const login = await fetchYandexLogin(data.access_token);

  const tokenData: YandexTokenData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    login,
  };

  await saveAuth(tokenData);
  return tokenData;
}

/** Обновление access token */
export async function refreshAccessToken(): Promise<YandexTokenData> {
  const auth = await loadAuth();
  if (!auth?.refreshToken) {
    throw new Error('Нет сохранённой сессии. Войдите заново.');
  }

  const { clientId, clientSecret } = loadYandexCredentials();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(`${YANDEX_OAUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Не удалось обновить токен: ${err}`);
  }

  const data = (await response.json()) as TokenResponse;
  const tokenData: YandexTokenData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || auth.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    login: auth.login,
  };

  await saveAuth(tokenData);
  return tokenData;
}

/** Получить валидный access token (с автообновлением) */
export async function getValidAccessToken(): Promise<string> {
  const auth = await loadAuth();
  if (!auth) {
    throw new Error('Не авторизован');
  }

  // Обновляем за 5 минут до истечения
  if (Date.now() >= auth.expiresAt - 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken();
    return refreshed.accessToken;
  }

  return auth.accessToken;
}

async function fetchYandexLogin(accessToken: string): Promise<string | undefined> {
  try {
    const response = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${accessToken}` },
    });
    if (!response.ok) return undefined;
    const info = (await response.json()) as YandexUserInfo;
    return info.login;
  } catch {
    return undefined;
  }
}

export async function getAuthStatus(): Promise<{ authenticated: boolean; login?: string }> {
  const auth = await loadAuth();
  if (!auth?.accessToken) {
    return { authenticated: false };
  }
  return { authenticated: true, login: auth.login };
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  interval: number;
  expires_in: number;
}

/** Проверка: существует ли client_id на серверах Яндекса */
export async function validateClientId(clientId: string): Promise<{ valid: boolean; error?: string }> {
  const body = new URLSearchParams({
    client_id: clientId.trim(),
    device_name: 'Merkaba',
  });

  const response = await fetch(`${YANDEX_OAUTH_URL}/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (response.ok) return { valid: true };

  const err = await response.json().catch(() => ({})) as { error?: string; error_description?: string };
  return {
    valid: false,
    error: err.error_description || err.error || `HTTP ${response.status}`,
  };
}

/** Device Code flow — не требует Redirect URI */
export async function startDeviceAuth(): Promise<{
  userCode: string;
  verificationUrl: string;
  deviceCode: string;
  interval: number;
}> {
  const { clientId } = loadYandexCredentials();
  const body = new URLSearchParams({
    client_id: clientId,
    device_name: 'Merkaba Desktop',
  });

  const response = await fetch(`${YANDEX_OAUTH_URL}/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Яндекс не принял ClientID: ${err}`);
  }

  const data = (await response.json()) as DeviceCodeResponse;
  await shell.openExternal(data.verification_url);

  return {
    userCode: data.user_code,
    verificationUrl: data.verification_url,
    deviceCode: data.device_code,
    interval: data.interval,
  };
}

/** Ожидание подтверждения device code (polling) */
export async function pollDeviceToken(deviceCode: string): Promise<YandexTokenData> {
  const { clientId, clientSecret } = loadYandexCredentials();

  const body = new URLSearchParams({
    grant_type: 'device_code',
    code: deviceCode,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(`${YANDEX_OAUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    if (data.error === 'authorization_pending') {
      throw new Error('authorization_pending');
    }
    throw new Error(data.error_description || data.error || 'Ошибка получения токена');
  }

  const token = data as TokenResponse;
  const login = await fetchYandexLogin(token.access_token);

  const tokenData: YandexTokenData = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    login,
  };

  await saveAuth(tokenData);
  return tokenData;
}

/** Сохранить OAuth-токен, полученный вручную с oauth.yandex.ru */
export async function saveManualToken(accessToken: string): Promise<YandexTokenData> {
  const login = await fetchYandexLogin(accessToken.trim());
  if (!login) {
    throw new Error('Токен недействителен. Получите новый на oauth.yandex.ru');
  }

  const tokenData: YandexTokenData = {
    accessToken: accessToken.trim(),
    refreshToken: '',
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    login,
  };

  await saveAuth(tokenData);
  return tokenData;
}
