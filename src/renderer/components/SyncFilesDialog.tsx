import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FileSyncStatus } from '@shared/sync';
import { useAppStore } from '../stores/appStore';
import {
  partitionFileSyncStatuses,
  useFileSyncStatuses,
} from '../hooks/useFileSyncStatuses';
import { findNoteInTree } from '../utils/note-tree';
import { IconX } from './Icons';
import { SyncFileBadge } from './SyncFileBadge';

type SyncFilesFilter = 'all' | FileSyncStatus;

interface SyncFilesDialogProps {
  onClose: () => void;
}

function fileLabel(
  path: string,
  fileTree: ReturnType<typeof useAppStore.getState>['fileTree'],
  archiveTree: ReturnType<typeof useAppStore.getState>['archiveTree']
): string {
  const node = findNoteInTree(fileTree, path) ?? findNoteInTree(archiveTree, path);
  return node?.title || node?.name || path.split('/').pop()?.replace(/\.md$/i, '') || path;
}

export function SyncFilesDialog({ onClose }: SyncFilesDialogProps) {
  const fileTree = useAppStore((s) => s.fileTree);
  const archiveTree = useAppStore((s) => s.archiveTree);
  const openFiles = useAppStore((s) => s.openFiles);
  const openFile = useAppStore((s) => s.openFile);
  const setSidebarMode = useAppStore((s) => s.setSidebarMode);
  const setSidebarPanelOpen = useAppStore((s) => s.setSidebarPanelOpen);
  const { statuses, refresh } = useFileSyncStatuses();
  const [filter, setFilter] = useState<SyncFilesFilter>('synced');

  const dirtyPaths = useMemo(
    () => new Set(openFiles.filter((f) => f.isDirty).map((f) => f.path)),
    [openFiles]
  );

  const { synced, pending } = useMemo(
    () => partitionFileSyncStatuses(statuses, dirtyPaths),
    [statuses, dirtyPaths]
  );

  const visiblePaths = useMemo(() => {
    if (filter === 'synced') return synced;
    if (filter === 'pending') return pending;
    return [...synced, ...pending].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [filter, synced, pending]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleOpenFile = (path: string) => {
    setSidebarMode('files');
    setSidebarPanelOpen(true);
    void openFile(path);
    onClose();
  };

  const filterBtn = (value: SyncFilesFilter, count: number) => {
    const active = filter === value;
    return (
      <button
        type="button"
        onClick={() => setFilter(value)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
          active
            ? 'bg-merkaba-elevated border-merkaba-border-strong text-merkaba-text'
            : 'border-transparent text-merkaba-muted hover:bg-merkaba-hover'
        }`}
      >
        {value !== 'all' && <SyncFileBadge status={value} />}
        {value === 'all' && (
          <span className="flex items-center gap-1">
            <SyncFileBadge status="synced" />
            <SyncFileBadge status="pending" />
          </span>
        )}
        <span className="font-mono tabular-nums">{count}</span>
      </button>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000] animate-fade-in p-4 app-no-drag"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-merkaba-sidebar border border-merkaba-border-strong rounded-2xl max-w-md w-full shadow-panel max-h-[min(80vh,520px)] flex flex-col"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-merkaba-border shrink-0">
          <h2 className="text-base font-semibold text-merkaba-text">Файлы на Диске</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5" title="Закрыть">
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-4 py-2 border-b border-merkaba-border shrink-0">
          {filterBtn('synced', synced.length)}
          {filterBtn('pending', pending.length)}
          {filterBtn('all', synced.length + pending.length)}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-2">
          {visiblePaths.length === 0 && (
            <p className="text-sm text-merkaba-muted text-center py-10 px-4">Список пуст</p>
          )}
          {visiblePaths.map((path) => {
            const status: FileSyncStatus = synced.includes(path) ? 'synced' : 'pending';
            return (
              <button
                key={path}
                type="button"
                onClick={() => handleOpenFile(path)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-merkaba-hover transition-colors group"
              >
                <SyncFileBadge status={status} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-merkaba-text truncate group-hover:text-merkaba-accent transition-colors">
                    {fileLabel(path, fileTree, archiveTree)}
                  </span>
                  <span className="block text-[10px] text-merkaba-muted truncate font-mono mt-0.5">
                    {path}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
