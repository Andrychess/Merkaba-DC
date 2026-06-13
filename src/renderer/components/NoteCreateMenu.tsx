import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NoteType } from '@shared/note-types';
import { NOTE_TYPES } from '@shared/note-types';
import { IconPlus } from './Icons';

interface NoteCreateMenuProps {
  onCreate: (type: NoteType) => void;
  className?: string;
  label?: string;
  /** bottom — вниз от кнопки, top — вверх (для нижней панели сайдбара) */
  placement?: 'top' | 'bottom';
}

export function NoteCreateMenu({
  onCreate,
  className = 'btn-primary',
  label = 'Новая заметка',
  placement = 'bottom',
}: NoteCreateMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const btn = buttonRef.current;
    const menu = menuRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 200;
    const gap = 4;
    const width = Math.max(rect.width, 224);

    let top = placement === 'bottom' ? rect.bottom + gap : rect.top - menuHeight - gap;
    top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8));

    let left = rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

    setMenuPos({ left, top, width });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updatePosition();
  }, [open, placement]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onReposition = () => updatePosition();

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, placement]);

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[200] bg-merkaba-elevated border border-merkaba-border-strong rounded-xl shadow-panel overflow-hidden animate-fade-in"
            style={{ left: menuPos.left, top: menuPos.top, width: menuPos.width }}
          >
            {NOTE_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  onCreate(type.id);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 hover:bg-merkaba-hover transition-colors border-b border-merkaba-border last:border-0"
              >
                <span className="block text-sm font-medium text-merkaba-text">{type.label}</span>
                <span className="block text-[10px] text-merkaba-muted mt-0.5">{type.description}</span>
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={className}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <IconPlus className="w-4 h-4" />
        {label}
      </button>
      {menu}
    </>
  );
}
