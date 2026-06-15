import { useEffect, useRef, useState } from 'react';
import type { Sticker } from '@shared/types';
import { IconEye } from './Icons';
import { getStickerStyle } from './StickerEditor';

const STICKER_WIDTH = 168;
const STICKER_HEIGHT = 172;
const DRAG_THRESHOLD = 4;

interface StickyNoteProps {
  sticker: Sticker;
  zIndex: number;
  hidden?: boolean;
  linkedNoteTitle?: string | null;
  onEdit: () => void;
  onDragEnd: (x: number, y: number) => void;
  onOpenNote?: (path: string) => void;
}

export function StickyNote({
  sticker,
  zIndex,
  hidden,
  linkedNoteTitle,
  onEdit,
  onDragEnd,
  onOpenNote,
}: StickyNoteProps) {
  const [pos, setPos] = useState({ x: sticker.x, y: sticker.y });
  const [dragging, setDragging] = useState(false);
  const dragState = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  useEffect(() => {
    if (!dragging) {
      setPos({ x: sticker.x, y: sticker.y });
    }
  }, [sticker.x, sticker.y, dragging]);

  const { paper, rotation, pinX } = getStickerStyle(sticker);
  const linkedPath = sticker.linkedNotePath ?? null;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
    };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.active) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;

    if (!dragState.current.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      dragState.current.moved = true;
    }

    if (dragState.current.moved) {
      setPos({
        x: Math.max(0, dragState.current.originX + dx),
        y: Math.max(0, dragState.current.originY + dy),
      });
    }
  };

  const finishDrag = (e: React.PointerEvent) => {
    if (!dragState.current.active) return;

    const { moved, startX, startY, originX, originY } = dragState.current;
    dragState.current.active = false;
    setDragging(false);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (moved) {
      const x = Math.max(0, originX + (e.clientX - startX));
      const y = Math.max(0, originY + (e.clientY - startY));
      setPos({ x, y });
      onDragEnd(x, y);
    }
  };

  return (
    <div
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      className={`sticky-note ${dragging ? 'sticky-note-dragging' : ''} ${hidden ? 'opacity-0 pointer-events-none' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: STICKER_WIDTH,
        zIndex: hidden ? 1 : dragging ? 1000 : zIndex,
        touchAction: 'none',
        ['--note-bg' as string]: paper.bg,
        ['--note-text' as string]: paper.text,
        ['--note-accent' as string]: paper.accent,
        ['--note-shadow' as string]: paper.shadow,
        ['--note-rotate' as string]: `${dragging ? 0 : rotation}deg`,
        ['--pin-x' as string]: `${pinX}%`,
      }}
    >
      <span className="sticky-pin" aria-hidden />
      <button
        type="button"
        className="sticky-note-view"
        title="Редактировать"
        aria-label="Редактировать стикер"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        <IconEye className="w-3.5 h-3.5" />
      </button>
      <h3 className="sticky-title">{sticker.title}</h3>
      <p className="sticky-excerpt">
        {sticker.content || 'Пустой стикер'}
      </p>

      {linkedPath && (
        <button
          type="button"
          className="sticky-note-link"
          title={linkedNoteTitle ? `Открыть «${linkedNoteTitle}»` : 'Открыть заметку'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenNote?.(linkedPath);
          }}
        >
          <span className="sticky-note-link-icon" aria-hidden>
            📎
          </span>
          <span className="truncate">{linkedNoteTitle || 'Заметка'}</span>
        </button>
      )}
    </div>
  );
}

export function computeCanvasHeight(stickers: Sticker[]): number {
  if (stickers.length === 0) return 480;
  const maxY = Math.max(...stickers.map((s) => s.y + STICKER_HEIGHT));
  return Math.max(480, maxY + 48);
}
