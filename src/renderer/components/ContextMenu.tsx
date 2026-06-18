import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
  minWidth?: number;
}

export function ContextMenu({ open, x, y, onClose, children, minWidth = 210 }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    if (!open) return;

    const menu = menuRef.current;
    if (!menu) {
      setPosition({ left: x, top: y });
      return;
    }

    const { offsetWidth, offsetHeight } = menu;
    const left = Math.max(8, Math.min(x, window.innerWidth - offsetWidth - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - offsetHeight - 8));
    setPosition({ left, top });
  }, [open, x, y, children]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[200] bg-merkaba-elevated border border-merkaba-border-strong rounded-xl shadow-panel py-1.5 animate-fade-in"
      style={{ left: position.left, top: position.top, minWidth }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </div>,
    document.body
  );
}
