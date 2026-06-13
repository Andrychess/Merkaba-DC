import fs from 'fs/promises';
import path from 'path';
import type { FileNode } from '../shared/types';
import { ARCHIVE_FOLDER, isArchivePath } from '../shared/archive';
import { parseNote } from '../shared/frontmatter';
import { buildInitialBody, getDefaultTitle, inferNoteTypeFromBody, type NoteType } from '../shared/note-types';
import {
  getNoteDisplayTitle,
  getNotePreview,
  titleToFileName,
} from '../shared/note-heading';

const README_CONTENT = `# Merkaba

Личный блокнот с синхронизацией через Яндекс.Диск.

## Структура

- \`notes/\` — обычные заметки
- \`daily/\` — ежедневные записи
- \`projects/\` — проектные заметки
- \`attachments/\` — вложения (изображения и файлы)
- \`_archive/\` — архив удалённых заметок и папок

## Формат заметок

Заметки в формате Markdown с YAML frontmatter:

\`\`\`markdown
---
title: Название заметки
created: 2026-06-13T14:22:00+03:00
modified: 2026-06-13T15:30:00+03:00
tags: [тег1, тег2]
color: rose
---

# Название заметки

Текст заметки...

## Связанные заметки

- [[другая-заметка]]
\`\`\`
`;

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
    await fs.rename(this.fullPath(oldPath), this.fullPath(newPath));
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

  async getFileTree(): Promise<FileNode[]> {
    return this.scanDirectory('');
  }

  async getArchiveTree(): Promise<FileNode[]> {
    try {
      return await this.scanDirectory(ARCHIVE_FOLDER);
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

  private async scanDirectory(relativePath: string): Promise<FileNode[]> {
    const fullPath = this.fullPath(relativePath);
    let entries;
    try {
      entries = await fs.readdir(fullPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const nodes: FileNode[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (relativePath === '' && entry.name === ARCHIVE_FOLDER) continue;

      const entryPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: entryPath.replace(/\\/g, '/'),
          type: 'folder',
          children: await this.scanDirectory(entryPath),
        });
      } else if (entry.name.endsWith('.md')) {
        const meta = await this.readNoteTreeMeta(entryPath);
        const filePath = entryPath.replace(/\\/g, '/');
        nodes.push({
          name: entry.name.replace(/\.md$/, ''),
          path: filePath,
          type: 'file',
          color: meta.color,
          noteType: meta.noteType,
          title: meta.title,
          preview: meta.preview,
        });
      }
    }

    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, 'ru');
    });
  }

  private async readNoteTreeMeta(
    relativePath: string
  ): Promise<{ color: string | null; noteType: NoteType; title: string; preview: string }> {
    try {
      const content = await this.readFile(relativePath);
      const { meta, body } = parseNote(content);
      const noteType =
        meta.noteType !== 'text' ? meta.noteType : inferNoteTypeFromBody(body);
      const title = getNoteDisplayTitle(meta.title, body, relativePath);
      const preview = getNotePreview(body, noteType);
      return { color: meta.color, noteType, title, preview };
    } catch {
      const base = relativePath.split('/').pop()?.replace(/\.md$/i, '') ?? 'Заметка';
      return { color: null, noteType: 'text', title: base, preview: '' };
    }
  }

  /** Создание структуры папок Merkaba при первом запуске */
  static async initializeVault(yandexPath: string): Promise<{ rootPath: string; isNew: boolean }> {
    const rootPath = path.join(yandexPath, 'Merkaba');
    let isNew = false;

    try {
      await fs.access(rootPath);
    } catch {
      isNew = true;
      await fs.mkdir(rootPath, { recursive: true });
      await fs.mkdir(path.join(rootPath, 'notes'), { recursive: true });
      await fs.mkdir(path.join(rootPath, 'daily'), { recursive: true });
      await fs.mkdir(path.join(rootPath, 'projects'), { recursive: true });
      await fs.mkdir(path.join(rootPath, 'attachments'), { recursive: true });
      await fs.mkdir(path.join(rootPath, '.merkaba'), { recursive: true });
      await fs.writeFile(path.join(rootPath, 'README.md'), README_CONTENT, 'utf-8');

      const welcomeNote = `---
title: Добро пожаловать в Merkaba
created: ${new Date().toISOString()}
modified: ${new Date().toISOString()}
tags: [приветствие]
---

# Добро пожаловать в Merkaba

Это ваша первая заметка. Начните писать!

## Возможности

- Редактирование Markdown
- Wiki-ссылки: [[README]]
- Чеклисты: - [ ] задача
- Поиск по всем заметкам
- Граф связей между заметками
`;
      await fs.writeFile(path.join(rootPath, 'notes', 'dobro-pozhalovat.md'), welcomeNote, 'utf-8');
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
    const fileBase =
      type === 'text'
        ? `${titleToFileName(title) || 'zametka'}-${Date.now()}`
        : FileSystem.sanitizeFileName(name);
    const sanitized = fileBase.endsWith('.md') ? fileBase.slice(0, -3) : fileBase;
    const fileName = `${sanitized}.md`;
    const relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;
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
