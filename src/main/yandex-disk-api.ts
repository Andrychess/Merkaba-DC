import { getValidAccessToken } from './yandex-oauth';
import { YANDEX_DISK_API, YANDEX_CLOUD_ROOT, type DiskResource } from '../shared/yandex';

export class YandexDiskApi {
  private async headers(): Promise<Record<string, string>> {
    const token = await getValidAccessToken();
    return {
      Authorization: `OAuth ${token}`,
      Accept: 'application/json',
    };
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const hdrs = await this.headers();
    const response = await fetch(url, {
      ...init,
      headers: { ...hdrs, ...init?.headers },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Yandex Disk API ${response.status}: ${text}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  /** Проверить существование ресурса */
  async exists(cloudPath: string): Promise<boolean> {
    try {
      await this.request(`${YANDEX_DISK_API}/resources?path=${encodeURIComponent(cloudPath)}&fields=name`);
      return true;
    } catch {
      return false;
    }
  }

  /** Создать папку */
  async createFolder(cloudPath: string): Promise<void> {
    if (await this.exists(cloudPath)) return;
    await this.request(
      `${YANDEX_DISK_API}/resources?path=${encodeURIComponent(cloudPath)}`,
      { method: 'PUT' }
    );
  }

  /** Список содержимого папки */
  async listFolder(cloudPath: string): Promise<DiskResource[]> {
    const limit = 1000;
    let offset = 0;
    const items: DiskResource[] = [];

    while (true) {
      const data = await this.request<DiskResource>(
        `${YANDEX_DISK_API}/resources?path=${encodeURIComponent(cloudPath)}&limit=${limit}&offset=${offset}&fields=_embedded.items.name,_embedded.items.path,_embedded.items.type,_embedded.items.modified,_embedded.items.md5,_embedded.items.size`
      );

      const batch = data._embedded?.items ?? [];
      items.push(...batch);

      if (batch.length < limit) break;
      offset += limit;
    }

    return items;
  }

  /** Рекурсивный список всех файлов под cloudPath */
  async listAllFiles(cloudPath: string): Promise<DiskResource[]> {
    const files: DiskResource[] = [];
    const items = await this.listFolder(cloudPath);

    for (const item of items) {
      if (item.type === 'file') {
        files.push(item);
      } else if (item.type === 'dir') {
        const nested = await this.listAllFiles(item.path);
        files.push(...nested);
      }
    }

    return files;
  }

  /** Скачать файл как текст */
  async downloadText(cloudPath: string): Promise<string> {
    const meta = await this.request<{ href: string }>(
      `${YANDEX_DISK_API}/resources/download?path=${encodeURIComponent(cloudPath)}`
    );

    const response = await fetch(meta.href);
    if (!response.ok) {
      throw new Error(`Ошибка скачивания: ${response.status}`);
    }

    return response.text();
  }

  /** Создать все родительские папки для пути к файлу */
  async ensureParentFolders(cloudFilePath: string): Promise<void> {
    const normalized = cloudFilePath.replace(/\\/g, '/');
    const slash = normalized.lastIndexOf('/');
    if (slash <= 0) return;

    const dirPath = normalized.slice(0, slash);
    const relative = YandexDiskApi.toRelativePath(dirPath);
    if (!relative) {
      await this.createFolder(YANDEX_CLOUD_ROOT);
      return;
    }

    const parts = relative.split('/').filter(Boolean);
    let built = '';
    for (const part of parts) {
      built = built ? `${built}/${part}` : part;
      await this.createFolder(YandexDiskApi.toCloudPath(built));
    }
  }

  /** Загрузить текстовый файл */
  async uploadText(cloudPath: string, content: string): Promise<void> {
    await this.ensureParentFolders(cloudPath);

    const meta = await this.request<{ href: string }>(
      `${YANDEX_DISK_API}/resources/upload?path=${encodeURIComponent(cloudPath)}&overwrite=true`
    );

    const response = await fetch(meta.href, {
      method: 'PUT',
      body: content.replace(/\r\n/g, '\n'),
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

    if (!response.ok) {
      throw new Error(`Ошибка загрузки: ${response.status}`);
    }
  }

  /** Удалить ресурс */
  async delete(cloudPath: string): Promise<void> {
    await this.request(
      `${YANDEX_DISK_API}/resources?path=${encodeURIComponent(cloudPath)}&permanently=true`,
      { method: 'DELETE' }
    );
  }

  /** Удалить папку со всем содержимым */
  async deleteFolder(cloudPath: string): Promise<void> {
    if (await this.exists(cloudPath)) {
      await this.delete(cloudPath);
    }
  }

  /** Переместить/переименовать */
  async move(fromPath: string, toPath: string): Promise<void> {
    await this.request(
      `${YANDEX_DISK_API}/resources/move?from=${encodeURIComponent(fromPath)}&path=${encodeURIComponent(toPath)}&overwrite=true`,
      { method: 'POST' }
    );
  }

  /** Относительный путь → облачный путь */
  static toCloudPath(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/');
    return `${YANDEX_CLOUD_ROOT}/${normalized}`;
  }

  /** Облачный путь → относительный */
  static toRelativePath(cloudPath: string): string {
    const prefixes = [`${YANDEX_CLOUD_ROOT}/`, 'app:/', 'disk:/Merkaba/'];
    for (const prefix of prefixes) {
      if (cloudPath.startsWith(prefix)) {
        return cloudPath.slice(prefix.length);
      }
    }
    if (cloudPath === YANDEX_CLOUD_ROOT || cloudPath === 'app:/') return '';
    return cloudPath;
  }
}
