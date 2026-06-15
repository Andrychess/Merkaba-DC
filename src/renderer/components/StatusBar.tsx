import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { SyncStatus } from '@shared/yandex';

function formatLastSync(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'только что';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} мин назад`;
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function StatusBar() {
  const statusMessage = useAppStore((s) => s.statusMessage);
  const syncPull = useAppStore((s) => s.syncPull);
  const fileTree = useAppStore((s) => s.fileTree);
  const activeFile = useAppStore((s) => s.activeFile);
  const openFiles = useAppStore((s) => s.openFiles);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    syncing: false,
    lastSync: null,
    error: null,
    pendingCount: 0,
  });

  useEffect(() => {
    const refresh = () => {
      window.merkaba.getSyncStatus().then(setSyncStatus).catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, syncStatus.syncing ? 400 : 15_000);
    return () => clearInterval(timer);
  }, [statusMessage, syncStatus.syncing]);

  function countNotes(): number {
    let count = 0;
    const walk = (nodes: typeof fileTree) => {
      for (const n of nodes) {
        if (n.type === 'file') count++;
        if (n.children) walk(n.children);
      }
    };
    walk(fileTree);
    return count;
  }

  const active = openFiles.find((f) => f.path === activeFile);
  const noteCount = countNotes();
  const hasPending = Boolean(syncStatus.pendingCount && syncStatus.pendingCount > 0);
  const hasFailed = Boolean(syncStatus.failedCount && syncStatus.failedCount > 0);

  const syncLabel = syncStatus.syncing
    ? `${syncStatus.progress ?? 0}% — ${syncStatus.progressLabel ?? 'Синхронизация...'}`
    : syncStatus.error
      ? truncate(syncStatus.error, 48)
      : hasFailed
        ? `ошибок: ${syncStatus.failedCount}`
        : hasPending
          ? `${syncStatus.pendingCount} в очереди`
          : formatLastSync(syncStatus.lastSync);

  const syncDotClass = syncStatus.syncing
    ? 'bg-amber-400 animate-pulse'
    : syncStatus.error || hasFailed
      ? 'bg-red-400'
      : hasPending
        ? 'bg-amber-400'
        : syncStatus.lastSync
          ? 'bg-emerald-400'
          : 'bg-merkaba-muted';

  return (
    <footer className="h-8 flex items-center px-4 bg-merkaba-sidebar/80 border-t border-merkaba-border text-xs text-merkaba-muted gap-3 shrink-0">
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-merkaba-elevated border border-merkaba-border">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {noteCount} заметок
      </span>

      <button
        type="button"
        onClick={() => syncPull()}
        disabled={syncStatus.syncing}
        title={syncStatus.error ?? syncLabel}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-merkaba-elevated border border-merkaba-border hover:bg-merkaba-hover transition-colors disabled:opacity-60 min-w-0 max-w-[min(100%,20rem)]"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${syncDotClass}`} />
        <span
          className={`truncate ${
            syncStatus.error || hasFailed ? 'text-red-400' : hasPending ? 'text-amber-400' : undefined
          }`}
        >
          {syncLabel}
        </span>
        {syncStatus.syncing && (
          <span
            className="h-1 w-8 shrink-0 rounded-full bg-merkaba-bg border border-merkaba-border overflow-hidden"
            aria-hidden
          >
            <span
              className="block h-full bg-merkaba-accent transition-[width] duration-200 ease-out"
              style={{ width: `${syncStatus.progress ?? 0}%` }}
            />
          </span>
        )}
      </button>

      {activeFile && (
        <span className="truncate text-merkaba-muted/80 hidden sm:block">
          {activeFile}
          {active?.isDirty && <span className="text-merkaba-accent ml-1">●</span>}
        </span>
      )}

      <span className="ml-auto truncate text-merkaba-muted/70">{statusMessage}</span>
    </footer>
  );
}
