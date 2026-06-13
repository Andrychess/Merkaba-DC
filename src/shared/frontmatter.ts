import type { NoteMeta } from './types';
import { normalizeNoteType } from './note-types';

export function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  if (!content.startsWith('---')) {
    return { frontmatter: '', body: content };
  }
  const end = content.indexOf('---', 3);
  if (end === -1) {
    return { frontmatter: '', body: content };
  }
  return {
    frontmatter: content.slice(0, end + 3),
    body: content.slice(end + 3).replace(/^\n+/, ''),
  };
}

export function joinFrontmatter(frontmatter: string, body: string): string {
  if (!frontmatter) return body;
  if (!body.trim()) return frontmatter;
  return `${frontmatter}\n\n${body}`;
}

function readField(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, '') || null;
}

function parseTags(frontmatter: string): string[] {
  const inline = frontmatter.match(/^tags:\s*\[(.*)\]\s*$/m);
  if (inline) {
    return inline[1]
      .split(',')
      .map((tag) => tag.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  const plain = readField(frontmatter, 'tags');
  if (!plain || plain === '[]') return [];
  return plain.split(',').map((tag) => tag.trim()).filter(Boolean);
}

export function parseNote(content: string): { meta: NoteMeta; body: string } {
  const { frontmatter, body } = splitFrontmatter(content);

  if (!frontmatter) {
    return {
      meta: {
        title: null,
        created: null,
        modified: null,
        color: null,
        tags: [],
        noteType: 'text',
      },
      body: content,
    };
  }

  return {
    meta: {
      title: readField(frontmatter, 'title'),
      created: readField(frontmatter, 'created'),
      modified: readField(frontmatter, 'modified'),
      color: readField(frontmatter, 'color'),
      tags: parseTags(frontmatter),
      noteType: normalizeNoteType(readField(frontmatter, 'type')),
    },
    body,
  };
}

export function buildFrontmatter(meta: NoteMeta): string {
  const lines = ['---'];

  if (meta.title) lines.push(`title: ${meta.title}`);
  if (meta.noteType && meta.noteType !== 'text') lines.push(`type: ${meta.noteType}`);
  if (meta.created) lines.push(`created: ${meta.created}`);
  if (meta.modified) lines.push(`modified: ${meta.modified}`);
  if (meta.color) lines.push(`color: ${meta.color}`);
  if (meta.tags.length > 0) {
    lines.push(`tags: [${meta.tags.join(', ')}]`);
  }

  lines.push('---');
  return lines.join('\n');
}

export function composeNote(meta: NoteMeta, body: string): string {
  const hasMeta =
    meta.title ||
    meta.noteType !== 'text' ||
    meta.created ||
    meta.modified ||
    meta.color ||
    meta.tags.length > 0;

  if (!hasMeta) return body;
  return joinFrontmatter(buildFrontmatter(meta), body);
}

export function bodyLineToFileLine(content: string, bodyLine: number): number {
  const { frontmatter } = splitFrontmatter(content);
  if (!frontmatter) return bodyLine;
  return frontmatter.split('\n').length + 1 + bodyLine;
}

export function extractFrontmatterColor(content: string): string | null {
  return parseNote(content).meta.color;
}

export function setFrontmatterColor(content: string, colorId: string | null): string {
  const { meta, body } = parseNote(content);
  return composeNote({ ...meta, color: colorId }, body);
}

export function ensureNoteMeta(meta: NoteMeta): NoteMeta {
  const now = new Date().toISOString();
  return {
    title: meta.title,
    created: meta.created ?? now,
    modified: meta.modified ?? now,
    color: meta.color,
    tags: meta.tags,
    noteType: meta.noteType ?? 'text',
  };
}
