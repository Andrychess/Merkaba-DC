import { getValidAccessToken } from './yandex-oauth';
import { YANDEX_DISK_API, YANDEX_CLOUD_ROOT, type DiskResource } from '../shared/yandex';

function isDiskNotFoundError(err: unknown): boolean {
  const msg = String(err);
  return msg.includes('404') && (msg.includes('DiskNotFoundError') || msg.includes('Resource not found'));
}

export { isDiskNotFoundError };

function isDiskPathExistsError(err: unknown): boolean {
  const msg = String(err);
  return (
    msg.includes('409') &&
    (msg.includes('DiskPathPointsToExistentDirectoryError') ||
      msg.includes('DiskResourceAlreadyExistsError') ||
      msg.includes('уже существует'))
  );
}

export class YandexDiskApi {
  private knownFolders = new Set<string>();

  resetFolderCache(): void {
    this.knownFolders.clear();
  }

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
    if (this.knownFolders.has(cloudPath)) return;
    if (await this.exists(cloudPath)) {
      this.knownFolders.add(cloudPath);
      return;
    }
    try {
      await this.request(
        `${YANDEX_DISK_API}/resources?path=${encodeURIComponent(cloudPath)}`,
        { method: 'PUT' }
      );
    } catch (err) {
      // Параллельные загрузки могут одновременно создавать одну папку
      if (!isDiskPathExistsError(err)) throw err;
    }
    this.knownFolders.add(cloudPath);
  }

  /** Список содержимого папки; отсутствующая папка — пустой список */
  async listFolder(cloudPath: string): Promise<DiskResource[]> {
    const limit = 1000;
    let offset = 0;
    const items: DiskResource[] = [];

    while (true) {
      let data: DiskResource;
      try {
        data = await this.request<DiskResource>(
          `${YANDEX_DISK_API}/resources?path=${encodeURIComponent(cloudPath)}&limit=${limit}&offset=${offset}&fields=_embedded.items.name,_embedded.items.path,_embedded.items.type,_embedded.items.modified,_embedded.items.md5,_embedded.items.size`
        );
      } catch (err) {
        if (offset === 0 && isDiskNotFoundError(err)) return [];
        throw err;
      }

      const batch = data._embedded?.items ?? [];
      items.push(...batch);

      if (batch.length < limit) break;
      offset += limit;
    }

    return items;
  }

  /** Рекурсивный список всех файлов под cloudPath (подпапки — параллельно) */
  async listAllFiles(cloudPath: string): Promise<DiskResource[]> {
    const items = await this.listFolder(cloudPath);
    const files: DiskResource[] = [];
    const subdirs: DiskResource[] = [];

    for (const item of items) {
      if (item.type === 'file') {
        files.push(item);
      } else if (item.type === 'dir') {
        subdirs.push(item);
      }
    }

    if (subdirs.length === 0) return files;

    const nested = await Promise.all(
      subdirs.map(async (dir) => {
        try {
          return await this.listAllFiles(dir.path);
        } catch (err) {
          if (isDiskNotFoundError(err)) return [];
          throw err;
        }
      })
    );
    for (const batch of nested) {
      files.push(...batch);
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
