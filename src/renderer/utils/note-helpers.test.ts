import { describe, expect, it } from 'vitest';
import { resolveNotePathForTitle } from './note-helpers';

describe('resolveNotePathForTitle', () => {
  it('returns null when title matches current file name', () => {
    const paths = new Set(['notes/заметка.md']);
    expect(resolveNotePathForTitle('Заметка', 'notes/заметка.md', paths)).toBeNull();
  });

  it('returns new path when title differs and slot is free', () => {
    const paths = new Set(['notes/old.md']);
    expect(resolveNotePathForTitle('Новый заголовок', 'notes/old.md', paths)).toBe(
      'notes/новый-заголовок.md'
    );
  });

  it('adds suffix when path is taken', () => {
    const paths = new Set(['notes/test.md', 'notes/test-2.md']);
    expect(resolveNotePathForTitle('Test', 'notes/other.md', paths)).toBe('notes/test-3.md');
  });

  it('renames legacy timestamp file to title slug', () => {
    const paths = new Set(['notes/новая-заметка-1781598204066.md']);
    expect(resolveNotePathForTitle('Новая заметка', 'notes/новая-заметка-1781598204066.md', paths)).toBe(
      'notes/новая-заметка.md'
    );
  });

  it('keeps legacy timestamp file when clean slug already exists elsewhere', () => {
    const paths = new Set(['notes/новая-заметка.md', 'notes/новая-заметка-1781598204066.md']);
    expect(resolveNotePathForTitle('Новая заметка', 'notes/новая-заметка-1781598204066.md', paths)).toBeNull();
  });
});
