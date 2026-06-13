import path from 'path';
import { ARCHIVE_FOLDER, isArchivePath } from '../shared/archive';
import type { FileSystem } from './file-system';

function buildArchivePath(originalPath: string, stamp: number): string {
  const normalized = originalPath.replace(/\\/g, '/');
  const dir = path.posix.dirname(normalized);
  const base = path.posix.basename(normalized);
  const parentInArchive = dir === '.' ? '' : `${ARCHIVE_FOLDER}/${dir}`;

  if (base.endsWith('.md')) {
    const stem = base.slice(0, -3);
    const archivedName = `${stem}_${stamp}.md`;
    return parentInArchive ? `${parentInArchive}/${archivedName}` : `${ARCHIVE_FOLDER}/${archivedName}`;
  }

  const archivedName = `${base}_${stamp}`;
  return parentInArchive ? `${parentInArchive}/${archivedName}` : `${ARCHIVE_FOLDER}/${archivedName}`;
}

async function ensureArchiveParents(fs: FileSystem, archivePath: string): Promise<void> {
  const parent = path.posix.dirname(archivePath.replace(/\\/g, '/'));
  if (parent && parent !== '.' && parent !== ARCHIVE_FOLDER) {
    await fs.createFolder(parent);
  }
}

export async function ensureArchiveFolder(fs: FileSystem): Promise<void> {
  await fs.createFolder(ARCHIVE_FOLDER);
}

export async function archiveFile(fs: FileSystem, relativePath: string): Promise<string> {
  if (isArchivePath(relativePath)) {
    throw new Error('Элемент уже в архиве');
  }

  await ensureArchiveFolder(fs);
  const dest = buildArchivePath(relativePath, Date.now());
  await ensureArchiveParents(fs, dest);
  await fs.renameFile(relativePath, dest);
  return dest;
}

export async function archiveFolder(fs: FileSystem, folderPath: string): Promise<string> {
  if (folderPath === ARCHIVE_FOLDER) {
    throw new Error('Нельзя архивировать сам архив');
  }
  if (isArchivePath(folderPath)) {
    throw new Error('Папка уже в архиве');
  }

  await ensureArchiveFolder(fs);
  const dest = buildArchivePath(folderPath, Date.now());
  await ensureArchiveParents(fs, dest);
  await fs.renameFile(folderPath, dest);
  return dest;
}

export async function clearArchive(fs: FileSystem): Promise<string[]> {
  const mdFiles = await fs.listAllMdFilesIn(ARCHIVE_FOLDER);
  try {
    await fs.deleteFolder(ARCHIVE_FOLDER);
  } catch {
    // папка может отсутствовать
  }
  await ensureArchiveFolder(fs);
  return mdFiles;
}
