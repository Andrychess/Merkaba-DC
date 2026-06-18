import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { findNoteInTree } from '../utils/note-tree';
import { SIDEBAR_RAIL_WIDTH } from '../utils/sidebar-layout';
import { NoteTypeIcon } from './NoteTypeIcon';
import { FileTree } from './FileTree';
import { ArchivePanel } from './ArchivePanel';
import { TagsPanel } from './TagsPanel';
import {
  IconFolder,
  IconBoard,
  IconTag,
  IconArchive,
  IconPlus,
  IconPin,
  IconChevron,
} from './Icons';

const modes = [
  { id: 'files' as const, icon: IconFolder, label: 'Файлы' },
  { id: 'board' as const, icon: IconBoard, label: 'Стикеры' },
  { id: 'tags' as const, icon: IconTag, label: 'Теги' },
  { id: 'archive' as const, icon: IconArchive, label: 'Архив' },
];

function noteTitle(path: string): string {
  return path.split('/').pop()?.replace(/\.md$/, '') ?? path;
}

export function Sidebar() {
  const sidebarMode = useAppStore((s) => s.sidebarMode);
  const sidebarPanelOpen = useAppStore((s) => s.sidebarPanelOpen);
  const sidebarPanelWidth = useAppStore((s) => s.sidebarPanelWidth);
  const setSidebarMode = useAppStore((s) => s.setSidebarMode);
  const setSidebarPanelOpen = useAppStore((s) => s.setSidebarPanelOpen);
  const setSidebarPanelWidth = useAppStore((s) => s.setSidebarPanelWidth);
  const bumpStickers = useAppStore((s) => s.bumpStickers);
  const pinnedNotes = useAppStore((s) => s.pinnedNotes);
  const activeFile = useAppStore((s) => s.activeFile);
  const openFile = useAppStore((s) => s.openFile);
  const unpinNote = useAppStore((s) => s.unpinNote);
  const refreshArchiveTree = useAppStore((s) => s.refreshArchiveTree);
  const fileTree = useAppStore((s) => s.fileTree);
  const archiveTree = useAppStore((s) => s.archiveTree);
  const openFiles = useAppStore((s) => s.openFiles);

  const [resizing, setResizing] = useState(false);
  const resizeState = useRef({ startX: 0, startWidth: sidebarPanelWidth });

  const createSticker = async () => {
    await window.merkaba.createSticker();
    bumpStickers();
  };

  const handleModeClick = (modeId: (typeof modes)[number]['id']) => {
    if (sidebarMode === modeId && sidebarPanelOpen) {
      setSidebarPanelOpen(false);
      return;
    }
    setSidebarMode(modeId);
    setSidebarPanelOpen(true);
    if (modeId === 'archive') refreshArchiveTree();
  };

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!sidebarPanelOpen) return;
    e.preventDefault();
    resizeState.current = { startX: e.clientX, startWidth: sidebarPanelWidth };
    setResizing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizing) return;
    const dx = e.clientX - resizeState.current.startX;
    setSidebarPanelWidth(resizeState.current.startWidth + dx);
  };

  const handleResizeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizing) return;
    setResizing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  useEffect(() => {
    if (!resizing) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing]);

  const currentMode = modes.find((m) => m.id === sidebarMode);
  const ModeIcon = currentMode?.icon ?? IconFolder;

  return (
    <aside
      className="relative z-30 flex shrink-0 border-r border-merkaba-border bg-merkaba-sidebar app-no-drag"
      style={{ width: SIDEBAR_RAIL_WIDTH }}
    >
      <div
        className="w-14 flex flex-col border-r border-merkaba-border bg-merkaba-bg/50 shrink-0"
        title="Панель инструментов"
        aria-label="Панель инструментов"
      >
        <div className="py-2 px-1 shrink-0 flex flex-col items-center gap-1">
          {!sidebarPanelOpen ? (
            <button
              type="button"
              onClick={() => setSidebarPanelOpen(true)}
              title="Развернуть панель (Esc)"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-merkaba-elevated border border-merkaba-border text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover transition-colors"
            >
              <IconChevron className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="text-center">
              <span className="text-[8px] uppercase tracking-wide text-merkaba-muted leading-tight block">
                Панель
              </span>
              <span className="text-[8px] uppercase tracking-wide text-merkaba-muted leading-tight block">
                инстр.
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 px-1 py-1 shrink-0">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const active = sidebarMode === mode.id && sidebarPanelOpen;
            return (
              <button
                key={mode.id}
                onClick={() => handleModeClick(mode.id)}
                title={sidebarPanelOpen && sidebarMode === mode.id ? `${mode.label} — свернуть` : mode.label}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 ${
                  active
                    ? 'bg-merkaba-accent-soft text-merkaba-accent shadow-glow'
                    : sidebarMode === mode.id && !sidebarPanelOpen
                      ? 'text-merkaba-accent/70 hover:bg-merkaba-hover'
                      : 'text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
              </button>
            );
          })}
        </div>

        <div className="mt-2 pt-2 border-t border-merkaba-border flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="text-[8px] uppercase tracking-wide text-center text-merkaba-muted mb-1.5 px-1 shrink-0">
            Закреп.
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1 px-1 pb-2 min-h-0">
            {pinnedNotes.length === 0 ? (
              <span className="text-[9px] text-merkaba-muted/60 text-center px-1 leading-tight">
                ПКМ на заметке
              </span>
            ) : (
              pinnedNotes.map((path) => {
                const isActive = path === activeFile;
                const open = openFiles.find((f) => f.path === path);
                const treeNode =
                  findNoteInTree(fileTree, path) ?? findNoteInTree(archiveTree, path);
                const colorId = open?.color ?? treeNode?.color ?? null;
                const noteType = open?.meta.noteType ?? treeNode?.noteType ?? 'text';

                return (
                  <button
                    key={path}
                    onClick={() => openFile(path)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      unpinNote(path);
                    }}
                    title={`${noteTitle(path)}\nПКМ — открепить`}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 relative group ${
                      isActive
                        ? 'bg-merkaba-accent-soft text-merkaba-accent ring-1 ring-merkaba-accent/30'
                        : 'text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover'
                    }`}
                  >
                    <NoteTypeIcon
                      noteType={noteType}
                      colorId={colorId}
                      className="w-4 h-4"
                      active={isActive}
                    />
                    <span className="absolute -top-0.5 -right-0.5">
                      <IconPin className="w-2.5 h-2.5 text-merkaba-accent" filled />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {sidebarPanelOpen && (
        <>
          <button
            type="button"
            aria-label="Закрыть панель"
            className="sidebar-panel-backdrop fixed top-11 bottom-8 right-0 z-40 bg-black/45 backdrop-blur-[1px] animate-fade-in"
            style={{ left: SIDEBAR_RAIL_WIDTH }}
            onClick={() => setSidebarPanelOpen(false)}
          />

          <div
            className={`sidebar-panel-flyout fixed top-11 bottom-8 z-50 flex flex-col min-w-0 overflow-hidden bg-merkaba-sidebar border-r border-merkaba-border-strong shadow-panel animate-fade-in ${
              resizing ? '' : 'transition-[width] duration-200'
            }`}
            style={{ left: SIDEBAR_RAIL_WIDTH, width: sidebarPanelWidth }}
          >
            <div className="panel-header border-b border-merkaba-border shrink-0">
              <ModeIcon className="w-3.5 h-3.5" />
              <span className="flex-1 truncate">{currentMode?.label}</span>
              <button
                type="button"
                onClick={() => setSidebarPanelOpen(false)}
                title="Свернуть панель (Esc)"
                className="w-6 h-6 flex items-center justify-center rounded-md text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover transition-colors shrink-0"
              >
                <IconChevron className="w-3.5 h-3.5 -rotate-180" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden min-w-0">
              {sidebarMode === 'files' && <FileTree />}
              {sidebarMode === 'board' && (
                <div className="flex flex-col h-full p-4">
                  <p className="text-sm text-merkaba-muted leading-relaxed">
                    Стикеры — быстрые записи на пробковой доске. Можно привязать к заметке и открыть её с доски.
                  </p>
                  <button onClick={() => createSticker()} className="btn-primary w-full mt-4">
                    <IconPlus className="w-4 h-4" />
                    Новый стикер
                  </button>
                </div>
              )}
              {sidebarMode === 'archive' && <ArchivePanel />}
              {sidebarMode === 'tags' && <TagsPanel />}
            </div>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Изменить ширину панели"
              title="Потяните, чтобы изменить ширину"
              className={`absolute top-0 right-0 z-20 h-full w-1.5 -mr-0.5 cursor-col-resize touch-none ${
                resizing ? 'bg-merkaba-accent/40' : 'hover:bg-merkaba-accent/25'
              }`}
              onPointerDown={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={handleResizeEnd}
            />
          </div>
        </>
      )}
    </aside>
  );
}
