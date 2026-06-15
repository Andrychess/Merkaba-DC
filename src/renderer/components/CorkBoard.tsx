import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Sticker } from '@shared/types';
import { useAppStore } from '../stores/appStore';
import { findNoteInTree } from '../utils/note-tree';
import { IconPlus } from './Icons';
import { StickerEditor } from './StickerEditor';
import { StickyNote, computeCanvasHeight } from './StickyNote';

function getLinkedNoteTitle(
  fileTree: ReturnType<typeof useAppStore.getState>['fileTree'],
  archiveTree: ReturnType<typeof useAppStore.getState>['archiveTree'],
  path: string | null | undefined
): string | null {
  if (!path) return null;
  const node = findNoteInTree(fileTree, path) ?? findNoteInTree(archiveTree, path);
  return node?.title || node?.name || path.split('/').pop()?.replace(/\.md$/i, '') || null;
}

export function CorkBoard() {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Sticker | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const stickersRevision = useAppStore((s) => s.stickersRevision);
  const bumpStickers = useAppStore((s) => s.bumpStickers);
  const fileTree = useAppStore((s) => s.fileTree);
  const archiveTree = useAppStore((s) => s.archiveTree);
  const openFile = useAppStore((s) => s.openFile);
  const setSidebarMode = useAppStore((s) => s.setSidebarMode);
  const setSidebarPanelOpen = useAppStore((s) => s.setSidebarPanelOpen);

  const loadStickers = useCallback(async () => {
    setLoading(true);
    const data = await window.merkaba.getStickers();
    setStickers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStickers();
  }, [loadStickers, stickersRevision]);

  const canvasHeight = useMemo(() => computeCanvasHeight(stickers), [stickers]);

  const linkedCount = stickers.filter((s) => s.linkedNotePath).length;

  const handleCreate = async () => {
    const sticker = await window.merkaba.createSticker();
    setStickers((prev) => [sticker, ...prev]);
    bumpStickers();
    setActiveId(sticker.id);
    setEditing(sticker);
  };

  const handleSave = async (
    patch: Partial<Pick<Sticker, 'title' | 'content' | 'color' | 'linkedNotePath'>>
  ) => {
    if (!editing) return;
    const updated = await window.merkaba.updateSticker(editing.id, patch);
    setStickers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    bumpStickers();
  };

  const handleDelete = async () => {
    if (!editing) return;
    await window.merkaba.deleteSticker(editing.id);
    setStickers((prev) => prev.filter((s) => s.id !== editing.id));
    bumpStickers();
  };

  const handleDragEnd = async (id: string, x: number, y: number) => {
    setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, x, y } : s)));
    setActiveId(id);
    await window.merkaba.updateSticker(id, { x, y });
  };

  const handleOpenLinkedNote = (path: string) => {
    setSidebarMode('files');
    setSidebarPanelOpen(true);
    openFile(path);
  };

  const countLabel =
    stickers.length === 1 ? 'стикер' : stickers.length < 5 ? 'стикера' : 'стикеров';

  return (
    <div className="flex-1 flex flex-col min-h-0 cork-board">
      <div className="flex items-center justify-between px-5 py-3 border-b border-black/20 bg-black/10 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-amber-50/90">Доска стикеров</h2>
          <p className="text-xs text-amber-100/50 mt-0.5">
            {stickers.length} {countLabel}
            {linkedCount > 0 && ` · ${linkedCount} со ссылкой на заметку`}
            {' · '}глаз — редактировать, перетащите — переместить
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-amber-100/90 text-amber-950 hover:bg-amber-50 transition-colors shadow-sm"
        >
          <IconPlus className="w-3.5 h-3.5" />
          Новый стикер
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && (
          <p className="text-amber-100/60 text-sm text-center py-12">Загрузка стикеров…</p>
        )}

        {!loading && stickers.length === 0 && (
          <div className="text-center py-16 px-6">
            <p className="text-amber-100/80 text-base font-medium mb-2">Пробковая доска пуста</p>
            <p className="text-amber-100/50 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
              Стикеры — для быстрых мыслей и напоминаний. Можно привязать стикер к заметке и
              открывать её прямо с доски.
            </p>
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                         bg-amber-100/90 text-amber-950 hover:bg-amber-50 transition-colors"
            >
              <IconPlus className="w-4 h-4" />
              Создать первый стикер
            </button>
          </div>
        )}

        {!loading && stickers.length > 0 && (
          <div className="sticky-canvas" style={{ height: canvasHeight }}>
            {stickers.map((sticker, index) => (
              <StickyNote
                key={sticker.id}
                sticker={sticker}
                zIndex={editing ? index + 1 : sticker.id === activeId ? 500 : index + 1}
                hidden={editing?.id === sticker.id}
                linkedNoteTitle={getLinkedNoteTitle(
                  fileTree,
                  archiveTree,
                  sticker.linkedNotePath
                )}
                onEdit={() => {
                  setActiveId(sticker.id);
                  setEditing(sticker);
                }}
                onDragEnd={(x, y) => handleDragEnd(sticker.id, x, y)}
                onOpenNote={handleOpenLinkedNote}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <StickerEditor
          sticker={editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
