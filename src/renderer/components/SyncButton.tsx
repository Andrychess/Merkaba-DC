import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { IconCloud } from './Icons';
import type { SyncStatus } from '@shared/yandex';

const EMPTY_SYNC_STATUS: SyncStatus = {
  syncing: false,
  lastSync: null,
  error: null,
  pendingCount: 0,
};

export function SyncButton() {
  const syncPull = useAppStore((s) => s.syncPull);
  const statusMessage = useAppStore((s) => s.statusMessage);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(EMPTY_SYNC_STATUS);

  const refreshStatus = useCallback(() => {
    window.merkaba.getSyncStatus().then(setSyncStatus).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStatus();
    const timer = setInterval(refreshStatus, syncStatus.syncing ? 400 : 15_000);
    return () => clearInterval(timer);
  }, [refreshStatus, syncStatus.syncing]);

  useEffect(() => {
    refreshStatus();
  }, [statusMessage, refreshStatus]);

  const syncing = syncStatus.syncing;
  const progress = syncStatus.progress ?? 0;
  const hasPending = Boolean(syncStatus.pendingCount && syncStatus.pendingCount > 0);

  const handleClick = async () => {
    if (syncing) return;
    await syncPull();
    refreshStatus();
  };

  const actionLabel = syncing
    ? null
    : hasPending
      ? `Синхронизировать (${syncStatus.pendingCount})`
      : 'Синхронизировать';

  const cloudClass = syncing
    ? 'text-amber-400 animate-pulse'
    : syncStatus.error
      ? 'text-red-400'
      : hasPending
        ? 'text-amber-400'
        : 'text-emerald-400';

  const title = syncing
    ? `${syncStatus.progressLabel ?? 'Синхронизация...'} — ${progress}%`
    : syncStatus.error
      ? syncStatus.error
      : 'Синхронизировать с Яндекс.Диском';

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={syncing}
      title={title}
      className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-merkaba-elevated border border-merkaba-border hover:bg-merkaba-hover hover:text-merkaba-text transition-colors disabled:opacity-90 text-xs text-merkaba-muted min-w-0 max-w-[min(100vw-12rem,28rem)] app-no-drag"
    >
      <span className="flex items-center gap-1.5 shrink-0 border-r border-merkaba-border pr-2 mr-0.5">
        <IconCloud className={`w-3.5 h-3.5 ${cloudClass}`} />
        <span className="hidden sm:inline">Яндекс.Диск</span>
      </span>

      {syncing ? (
        <>
          <span className="truncate min-w-0 text-merkaba-text/90">
            {syncStatus.progressLabel ?? 'Синхронизация...'}
          </span>
          <span
            className="h-1 w-10 shrink-0 rounded-full bg-merkaba-bg border border-merkaba-border overflow-hidden"
            aria-hidden
          >
            <span
              className="block h-full bg-merkaba-accent transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </span>
          <span className="font-mono shrink-0 text-merkaba-text/90">{progress}%</span>
        </>
      ) : (
        <span className={`shrink-0 ${syncStatus.error ? 'text-red-400' : undefined}`}>
          {actionLabel}
        </span>
      )}
    </button>
  );
}
