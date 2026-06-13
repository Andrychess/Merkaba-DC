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

export function resolveNotePathForTitle(
  title: string,
  currentPath: string,
  existingPaths: Set<string>
): string | null {
  const base = titleToFileName(title);
  if (!base) return null;

  const dir = currentPath.includes('/') ? currentPath.slice(0, currentPath.lastIndexOf('/')) : '';
  const currentBase = currentPath.split('/').pop()?.replace(/\.md$/i, '') ?? '';

  let candidate = base;
  let suffix = 2;
  while (suffix < 100) {
    const newPath = dir ? `${dir}/${candidate}.md` : `${candidate}.md`;
    if (newPath === currentPath) return null;
    if (!existingPaths.has(newPath)) {
      return candidate === currentBase ? null : newPath;
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
