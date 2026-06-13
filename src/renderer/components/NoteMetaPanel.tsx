import { useEffect, useRef, useState } from 'react';
import type { NoteMeta } from '@shared/types';
import { NOTE_TYPES } from '@shared/note-types';
import { getNoteColorHex, NOTE_COLORS } from '@shared/note-colors';
import { NoteColorPicker } from './NoteColorPicker';
import { IconChevron } from './Icons';

interface NoteMetaPanelProps {
  meta: NoteMeta;
  onColorChange: (colorId: string | null) => void;
  onMetaChange: (patch: Partial<NoteMeta>) => void;
}

function formatMetaDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function formatMetaDateShort(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function NoteMetaPanel({ meta, onColorChange, onMetaChange }: NoteMetaPanelProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const colorLabel = NOTE_COLORS.find((c) => c.id === meta.color)?.label ?? 'без цвета';
  const colorHex = getNoteColorHex(meta.color);
  const typeLabel = NOTE_TYPES.find((t) => t.id === meta.noteType)?.label ?? 'Текст';

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Свойства заметки"
        className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs transition-all duration-100 max-w-[220px] ${
          open
            ? 'bg-merkaba-accent-soft text-merkaba-accent'
            : 'text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover'
        }`}
      >
        <IconChevron expanded={open} className="w-3 h-3 shrink-0" />
        <span className="font-medium text-merkaba-text shrink-0">Свойства</span>
        <span className="text-[10px] text-merkaba-muted truncate hidden lg:inline">
          {formatMetaDateShort(meta.created)} · {colorLabel}
        </span>
        {colorHex && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: colorHex }}
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-80 bg-merkaba-elevated border border-merkaba-border-strong rounded-xl shadow-panel animate-fade-in p-3 grid gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-merkaba-muted block mb-1">
              Тип
            </label>
            <p className="text-xs text-merkaba-text">{typeLabel}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-merkaba-muted block mb-1">
                Создана
              </label>
              <p className="text-xs text-merkaba-text">{formatMetaDate(meta.created)}</p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-merkaba-muted block mb-1">
                Изменена
              </label>
              <p className="text-xs text-merkaba-text">{formatMetaDate(meta.modified)}</p>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-merkaba-muted block mb-1">
              Заголовок
            </label>
            <input
              value={meta.title ?? ''}
              onChange={(e) => onMetaChange({ title: e.target.value || null })}
              placeholder="Название в метаданных"
              className="input-field !py-1.5 !text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-merkaba-muted block mb-1">
              Теги
            </label>
            <input
              value={meta.tags.join(', ')}
              onChange={(e) =>
                onMetaChange({
                  tags: e.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              placeholder="тег1, тег2"
              className="input-field !py-1.5 !text-sm"
            />
          </div>

          <NoteColorPicker value={meta.color} onChange={onColorChange} />

          <p className="text-[10px] text-merkaba-muted leading-relaxed">
            Хранится отдельно от текста заметки.
          </p>
        </div>
      )}
    </div>
  );
}
