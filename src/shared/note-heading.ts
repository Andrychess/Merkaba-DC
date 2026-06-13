const ATX_HEADING = /^(#{1,6})\s+(.*)$/;

/** Первая непустая строка тела заметки → заголовок H1 и title */
export function applyTitleHeading(body: string): { body: string; title: string | null } {
  if (!body.trim()) {
    return { body: '', title: null };
  }

  const lines = body.split('\n');
  const idx = lines.findIndex((line) => line.trim().length > 0);
  if (idx === -1) {
    return { body, title: null };
  }

  const line = lines[idx];
  const trimmed = line.trim();
  const match = trimmed.match(ATX_HEADING);
  const title = (match ? match[2] : trimmed).trim();

  lines[idx] = title ? `# ${title}` : '#';
  return { body: lines.join('\n'), title: title || null };
}

export function extractTitleFromBody(body: string): string | null {
  const lines = body.split('\n');
  const first = lines.find((line) => line.trim().length > 0) ?? '';
  const match = first.trim().match(ATX_HEADING);
  if (match) return match[2].trim() || null;
  return first.trim() || null;
}

export function getNoteDisplayTitle(
  metaTitle: string | null | undefined,
  body: string,
  filePath: string
): string {
  return (
    metaTitle?.trim() ||
    extractTitleFromBody(body) ||
    filePath.split('/').pop()?.replace(/\.md$/i, '') ||
    'Заметка'
  );
}

/** Имя файла из заголовка заметки */
export function titleToFileName(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zа-яё0-9_-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripMarkdownForPreview(text: string): string {
  return text
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncatePreview(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

/** Краткий текст заметки для списка в сайдбаре (без заголовка) */
export function getNotePreview(
  body: string,
  noteType: 'text' | 'drawing' | 'music' = 'text',
  maxLength = 140
): string {
  if (noteType === 'drawing' || noteType === 'music') return '';
  if (!body.trim()) return '';

  const lines = body.split('\n');
  const rest: string[] = [];
  let skippedTitle = false;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (!skippedTitle) {
      skippedTitle = true;
      continue;
    }
    rest.push(line);
  }

  return truncatePreview(stripMarkdownForPreview(rest.join('\n')), maxLength);
}

/** Позиция курсора в исходнике — первая строка тела после заголовка H1 */
export function getTextBodyCursorOffset(body: string): number {
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i >= lines.length) return body.length;
  i++;
  while (i < lines.length && !lines[i].trim()) i++;
  let offset = 0;
  for (let j = 0; j < i; j++) {
    offset += lines[j].length + 1;
  }
  return Math.min(offset, body.length);
}
