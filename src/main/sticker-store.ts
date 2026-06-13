import type { Sticker } from '../shared/types';
import type { FileSystem } from './file-system';
import type { SyncEngine } from './sync-engine';
import { scheduleCloudUpload } from './write-coordinator';
const STICKERS_PATH = '.merkaba/stickers.json';

interface StickerData {
  version: 1;
  stickers: Sticker[];
}

function emptyStore(): StickerData {
  return { version: 1, stickers: [] };
}

function randomPinX(): number {
  return 38 + Math.floor(Math.random() * 24);
}

function randomRotation(): number {
  return Math.floor(Math.random() * 11) - 5;
}

function randomPosition(index: number): { x: number; y: number } {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: 24 + col * 190 + Math.floor(Math.random() * 24),
    y: 24 + row * 170 + Math.floor(Math.random() * 20),
  };
}

function normalizeSticker(sticker: Sticker, index: number): Sticker {
  const hasPos = typeof sticker.x === 'number' && typeof sticker.y === 'number';
  const pos = hasPos ? { x: sticker.x, y: sticker.y } : randomPosition(index);
  return { ...sticker, x: pos.x, y: pos.y };
}

export class StickerStore {
  constructor(
    private fs: FileSystem,
    private sync: () => SyncEngine
  ) {}

  private async read(): Promise<StickerData> {
    try {
      const raw = await this.fs.readFile(STICKERS_PATH);
      const parsed = JSON.parse(raw) as StickerData;
      if (!parsed.stickers || !Array.isArray(parsed.stickers)) return emptyStore();
      return parsed;
    } catch {
      return emptyStore();
    }
  }

  private async write(data: StickerData): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await this.fs.writeFile(STICKERS_PATH, content);
    scheduleCloudUpload(STICKERS_PATH, content);
  }
  async getAll(): Promise<Sticker[]> {
    const data = await this.read();
    const normalized = data.stickers.map((s, i) => normalizeSticker(s, i));
    const needsSave = normalized.some((s, i) => s.x !== data.stickers[i]?.x || s.y !== data.stickers[i]?.y);
    if (needsSave) {
      await this.write({ ...data, stickers: normalized });
    }
    return normalized.sort((a, b) => b.modified.localeCompare(a.modified));
  }

  async create(input?: Partial<Pick<Sticker, 'title' | 'content' | 'color' | 'x' | 'y' | 'linkedNotePath'>>): Promise<Sticker> {
    const data = await this.read();
    const now = new Date().toISOString();
    const pos = input?.x != null && input?.y != null
      ? { x: input.x, y: input.y }
      : randomPosition(data.stickers.length);
    const sticker: Sticker = {
      id: `sticker-${Date.now()}`,
      title: input?.title?.trim() || 'Новый стикер',
      content: input?.content?.trim() || '',
      color: input?.color ?? Math.floor(Math.random() * 6),
      rotation: randomRotation(),
      pinX: randomPinX(),
      x: pos.x,
      y: pos.y,
      linkedNotePath: input?.linkedNotePath ?? null,
      created: now,
      modified: now,
    };
    data.stickers.push(sticker);
    await this.write(data);
    return sticker;
  }

  async update(
    id: string,
    patch: Partial<Pick<Sticker, 'title' | 'content' | 'color' | 'rotation' | 'pinX' | 'x' | 'y' | 'linkedNotePath'>>
  ): Promise<Sticker> {
    const data = await this.read();
    const index = data.stickers.findIndex((s) => s.id === id);
    if (index === -1) throw new Error('Стикер не найден');

    const sticker = {
      ...data.stickers[index],
      ...patch,
      title: patch.title !== undefined ? patch.title.trim() : data.stickers[index].title,
      content: patch.content !== undefined ? patch.content : data.stickers[index].content,
      linkedNotePath:
        patch.linkedNotePath !== undefined
          ? patch.linkedNotePath || null
          : data.stickers[index].linkedNotePath ?? null,
      modified: new Date().toISOString(),
    };
    data.stickers[index] = sticker;
    await this.write(data);
    return sticker;
  }

  async delete(id: string): Promise<void> {
    const data = await this.read();
    data.stickers = data.stickers.filter((s) => s.id !== id);
    await this.write(data);
  }
}
