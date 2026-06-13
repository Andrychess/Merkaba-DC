import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Sticker } from '@shared/types';
import { NoteLinkPicker } from './NoteLinkPicker';

export const STICKER_COLORS = [
  { bg: '#fef9c3', text: '#713f12', accent: '#ca8a04', shadow: 'rgba(113,63,18,0.25)' },
  { bg: '#fce7f3', text: '#831843', accent: '#db2777', shadow: 'rgba(131,24,67,0.2)' },
  { bg: '#dbeafe', text: '#1e3a5f', accent: '#2563eb', shadow: 'rgba(30,58,95,0.2)' },
  { bg: '#dcfce7', text: '#14532d', accent: '#16a34a', shadow: 'rgba(20,83,45,0.2)' },
  { bg: '#ffedd5', text: '#7c2d12', accent: '#ea580c', shadow: 'rgba(124,45,18,0.2)' },
  { bg: '#f3e8ff', text: '#581c87', accent: '#9333ea', shadow: 'rgba(88,28,135,0.2)' },
];

export function getStickerStyle(sticker: Sticker) {
  const paper = STICKER_COLORS[sticker.color % STICKER_COLORS.length] ?? STICKER_COLORS[0];
  return { paper, rotation: sticker.rotation, pinX: sticker.pinX };
}

interface StickerEditorProps {
  sticker: Sticker;
  onSave: (
    patch: Partial<Pick<Sticker, 'title' | 'content' | 'color' | 'linkedNotePath'>>
  ) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

export function StickerEditor({ sticker, onSave, onDelete, onClose }: StickerEditorProps) {
  const [title, setTitle] = useState(sticker.title);
  const [content, setContent] = useState(sticker.content);
  const [color, setColor] = useState(sticker.color);
  const [linkedNotePath, setLinkedNotePath] = useState<string | null>(
    sticker.linkedNotePath ?? null
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(sticker.title);
    setContent(sticker.content);
    setColor(sticker.color);
    setLinkedNotePath(sticker.linkedNotePath ?? null);
  }, [sticker]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ title, content, color, linkedNotePath });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Удалить этот стикер?')) return;
    setSaving(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const preview = STICKER_COLORS[color % STICKER_COLORS.length];

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000] animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="bg-merkaba-sidebar border border-merkaba-border-strong rounded-2xl max-w-md w-full shadow-panel max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-merkaba-border">
          <h2 className="text-lg font-semibold text-merkaba-text">Редактировать стикер</h2>
          <p className="text-xs text-merkaba-muted mt-1">
            Быстрая запись на доске · можно привязать к заметке
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-merkaba-muted block mb-1.5">Заголовок</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-merkaba-muted block mb-1.5">Текст</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="input-field resize-none"
              placeholder="Быстрая мысль, напоминание..."
            />
          </div>

          <div>
            <label className="text-xs text-merkaba-muted block mb-1.5">Ссылка на заметку</label>
            <NoteLinkPicker value={linkedNotePath} onChange={setLinkedNotePath} />
          </div>

          <div>
            <label className="text-xs text-merkaba-muted block mb-2">Цвет</label>
            <div className="flex gap-2 flex-wrap">
              {STICKER_COLORS.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setColor(i)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    color === i ? 'border-merkaba-accent scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.bg }}
                  title={`Цвет ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div
            className="rounded-lg p-3 text-sm min-h-[72px]"
            style={{ backgroundColor: preview.bg, color: preview.text }}
          >
            <div className="font-bold">{title || 'Заголовок'}</div>
            <div className="opacity-80 mt-1 whitespace-pre-wrap line-clamp-3">
              {content || 'Текст стикера...'}
            </div>
            {linkedNotePath && (
              <div className="sticky-tag mt-2 inline-flex max-w-full truncate">
                📎 заметка
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 p-5 border-t border-merkaba-border">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button type="button" onClick={handleDelete} disabled={saving} className="btn-ghost text-red-400">
            Удалить
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
