import { useAppStore } from '../stores/appStore';
import { getNoteDisplayTitle } from '@shared/note-heading';
import { getNoteColorHex } from '@shared/note-colors';
import { resolveFileSyncStatus, useFileSyncStatuses } from '../hooks/useFileSyncStatuses';
import { NoteTypeIcon } from './NoteTypeIcon';
import { SyncFileBadge } from './SyncFileBadge';

export function TabBar() {
  const openFiles = useAppStore((s) => s.openFiles);
  const activeFile = useAppStore((s) => s.activeFile);
  const setActiveFile = useAppStore((s) => s.setActiveFile);
  const closeFile = useAppStore((s) => s.closeFile);
  const { statuses: fileSyncStatuses } = useFileSyncStatuses();

  if (openFiles.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-merkaba-sidebar/50 border-b border-merkaba-border overflow-x-auto shrink-0">
      {openFiles.map((file) => {
        const name = getNoteDisplayTitle(file.meta.title, file.body, file.path);
        const isActive = file.path === activeFile;
        const colorHex = getNoteColorHex(file.color);
        const syncStatus = resolveFileSyncStatus(file.path, fileSyncStatuses, file.isDirty);

        return (
          <div
            key={file.path}
            className={`group flex items-center gap-2 pl-3 pr-2 py-1.5 text-sm cursor-pointer rounded-lg shrink-0 transition-all duration-150 ${
              isActive
                ? 'bg-merkaba-elevated text-merkaba-text border border-merkaba-border-strong shadow-sm'
                : 'text-merkaba-muted hover:bg-merkaba-hover hover:text-merkaba-text border border-transparent'
            }`}
            onClick={() => setActiveFile(file.path)}
          >
            {colorHex && (
              <span
                className="w-0.5 h-3.5 rounded-full shrink-0"
                style={{ backgroundColor: colorHex }}
              />
            )}
            <NoteTypeIcon
              noteType={file.meta.noteType}
              colorId={file.color}
              className="w-3.5 h-3.5"
              active={isActive}
            />
            <span className="truncate max-w-[130px]">{name}</span>
            {file.isDirty && file.saveState !== 'saving' && (
              <span className="w-1.5 h-1.5 rounded-full bg-merkaba-accent shrink-0" title="Не сохранено" />
            )}
            {file.saveState === 'saving' && (
              <span
                className="w-3 h-3 border border-merkaba-accent/30 border-t-merkaba-accent rounded-full animate-spin shrink-0"
                title="Сохранение"
              />
            )}
            {file.saveState === 'saved' && (
              <span className="text-emerald-400 text-[10px] shrink-0" title="Сохранено">
                ✓
              </span>
            )}
            {!file.isDirty && file.saveState !== 'saving' && file.saveState !== 'saved' && syncStatus && (
              <SyncFileBadge status={syncStatus} />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
              className="w-5 h-5 flex items-center justify-center rounded-md text-merkaba-muted opacity-0 group-hover:opacity-100 hover:bg-merkaba-hover hover:text-merkaba-text transition-all"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
