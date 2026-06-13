import { NOTE_COLORS, getNoteColorHex } from '@shared/note-colors';

interface NoteColorPickerProps {
  value: string | null;
  onChange: (colorId: string | null) => void;
  compact?: boolean;
}

export function NoteColorDot({ colorId, className = 'w-2.5 h-2.5' }: { colorId: string | null | undefined; className?: string }) {
  const hex = getNoteColorHex(colorId);
  if (!hex) return null;

  return (
    <span
      className={`${className} rounded-full shrink-0 ring-1 ring-white/10`}
      style={{ backgroundColor: hex }}
      title={NOTE_COLORS.find((c) => c.id === colorId)?.label}
    />
  );
}

export function NoteColorPicker({ value, onChange, compact }: NoteColorPickerProps) {
  return (
    <div className={compact ? 'flex items-center gap-1' : 'px-3 py-2 border-b border-merkaba-border/50'}>
      {!compact && <p className="text-[10px] uppercase tracking-wide text-merkaba-muted mb-2">Цвет заметки</p>}
      <div className="flex items-center gap-1.5 flex-wrap">
        {NOTE_COLORS.map((color) => (
          <button
            key={color.id}
            type="button"
            title={color.label}
            onClick={() => onChange(color.id)}
            className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ring-2 ${
              value === color.id ? 'ring-merkaba-text scale-110' : 'ring-transparent'
            }`}
            style={{ backgroundColor: color.hex }}
          />
        ))}
        <button
          type="button"
          title="Без цвета"
          onClick={() => onChange(null)}
          className={`w-5 h-5 rounded-full border border-dashed border-merkaba-border text-[9px] text-merkaba-muted hover:text-merkaba-text transition-colors ${
            !value ? 'ring-2 ring-merkaba-text' : ''
          }`}
        >
          ×
        </button>
      </div>
    </div>
  );
}
