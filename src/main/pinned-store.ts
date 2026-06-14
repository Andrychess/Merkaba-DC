import type { FileSystem } from './file-system';
import type { SyncEngine } from './sync-engine';

const PINNED_PATH = '.merkaba/pinned.json';

interface PinnedData {
  version: 1;
  paths: string[];
}

function emptyStore(): PinnedData {
  return { version: 1, paths: [] };
}

export class PinnedStore {
  constructor(
    private fs: FileSystem,
    private sync: () => SyncEngine
  ) {}

  private async read(): Promise<PinnedData> {
    try {
      const raw = await this.fs.readFile(PINNED_PATH);
      const parsed = JSON.parse(raw) as PinnedData;
      if (!parsed.paths || !Array.isArray(parsed.paths)) return emptyStore();
      return parsed;
    } catch {
      return emptyStore();
    }
  }

  private async write(data: PinnedData): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await this.fs.writeFile(PINNED_PATH, content);
    await this.sync().pushFileOrQueue(PINNED_PATH, content);
  }

  private async filterExisting(paths: string[]): Promise<string[]> {
    const result: string[] = [];
    for (const p of paths) {
      try {
        await this.fs.readFile(p);
        result.push(p);
      } catch {
        // файл удалён или перемещён — пропускаем
      }
    }
    return result;
  }

  async getAll(): Promise<string[]> {
    const data = await this.read();
    const existing = await this.filterExisting(data.paths);
    if (existing.length !== data.paths.length) {
      await this.write({ ...data, paths: existing });
    }
    return existing;
  }

  async pin(filePath: string): Promise<string[]> {
    const normalized = filePath.replace(/\\/g, '/');
    const data = await this.read();
    if (!data.paths.includes(normalized)) {
      data.paths.unshift(normalized);
      await this.write(data);
    }
    return data.paths;
  }

  async unpin(filePath: string): Promise<string[]> {
    const normalized = filePath.replace(/\\/g, '/');
    const data = await this.read();
    data.paths = data.paths.filter((p) => p !== normalized);
    await this.write(data);
    return data.paths;
  }

  async remapPath(oldPath: string, newPath: string): Promise<void> {
    const oldNorm = oldPath.replace(/\\/g, '/');
    const newNorm = newPath.replace(/\\/g, '/');
    const data = await this.read();
    let changed = false;
    data.paths = data.paths.map((p) => {
      if (p === oldNorm) {
        changed = true;
        return newNorm;
      }
      if (p.startsWith(`${oldNorm}/`)) {
        changed = true;
        return `${newNorm}${p.slice(oldNorm.length)}`;
      }
      return p;
    });
    if (changed) await this.write(data);
  }

  async removePath(filePath: string): Promise<void> {
    const normalized = filePath.replace(/\\/g, '/');
    const data = await this.read();
    const next = data.paths.filter(
      (p) => p !== normalized && !p.startsWith(`${normalized}/`)
    );
    if (next.length !== data.paths.length) {
      await this.write({ ...data, paths: next });
    }
  }
}
