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
    const timer = setInterval(refreshStatus, 15_000);
    return () => clearInterval(timer);
  }, [refreshStatus]);

  useEffect(() => {
    if (!syncStatus.syncing) return;
    const timer = setInterval(refreshStatus, 500);
    return () => clearInterval(timer);
  }, [syncStatus.syncing, refreshStatus]);

  useEffect(() => {
    refreshStatus();
  }, [statusMessage, refreshStatus]);

  const syncing = syncStatus.syncing;

  const handleClick = async () => {
    if (syncing) return;
    await syncPull();
    refreshStatus();
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={syncing}
      title={
        syncing
          ? 'Синхронизация...'
          : syncStatus.error
            ? syncStatus.error
            : 'Синхронизировать с Яндекс.Диском'
      }
      className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-merkaba-elevated border border-merkaba-border hover:bg-merkaba-hover hover:text-merkaba-text transition-colors disabled:opacity-60 text-xs text-merkaba-muted app-no-drag"
    >
      <IconCloud
        className={`w-3.5 h-3.5 shrink-0 ${
          syncing ? 'text-amber-400 animate-pulse' : syncStatus.error ? 'text-red-400' : 'text-emerald-400'
        }`}
      />
      <span className={syncStatus.error && !syncing ? 'text-red-400' : undefined}>
        {syncing
          ? 'Синхронизация...'
          : syncStatus.pendingCount && syncStatus.pendingCount > 0
            ? `Синхронизировать (${syncStatus.pendingCount})`
            : 'Синхронизировать'}
      </span>
    </button>
  );
}
