import fs from 'fs/promises';
import path from 'path';
import type { FileNode, TreeScanOptions } from '../shared/types';
import { ARCHIVE_FOLDER, isArchivePath } from '../shared/archive';
import { parseNote } from '../shared/frontmatter';
import { buildInitialBody, getDefaultTitle, inferNoteTypeFromBody, type NoteType } from '../shared/note-types';
import {
  getNoteDisplayTitle,
  getNotePreview,
  titleToFileName,
} from '../shared/note-heading';
import { mapPool } from './async-pool';

const META_SCAN_CONCURRENCY = 8;

export class FileSystem {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  getRootPath(): string {
    return this.rootPath;
  }

  setRootPath(rootPath: string): void {
    this.rootPath = rootPath;
  }

  fullPath(relativePath: string): string {
    return path.join(this.rootPath, relativePath);
  }

  async readFile(relativePath: string): Promise<string> {
    const content = await fs.readFile(this.fullPath(relativePath), 'utf-8');
    return content;
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const full = this.fullPath(relativePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content.replace(/\r\n/g, '\n'), 'utf-8');
  }

  async deleteFile(relativePath: string): Promise<void> {
    await fs.unlink(this.fullPath(relativePath));
  }

  async deleteFolder(relativePath: string): Promise<void> {
    await fs.rm(this.fullPath(relativePath), { recursive: true, force: true });
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const normalizedOld = oldPath.replace(/\\/g, '/');
    const normalizedNew = newPath.replace(/\\/g, '/');
    if (normalizedOld === normalizedNew) return;

    const oldFull = this.fullPath(normalizedOld);
    const newFull = this.fullPath(normalizedNew);

    let sourceExists = true;
    try {
      await fs.access(oldFull);
    } catch {
      sourceExists = false;
    }

    if (!sourceExists) {
      try {
        await fs.access(newFull);
        return;
      } catch {
        throw Object.assign(new Error(`ENOENT: no such file or directory, rename '${normalizedOld}' -> '${normalizedNew}'`), {
          code: 'ENOENT',
          errno: -4058,
          syscall: 'rename',
          path: oldFull,
          dest: newFull,
        });
      }
    }

    await fs.mkdir(path.dirname(newFull), { recursive: true });
    try {
      await fs.rename(oldFull, newFull);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        try {
          await fs.access(newFull);
          return;
        } catch {
          // fall through
        }
      }
      throw err;
    }
  }

  private async notePathExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(this.fullPath(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  private async allocateUniqueNotePath(folderPath: string, baseSlug: string): Promise<string> {
    let candidate = baseSlug;
    let suffix = 2;
    while (suffix < 100) {
      const relativePath = folderPath ? `${folderPath}/${candidate}.md` : `${candidate}.md`;
      if (!(await this.notePathExists(relativePath))) {
        return relativePath;
      }
      candidate = `${baseSlug}-${suffix}`;
      suffix++;
    }
    throw new Error('Слишком много заметок с таким именем');
  }

  /** Переместить файл или папку в целевую папку (пустая строка = корень) */
  async moveItem(itemPath: string, targetFolderPath: string): Promise<string> {
    const normalized = itemPath.replace(/\\/g, '/');
    const target = targetFolderPath.replace(/\\/g, '/');

    if (normalized === ARCHIVE_FOLDER) {
      throw new Error('Нельзя переместить архив');
    }
    if (target === ARCHIVE_FOLDER || target.startsWith(`${ARCHIVE_FOLDER}/`)) {
      throw new Error('Для архивации используйте «В архив»');
    }
    if (normalized === target || (target && target.startsWith(`${normalized}/`))) {
      throw new Error('Нельзя переместить элемент внутрь себя');
    }

    const parent = normalized.includes('/')
      ? normalized.slice(0, normalized.lastIndexOf('/'))
      : '';
    if (parent === target) {
      return normalized;
    }

    const baseName = path.basename(normalized);
    const newPath = target ? `${target}/${baseName}` : baseName;
    await this.renameFile(normalized, newPath);
    return newPath;
  }

  /** Все .md файлы внутри папки (рекурсивно), включая архив */
  async listAllMdFilesIn(relativePath: string): Promise<string[]> {
    const files: string[] = [];
    await this.collectAllMdInSubtree(relativePath, files);
    return files;
  }

  /** Все .md файлы внутри папки (рекурсивно) */
  async listMdFilesInFolder(folderPath: string): Promise<string[]> {
    const files: string[] = [];
    await this.collectMdFiles(folderPath, files);
    return files;
  }

  async createFolder(relativePath: string): Promise<void> {
    await fs.mkdir(this.fullPath(relativePath), { recursive: true });
  }

  async getFileTree(options?: TreeScanOptions): Promise<FileNode[]> {
    return this.scanDirectory('', options?.withMeta !== false);
  }

  async getArchiveTree(options?: TreeScanOptions): Promise<FileNode[]> {
    try {
      return await this.scanDirectory(ARCHIVE_FOLDER, options?.withMeta !== false);
    } catch {
      return [];
    }
  }

  async getAllMdFiles(): Promise<string[]> {
    const files: string[] = [];
    await this.collectMdFiles('', files);
    return files;
  }

  private async collectAllMdInSubtree(relativePath: string, files: string[]): Promise<void> {
    const fullPath = this.fullPath(relativePath);
    let entries;
    try {
      entries = await fs.readdir(fullPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const entryPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        await this.collectAllMdInSubtree(entryPath, files);
      } else if (entry.name.endsWith('.md')) {
        files.push(entryPath.replace(/\\/g, '/'));
      }
    }
  }

  private async collectMdFiles(relativePath: string, files: string[]): Promise<void> {
    const fullPath = this.fullPath(relativePath);
    let entries;
    try {
      entries = await fs.readdir(fullPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const entryPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
      const normalized = entryPath.replace(/\\/g, '/');

      if (entry.isDirectory()) {
        await this.collectMdFiles(entryPath, files);
      } else if (entry.name.endsWith('.md') && !isArchivePath(normalized)) {
        files.push(normalized);
      }
    }
  }

  private async scanDirectory(relativePath: string, withMeta = true): Promise<FileNode[]> {
    const fullPath = this.fullPath(relativePath);
    let entries;
    try {
      entries = await fs.readdir(fullPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const nodes: FileNode[] = [];
    const mdEntries: { entryPath: string; fileName: string }[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (relativePath === '' && entry.name === ARCHIVE_FOLDER) continue;

      const entryPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: entryPath.replace(/\\/g, '/'),
          type: 'folder',
          children: await this.scanDirectory(entryPath, withMeta),
        });
      } else if (entry.name.endsWith('.md')) {
        mdEntries.push({
          entryPath: entryPath.replace(/\\/g, '/'),
          fileName: entry.name,
        });
      }
    }

    if (mdEntries.length > 0) {
      if (!withMeta) {
        for (const { entryPath, fileName } of mdEntries) {
          nodes.push({
            name: fileName.replace(/\.md$/, ''),
            path: entryPath,
            type: 'file',
          });
        }
      } else {
        const fileNodes = await mapPool(
          mdEntries,
          async ({ entryPath, fileName }) => {
            const meta = await this.readNoteTreeMeta(entryPath);
            return {
              name: fileName.replace(/\.md$/, ''),
              path: entryPath,
              type: 'file' as const,
              color: meta.color,
              noteType: meta.noteType,
              title: meta.title,
              preview: meta.preview,
              tags: meta.tags,
            };
          },
          META_SCAN_CONCURRENCY
        );
        nodes.push(...fileNodes);
      }
    }

    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, 'ru');
    });
  }

  private async readNoteTreeMeta(
    relativePath: string
  ): Promise<{ color: string | null; noteType: NoteType; title: string; preview: string; tags: string[] }> {
    try {
      const content = await this.readFile(relativePath);
      const { meta, body } = parseNote(content);
      const noteType =
        meta.noteType !== 'text' ? meta.noteType : inferNoteTypeFromBody(body);
      const title = getNoteDisplayTitle(meta.title, body, relativePath);
      const preview = getNotePreview(body, noteType);
      return { color: meta.color, noteType, title, preview, tags: meta.tags };
    } catch {
      const base = relativePath.split('/').pop()?.replace(/\.md$/i, '') ?? 'Заметка';
      return { color: null, noteType: 'text', title: base, preview: '', tags: [] };
    }
  }

  /** Создание корня хранилища при первом запуске (legacy) */
  static async initializeVault(yandexPath: string): Promise<{ rootPath: string; isNew: boolean }> {
    const rootPath = path.join(yandexPath, 'Merkaba');
    let isNew = false;

    try {
      await fs.access(rootPath);
    } catch {
      isNew = true;
      await fs.mkdir(rootPath, { recursive: true });
      await fs.mkdir(path.join(rootPath, '.merkaba'), { recursive: true });
    }

    return { rootPath, isNew };
  }

  /** Валидация имени файла: буквы, цифры, дефисы, подчёркивания */
  static sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-zа-яё0-9_-]/gi, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async createNote(folderPath: string, name: string, noteType: string = 'text'): Promise<{ path: string; content: string }> {
    const type = noteType === 'drawing' || noteType === 'music' ? noteType : 'text';
    const title = type === 'text' ? name.trim() || 'Новая заметка' : getDefaultTitle(type, name);
    const relativePath =
      type === 'text'
        ? await this.allocateUniqueNotePath(folderPath, titleToFileName(title) || 'zametka')
        : folderPath
          ? `${folderPath}/${FileSystem.sanitizeFileName(name)}.md`
          : `${FileSystem.sanitizeFileName(name)}.md`;
    const now = new Date().toISOString();
    const body = buildInitialBody(type, title);
    const typeLine = type !== 'text' ? `type: ${type}\n` : '';

    const content = `---
title: ${title}
${typeLine}created: ${now}
modified: ${now}
tags: []
---

${body}`;

    await this.writeFile(relativePath, content);
    return { path: relativePath, content };
  }
}

/** Извлечение заголовка из frontmatter или первого H1 */
export function extractTitle(content: string): string | null {
  const fmMatch = content.match(/^---\s*\n[\s\S]*?title:\s*(.+?)\s*\n[\s\S]*?---/);
  if (fmMatch) return fmMatch[1].replace(/^["']|["']$/g, '').trim();

  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();

  return null;
}

/** Обновление поля modified в frontmatter */
export function updateModified(content: string): string {
  const now = new Date().toISOString();
  if (content.startsWith('---')) {
    if (/modified:\s*.+/m.test(content)) {
      return content.replace(/modified:\s*.+/m, `modified: ${now}`);
    }
    return content.replace(/^---\s*\n/, `---\nmodified: ${now}\n`);
  }
  return content;
}
