export const ARCHIVE_FOLDER = '_archive';

export const ROOT_DROP_ID = '__root__';

export function isArchivePath(itemPath: string): boolean {
  const normalized = itemPath.replace(/\\/g, '/');
  return normalized === ARCHIVE_FOLDER || normalized.startsWith(`${ARCHIVE_FOLDER}/`);
}

export function isProtectedPath(itemPath: string): boolean {
  const normalized = itemPath.replace(/\\/g, '/');
  return normalized === 'README.md' || normalized === ARCHIVE_FOLDER;
}
