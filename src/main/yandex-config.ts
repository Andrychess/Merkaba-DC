import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { YandexCredentials } from '../shared/yandex';

function credentialsPath(): string {
  return path.join(app.getPath('userData'), 'yandex.credentials.json');
}

/** Загрузка OAuth-учётных данных приложения Яндекс */
export function loadYandexCredentials(): YandexCredentials {
  const candidates = [
    path.join(process.cwd(), 'yandex.credentials.json'),
    credentialsPath(),
  ];

  for (const filePath of candidates) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const clientId = String(data.clientId || '').trim();
      const clientSecret = String(data.clientSecret || '').trim();
      if (clientId && clientSecret) {
        return { clientId, clientSecret };
      }
    } catch {
      // пробуем следующий путь
    }
  }

  throw new Error(
    'Не найден yandex.credentials.json. Укажите ClientID и Client secret в настройках входа.'
  );
}

/** Сохранить учётные данные в userData */
export function saveYandexCredentials(credentials: YandexCredentials): void {
  const normalized = {
    clientId: credentials.clientId.trim(),
    clientSecret: credentials.clientSecret.trim(),
  };
  fs.mkdirSync(path.dirname(credentialsPath()), { recursive: true });
  fs.writeFileSync(credentialsPath(), JSON.stringify(normalized, null, 2), 'utf-8');
}

/** Информация о текущих credentials (без секрета) */
export function getCredentialsInfo(): { clientId: string; source: string } | null {
  const candidates = [
    { path: path.join(process.cwd(), 'yandex.credentials.json'), label: 'project' },
    { path: credentialsPath(), label: 'userData' },
  ];

  for (const { path: filePath, label } of candidates) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const clientId = String(data.clientId || '').trim();
      if (clientId) return { clientId, source: label };
    } catch {
      // next
    }
  }
  return null;
}
