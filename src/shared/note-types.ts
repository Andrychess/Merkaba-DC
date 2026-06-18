export type NoteType = 'text' | 'drawing' | 'music';

export const NOTE_TYPES: { id: NoteType; label: string; description: string }[] = [
  { id: 'text', label: 'Текст', description: 'Обычная заметка с Markdown' },
  { id: 'drawing', label: 'Рисунок', description: 'Холст формата А4 (210×297 мм)' },
  { id: 'music', label: 'Музыка', description: 'Текст песни с аккордами и прокруткой' },
];

export function normalizeNoteType(value: string | null | undefined): NoteType {
  if (value === 'drawing' || value === 'music') return value;
  return 'text';
}

/** Тип по содержимому, если в frontmatter не указан */
export function inferNoteTypeFromBody(body: string): NoteType {
  if (MUSIC_FENCE.test(body)) return 'music';
  if (DRAWING_FENCE.test(body)) return 'drawing';
  return 'text';
}

export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawStroke {
  color: string;
  width: number;
  eraser?: boolean;
  points: DrawPoint[];
}

export interface DrawingData {
  version: 1;
  width: number;
  height: number;
  strokes: DrawStroke[];
}

export interface MusicLine {
  kind: 'chord' | 'lyric';
  text: string;
}

export type MusicRowKind = 'title' | 'section' | 'line';

export interface MusicRow {
  id?: string;
  kind?: MusicRowKind;
  chord: string;
  lyric: string;
}

export const DEFAULT_MUSIC_LYRIC_FONT = 18;
export const DEFAULT_MUSIC_CHORD_FONT = 14;
export const DEFAULT_MUSIC_LINE_HEIGHT = 1.6;

export interface MusicData {
  version: 3;
  autoScroll: boolean;
  scrollSpeed: number;
  lyricFontSize: number;
  chordFontSize: number;
  lineHeight: number;
  /** Показывать строки аккордов в редакторе */
  showChords: boolean;
  rows: MusicRow[];
}

/** @deprecated v2 — миграция */
interface MusicDataV2 {
  version: 2;
  autoScroll: boolean;
  scrollSpeed: number;
  rows: MusicRow[];
}

/** @deprecated v1 — только для миграции */
interface MusicDataV1 {
  version: 1;
  autoScroll: boolean;
  scrollSpeed: number;
  lines: MusicLine[];
}

const DRAWING_FENCE = /```drawing\s*\n([\s\S]*?)\n```/;
const MUSIC_FENCE = /```music\s*\n([\s\S]*?)\n```/;

/** Логический холст 96 dpi: 210×297 мм */
export const DRAWING_A4_WIDTH = 794;
export const DRAWING_A4_HEIGHT = 1123;
export const DRAWING_A4_RATIO = DRAWING_A4_WIDTH / DRAWING_A4_HEIGHT;
export const DRAWING_PAGE_BG = '#1a1c2e';

export function emptyDrawing(): DrawingData {
  return { version: 1, width: DRAWING_A4_WIDTH, height: DRAWING_A4_HEIGHT, strokes: [] };
}

/** Приводит сохранённый рисунок к листу А4, сохраняя пропорции штрихов. */
export function normalizeDrawingData(data: DrawingData): DrawingData {
  const width = data.width > 0 ? data.width : DRAWING_A4_WIDTH;
  const height = data.height > 0 ? data.height : DRAWING_A4_HEIGHT;
  if (width === DRAWING_A4_WIDTH && height === DRAWING_A4_HEIGHT) {
    return { version: 1, width, height, strokes: data.strokes };
  }

  const scale = Math.min(DRAWING_A4_WIDTH / width, DRAWING_A4_HEIGHT / height);
  const offsetX = (DRAWING_A4_WIDTH - width * scale) / 2;
  const offsetY = (DRAWING_A4_HEIGHT - height * scale) / 2;

  return {
    version: 1,
    width: DRAWING_A4_WIDTH,
    height: DRAWING_A4_HEIGHT,
    strokes: data.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({
        x: point.x * scale + offsetX,
        y: point.y * scale + offsetY,
      })),
    })),
  };
}

export function newMusicRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createMusicRow(kind: MusicRowKind, lyric = ''): MusicRow {
  return { id: newMusicRowId(), kind, chord: '', lyric };
}

export function ensureMusicRowIds(rows: MusicRow[]): MusicRow[] {
  return rows.map((row) => (row.id ? row : { ...row, id: newMusicRowId() }));
}

export function emptyMusic(title?: string): MusicData {
  return {
    version: 3,
    autoScroll: false,
    scrollSpeed: 28,
    lyricFontSize: DEFAULT_MUSIC_LYRIC_FONT,
    chordFontSize: DEFAULT_MUSIC_CHORD_FONT,
    lineHeight: DEFAULT_MUSIC_LINE_HEIGHT,
    showChords: true,
    rows: [createMusicRow('title', title ? `# ${title}` : '# ')],
  };
}

const SECTION_LABEL =
  /^(?:куплет|припев|бридж|проигрыш|интро|аутро|запев|мост|coda|verse|chorus|bridge|intro|outro)(\s*\d+)?$/i;

export function isMusicSectionLabel(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 40) return false;
  if (/^##\s/.test(t)) return true;
  if (/^\[.+\]$/.test(t)) return true;
  return SECTION_LABEL.test(t.replace(/[.:!]/g, ''));
}

export function inferMusicRowKind(row: MusicRow, index: number): MusicRowKind {
  if (row.kind === 'title' || row.kind === 'section' || row.kind === 'line') return row.kind;
  const lyric = row.lyric.trim();
  if (index === 0 && /^#\s/.test(lyric) && !/^##\s/.test(lyric)) return 'title';
  return 'line';
}

export function normalizeMusicRow(row: MusicRow, index: number): MusicRow {
  const kind = inferMusicRowKind(row, index);
  let lyric = row.lyric;
  if (kind === 'section') {
    lyric = lyric
      .replace(/^##\s*/, '')
      .replace(/^\[(.+)\]$/, '$1')
      .trim();
  }
  return {
    kind,
    chord: kind === 'line' ? row.chord : '',
    lyric,
  };
}

function normalizeRows(rows: MusicRow[]): MusicRow[] {
  return ensureMusicRowIds(rows.map((row, i) => normalizeMusicRow(row, i)));
}

function linesToRows(lines: MusicLine[]): MusicRow[] {
  const rows: MusicRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.kind === 'chord') {
      const lyric = lines[i + 1]?.kind === 'lyric' ? lines[i + 1].text : '';
      rows.push({ kind: 'line', chord: line.text, lyric });
      i += lines[i + 1]?.kind === 'lyric' ? 2 : 1;
    } else {
      rows.push({ kind: 'line', chord: '', lyric: line.text });
      i += 1;
    }
  }
  return normalizeRows(rows);
}

function normalizeMusicData(
  parsed: Partial<MusicData> & Partial<MusicDataV2> & Partial<MusicDataV1>
): MusicData {
  const base = {
    autoScroll: parsed.autoScroll ?? false,
    scrollSpeed: parsed.scrollSpeed ?? 28,
    lyricFontSize: parsed.lyricFontSize ?? DEFAULT_MUSIC_LYRIC_FONT,
    chordFontSize: parsed.chordFontSize ?? DEFAULT_MUSIC_CHORD_FONT,
    lineHeight: parsed.lineHeight ?? DEFAULT_MUSIC_LINE_HEIGHT,
    showChords: parsed.showChords ?? true,
  };

  if (parsed.version === 3 && Array.isArray(parsed.rows)) {
    const rows = normalizeRows(parsed.rows);
    return {
      version: 3,
      ...base,
      rows: rows.length > 0 ? rows : emptyMusic().rows,
    };
  }

  if (parsed.version === 2 && Array.isArray(parsed.rows)) {
    const rows = normalizeRows(parsed.rows);
    return {
      version: 3,
      ...base,
      rows: rows.length > 0 ? rows : emptyMusic().rows,
    };
  }

  if (parsed.version === 1 && Array.isArray(parsed.lines)) {
    const rows = linesToRows(parsed.lines);
    return {
      version: 3,
      ...base,
      rows: rows.length > 0 ? rows : emptyMusic().rows,
    };
  }

  return emptyMusic();
}

export function parseDrawingBody(body: string): DrawingData {
  const match = body.match(DRAWING_FENCE);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]) as DrawingData;
      if (parsed.version === 1 && Array.isArray(parsed.strokes)) {
        return normalizeDrawingData(parsed);
      }
    } catch {
      // fall through
    }
  }
  return emptyDrawing();
}

export function serializeDrawingBody(data: DrawingData): string {
  return '```drawing\n' + JSON.stringify(data, null, 2) + '\n```';
}

export function parseMusicBody(body: string): MusicData {
  const match = body.match(MUSIC_FENCE);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]) as Partial<MusicData> & Partial<MusicDataV1>;
      if (
        (parsed.version === 3 && Array.isArray(parsed.rows)) ||
        (parsed.version === 2 && Array.isArray(parsed.rows)) ||
        (parsed.version === 1 && Array.isArray(parsed.lines))
      ) {
        return normalizeMusicData(parsed);
      }
    } catch {
      // fall through
    }
  }
  return emptyMusic();
}

export function serializeMusicBody(data: MusicData): string {
  return '```music\n' + JSON.stringify(data) + '\n```';
}

/** Распознаёт токен аккорда: Am, F#m7, Bb/D, N.C. */
const CHORD_TOKEN =
  /^(?:N\.?C\.?|[A-H](?:#|b)?(?:maj|min|m|dim|aug|sus|add|M)?[0-9]*(?:sus[24])?(?:\/[A-H](?:#|b)?)?)$/i;

function isChordToken(token: string): boolean {
  return CHORD_TOKEN.test(token.replace(/[(),|]/g, ''));
}

export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  if (/\[[^\]]+\]/.test(trimmed)) return false;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  const chordLike = tokens.filter((t) => isChordToken(t)).length;
  const hasLetters = /[а-яёА-ЯЁa-zA-Z]{3,}/.test(trimmed.replace(/\s/g, ''));

  if (hasLetters && chordLike < tokens.length) return false;
  return chordLike > 0 && chordLike >= tokens.length * 0.6;
}

function parseInlineChordLine(line: string): { chords: string; lyric: string } | null {
  if (!/\[[^\]]+\]/.test(line)) return null;

  const chords: string[] = [];
  const lyric = line
    .replace(/\[([^\]]+)\]/g, (_, chord: string) => {
      chords.push(chord.trim());
      return '';
    })
    .trim();

  if (chords.length === 0) return null;
  return { chords: chords.join('   '), lyric };
}

/** Разбивает готовый текст песни на пары «аккорды + строка» */
export function formatMusicTextToRows(raw: string, existingTitle?: string | null): MusicRow[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: MusicRow[] = [];
  let hasTitle = false;
  let pendingChord: string | null = null;

  const flushChord = () => {
    if (pendingChord !== null) {
      pushLine('', pendingChord);
      pendingChord = null;
    }
  };

  const pushLine = (text: string, chord = '') => {
    rows.push(createMusicRow('line', text));
    if (chord) rows[rows.length - 1].chord = chord;
  };

  const pushTitle = (text: string) => {
    const lyricText = text.replace(/^#\s*/, '');
    rows.push(createMusicRow('title', `# ${lyricText}`));
    hasTitle = true;
  };

  const pushSection = (text: string) => {
    flushChord();
    rows.push(
      createMusicRow(
        'section',
        text.replace(/^##\s*/, '').replace(/^\[(.+)\]$/, '$1').trim()
      )
    );
  };

  for (const rawLine of normalized.split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushChord();
      if (rows.length > 0 && rows[rows.length - 1].kind === 'line' && rows[rows.length - 1].lyric) {
        pushLine('');
      }
      continue;
    }

    if (/^##\s+/.test(trimmed) || (/^\[.+\]$/.test(trimmed) && !/\[[A-H#b]/.test(trimmed))) {
      pendingChord = null;
      pushSection(trimmed);
      continue;
    }

    if (isMusicSectionLabel(trimmed) && !isChordLine(trimmed)) {
      pendingChord = null;
      pushSection(trimmed);
      continue;
    }

    const inline = parseInlineChordLine(trimmed);
    if (inline) {
      pendingChord = null;
      if (!hasTitle && inline.lyric) {
        pushTitle(inline.lyric);
      } else if (inline.lyric) {
        pushLine(inline.lyric, inline.chords);
      } else if (inline.chords) {
        pendingChord = inline.chords;
      }
      continue;
    }

    if (isChordLine(trimmed)) {
      flushChord();
      pendingChord = trimmed.replace(/\s+/g, '   ');
      continue;
    }

    const chord = pendingChord ?? '';
    pendingChord = null;

    if (!hasTitle) {
      pushTitle(trimmed);
    } else {
      pushLine(trimmed, chord);
    }
  }

  flushChord();

  while (rows.length > 0 && !rows[rows.length - 1].chord && !rows[rows.length - 1].lyric) {
    rows.pop();
  }

  if (rows.length === 0) {
    return emptyMusic(existingTitle ?? undefined).rows;
  }

  return normalizeRows(rows);
}

/** @deprecated — используйте formatMusicTextToRows */
export function formatMusicTextToLines(raw: string, existingTitle?: string | null): MusicLine[] {
  return formatMusicTextToRows(raw, existingTitle).flatMap((row) => {
    const parts: MusicLine[] = [];
    if (row.chord.trim()) parts.push({ kind: 'chord', text: row.chord });
    if (row.lyric.trim() || parts.length === 0) parts.push({ kind: 'lyric', text: row.lyric });
    return parts;
  });
}

/** Текущие строки редактора → плоский текст → авторазбивка */
export function reformatMusicData(data: MusicData, title?: string | null): MusicData {
  const flat = data.rows
    .flatMap((row, index) => {
      const kind = inferMusicRowKind(row, index);
      if (kind === 'section') return [`## ${row.lyric.trim()}`];
      if (kind === 'title') return [row.lyric.trim()];
      const lines: string[] = [];
      if (row.chord.trim()) lines.push(row.chord);
      if (row.lyric.trim()) lines.push(row.lyric);
      return lines;
    })
    .join('\n');
  return { ...data, rows: formatMusicTextToRows(flat, title) };
}

export function buildInitialBody(noteType: NoteType, title: string): string {
  switch (noteType) {
    case 'drawing':
      return serializeDrawingBody(emptyDrawing());
    case 'music':
      return serializeMusicBody(emptyMusic(title));
    default:
      return `# ${title}\n\n`;
  }
}

export function getDefaultTitle(noteType: NoteType, name: string): string {
  switch (noteType) {
    case 'drawing':
      return 'Рисунок';
    case 'music':
      return 'Песня';
    default:
      return name;
  }
}
