import fs from 'fs/promises';
import path from 'path';
import type { ConflictFile } from '../shared/types';
import { composeNote, ensureNoteMeta, bodyLineToFileLine, parseNote } from '../shared/frontmatter';
import { toggleTaskLine } from '../shared/markdown-tasks';
import { type FileSystem } from './file-system';

export class ConflictDetector {
  async getConflicts(fs: FileSystem): Promise<ConflictFile[]> {
    const allFiles = await this.getAllFilesRecursive(fs);
    const conflicts: ConflictFile[] = [];

    for (const file of allFiles) {
      const lower = file.toLowerCase();
      if (lower.includes('конфликтная') || lower.includes('conflict')) {
        const mainPath = this.guessMainPath(file);
        if (mainPath && allFiles.includes(mainPath)) {
          conflicts.push({
            mainPath,
            conflictPath: file,
            mainContent: await fs.readFile(mainPath),
            conflictContent: await fs.readFile(file),
          });
        }
      }
    }

    return conflicts;
  }

  private async getAllFilesRecursive(fs: FileSystem): Promise<string[]> {
    const root = fs.getRootPath();
    const files: string[] = [];
    await this.walk(root, root, files);
    return files;
  }

  private async walk(dir: string, root: string, files: string[]): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(full, root, files);
      } else {
        files.push(path.relative(root, full).replace(/\\/g, '/'));
      }
    }
  }

  private guessMainPath(conflictPath: string): string | null {
    // Яндекс.Диск создаёт файлы вида "file (конфликтная копия от ...).md"
    const patterns = [
      /^(.+?)\s*\(конфликтная копия[^)]*\)(\.md)$/i,
      /^(.+?)\s*\(conflict[^)]*\)(\.md)$/i,
      /^(.+?)\.conflict(\.md)$/i,
      /^(.+?)_conflict(\.md)$/i,
    ];

    for (const pattern of patterns) {
      const match = conflictPath.match(pattern);
      if (match) {
        return `${match[1]}${match[2] || '.md'}`;
      }
    }

    return null;
  }

  async resolveConflict(
    fs: FileSystem,
    file: string,
    choice: 'main' | 'conflict'
  ): Promise<{ mainPath: string; conflictPath: string; content: string } | null> {
    const conflicts = await this.getConflicts(fs);
    const conflict = conflicts.find((c) => c.mainPath === file || c.conflictPath === file);
    if (!conflict) return null;

    let content = conflict.mainContent;
    if (choice === 'conflict') {
      content = conflict.conflictContent;
      await fs.writeFile(conflict.mainPath, content);
    }

    await fs.deleteFile(conflict.conflictPath);
    return {
      mainPath: conflict.mainPath,
      conflictPath: conflict.conflictPath,
      content,
    };
  }
}

/** Переключение чекбокса в файле (lineNumber — индекс строки в файле, 0-based) */
export async function toggleCheckboxInFile(
  fs: FileSystem,
  filePath: string,
  lineNumber: number
): Promise<void> {
  const content = await fs.readFile(filePath);
  const { meta, body } = parseNote(content);
  const bodyLine = lineNumber - bodyLineToFileLine(content, 0);
  const newBody = toggleTaskLine(body, bodyLine);
  if (!newBody) return;

  const updated = composeNote(
    ensureNoteMeta({ ...meta, modified: new Date().toISOString() }),
    newBody
  );
  await fs.writeFile(filePath, updated);
}
