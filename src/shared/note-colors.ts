export interface NoteColor {
  id: string;
  label: string;
  hex: string;
}

export const NOTE_COLORS: NoteColor[] = [
  { id: 'rose', label: 'Розовый', hex: '#f43f5e' },
  { id: 'amber', label: 'Янтарный', hex: '#f59e0b' },
  { id: 'emerald', label: 'Изумрудный', hex: '#10b981' },
  { id: 'sky', label: 'Голубой', hex: '#0ea5e9' },
  { id: 'violet', label: 'Фиолетовый', hex: '#8b5cf6' },
  { id: 'orange', label: 'Оранжевый', hex: '#f97316' },
];

export function getNoteColorHex(colorId: string | null | undefined): string | null {
  if (!colorId) return null;
  return NOTE_COLORS.find((c) => c.id === colorId)?.hex ?? null;
}

export function isValidNoteColor(colorId: string): boolean {
  return NOTE_COLORS.some((c) => c.id === colorId);
}
