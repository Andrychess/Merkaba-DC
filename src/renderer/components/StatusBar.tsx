import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { SyncStatus } from '@shared/yandex';

function formatLastSync(iso: string | null): string {
  if (!iso) return 'ещё не синхронизировано';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'только что';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} мин назад`;
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [statusMessage]);

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

  const syncLabel = syncStatus.syncing
    ? 'Синхронизация...'
    : syncStatus.error
      ? 'Ошибка sync'
      : syncStatus.pendingCount
        ? `В очереди: ${syncStatus.pendingCount}`
        : formatLastSync(syncStatus.lastSync);

  const syncDotClass = syncStatus.syncing
    ? 'bg-amber-400 animate-pulse'
    : syncStatus.error
      ? 'bg-red-400'
      : syncStatus.pendingCount
        ? 'bg-amber-400'
        : 'bg-emerald-400';

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
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-merkaba-elevated border border-merkaba-border hover:bg-merkaba-hover transition-colors disabled:opacity-60"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${syncDotClass}`} />
        <span className={syncStatus.error ? 'text-red-400' : undefined}>{syncLabel}</span>
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
