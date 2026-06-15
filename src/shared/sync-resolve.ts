export interface SyncMeta {
  md5: string;
  mtimeMs: number;
}

export interface SyncFilePrev {
  localMd5?: string;
  cloudMd5?: string;
}

/** Решает, что делать с файлом, присутствующим и локально, и в облаке */
export function resolveSyncDirection(
  local: SyncMeta,
  cloudMd5: string | undefined,
  cloudModified: string | undefined,
  prev: SyncFilePrev | undefined
): 'skip' | 'download' | 'upload' | 'conflict' {
  const cloudTime = cloudModified ? new Date(cloudModified).getTime() : 0;

  if (cloudMd5 && local.md5 === cloudMd5) return 'skip';
  if (prev?.localMd5 && prev?.cloudMd5 && prev.localMd5 === local.md5 && prev.cloudMd5 === cloudMd5) {
    return 'skip';
  }

  const localChanged = !prev?.localMd5 || prev.localMd5 !== local.md5;
  const cloudChanged = !prev?.cloudMd5 || (cloudMd5 ? prev.cloudMd5 !== cloudMd5 : cloudTime > 0);

  if (localChanged && cloudChanged) {
    if (cloudTime > local.mtimeMs) return 'download';
    if (local.mtimeMs > cloudTime) return 'upload';
    return 'conflict';
  }

  if (cloudChanged && !localChanged) return 'download';
  if (localChanged && !cloudChanged) return 'upload';

  if (cloudTime > local.mtimeMs) return 'download';
  if (local.mtimeMs > cloudTime) return 'upload';
  return 'skip';
}
