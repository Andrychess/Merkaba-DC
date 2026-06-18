import type { OpenFile } from '@shared/types';
import { composeNote } from '@shared/frontmatter';
import { titleToFileName } from '@shared/note-heading';

export function getActiveOpenFile(
  openFiles: OpenFile[],
  activeFile: string | null
): OpenFile | undefined {
  if (!activeFile) return undefined;
  return openFiles.find((f) => f.path === activeFile);
}

const LEGACY_TIMESTAMP_SUFFIX = /^(.+)-\d{10,}$/;

function baseNameFromPath(filePath: string): string {
  return filePath.split('/').pop()?.replace(/\.md$/i, '') ?? '';
}

export function resolveNotePathForTitle(
  title: string,
  currentPath: string,
  existingPaths: Set<string>
): string | null {
  const base = titleToFileName(title);
  if (!base) return null;

  const dir = currentPath.includes('/') ? currentPath.slice(0, currentPath.lastIndexOf('/')) : '';
  const currentBase = baseNameFromPath(currentPath);
  const legacyMatch = currentBase.match(LEGACY_TIMESTAMP_SUFFIX);
  const normalizedCurrentBase = legacyMatch ? legacyMatch[1] : currentBase;

  let candidate = base;
  let suffix = 2;
  while (suffix < 100) {
    const newPath = dir ? `${dir}/${candidate}.md` : `${candidate}.md`;
    if (newPath === currentPath) return null;
    if (!existingPaths.has(newPath)) {
      if (candidate === currentBase) return null;
      if (!legacyMatch && candidate === normalizedCurrentBase) return null;
      return newPath;
    }
    if (legacyMatch && candidate === base) {
      return null;
    }
    candidate = `${base}-${suffix}`;
    suffix++;
  }
  return null;
}

export function applyTextNoteTitle(file: OpenFile, title: string): OpenFile {
  const meta = { ...file.meta, title };
  const lines = file.body.split('\n');
  const idx = lines.findIndex((line) => line.trim().length > 0);
  if (idx !== -1) {
    lines[idx] = title.trim() ? `# ${title.trim()}` : '#';
  } else if (title.trim()) {
    lines.unshift(`# ${title.trim()}`);
  }
  const body = lines.join('\n');
  const content = composeNote(meta, body);
  return { ...file, meta, body, content, isDirty: true };
}
