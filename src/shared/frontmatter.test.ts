import { describe, expect, it } from 'vitest';
import { parseNote, composeNote } from './frontmatter';

describe('parseNote', () => {
  it('parses frontmatter and body', () => {
    const content = `---
title: Тест
type: text
tags: [a, b]
---

# Заголовок

Текст.`;

    const { meta, body } = parseNote(content);
    expect(meta.title).toBe('Тест');
    expect(meta.noteType).toBe('text');
    expect(meta.tags).toEqual(['a', 'b']);
    expect(body).toContain('# Заголовок');
  });

  it('returns defaults for plain markdown', () => {
    const { meta, body } = parseNote('# Hello');
    expect(meta.noteType).toBe('text');
    expect(meta.title).toBeNull();
    expect(body).toBe('# Hello');
  });
});

describe('composeNote', () => {
  it('round-trips with parseNote', () => {
    const original = {
      meta: {
        title: 'Round',
        created: '2024-01-01T00:00:00.000Z',
        modified: '2024-01-02T00:00:00.000Z',
        color: null,
        tags: ['x'],
        noteType: 'text' as const,
      },
      body: 'Тело заметки',
    };

    const composed = composeNote(original.meta, original.body);
    const parsed = parseNote(composed);
    expect(parsed.meta.title).toBe('Round');
    expect(parsed.meta.tags).toEqual(['x']);
    expect(parsed.body).toBe('Тело заметки');
  });
});
