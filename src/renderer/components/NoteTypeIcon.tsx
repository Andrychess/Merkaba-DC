import type { NoteType } from '@shared/note-types';
import { getNoteColorHex } from '@shared/note-colors';
import { IconNoteDrawing, IconNoteMusic, IconNoteText } from './Icons';

const ICONS = {
  text: IconNoteText,
  drawing: IconNoteDrawing,
  music: IconNoteMusic,
} as const;

interface NoteTypeIconProps {
  noteType?: NoteType | null;
  colorId?: string | null;
  className?: string;
  active?: boolean;
}

export function NoteTypeIcon({
  noteType = 'text',
  colorId,
  className = 'w-4 h-4',
  active,
}: NoteTypeIconProps) {
  const Icon = ICONS[noteType ?? 'text'] ?? IconNoteText;
  const colorHex = getNoteColorHex(colorId);
  const tone = colorHex
    ? ''
    : active
      ? 'text-merkaba-accent'
      : 'text-merkaba-muted';

  return (
    <Icon
      className={`shrink-0 ${tone} ${className}`}
      style={colorHex ? { color: colorHex } : undefined}
    />
  );
}
