import { useCallback, useEffect, useState } from 'react';
import type { FileSyncStatus, FileSyncStatusMap } from '@shared/sync';
import { useAppStore } from '../stores/appStore';

export function resolveFileSyncStatus(
  path: string,
  statuses: FileSyncStatusMap,
  isDirty: boolean
): FileSyncStatus | undefined {
  if (isDirty) return 'pending';
  return statuses[path];
}

export function treeHasPendingSync(
  node: { type: string; path: string; children?: unknown[] },
  statuses: FileSyncStatusMap,
  dirtyPaths: ReadonlySet<string>
): boolean {
  if (node.type === 'file') {
    const status = resolveFileSyncStatus(node.path, statuses, dirtyPaths.has(node.path));
    return status === 'pending' || status === 'failed';
  }
  const children = node.children as typeof node[] | undefined;
  return children?.some((child) => treeHasPendingSync(child, statuses, dirtyPaths)) ?? false;
}

export function useFileSyncStatuses() {
  const statusMessage = useAppStore((s) => s.statusMessage);
  const [statuses, setStatuses] = useState<FileSyncStatusMap>({});
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    window.merkaba.getFileSyncStatuses().then(setStatuses).catch(() => {});
    window.merkaba.getSyncStatus().then((s) => setSyncing(s.syncing)).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const intervalMs = syncing ? 800 : 4000;
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [refresh, syncing, statusMessage]);

  return { statuses, syncing, refresh };
}

export function partitionFileSyncStatuses(
  statuses: FileSyncStatusMap,
  dirtyPaths: ReadonlySet<string>
): { synced: string[]; pending: string[]; failed: string[] } {
  const synced: string[] = [];
  const pending: string[] = [];
  const failed: string[] = [];

  for (const path of Object.keys(statuses).sort((a, b) => a.localeCompare(b, 'ru'))) {
    const state = resolveFileSyncStatus(path, statuses, dirtyPaths.has(path));
    if (state === 'synced') synced.push(path);
    else if (state === 'pending') pending.push(path);
    else if (state === 'failed') failed.push(path);
  }

  return { synced, pending, failed };
}
