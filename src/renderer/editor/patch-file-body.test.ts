import { describe, expect, it } from 'vitest';
import { patchFileBody } from './patch-file-body';
import type { OpenFile } from '@shared/types';

const baseFile: OpenFile = {
  path: 'notes/test.md',
  content: '---\ntitle: Test\n---\n\n# Test\n\nBody',
  body: '# Test\n\nBody',
  meta: {
    title: 'Test',
    created: '2024-01-01T00:00:00.000Z',
    modified: '2024-01-01T00:00:00.000Z',
    color: null,
    tags: [],
    noteType: 'text',
  },
  isDirty: false,
  color: null,
};

describe('patchFileBody', () => {
  it('обновляет body и помечает файл изменённым', () => {
    const next = patchFileBody([baseFile], 'notes/test.md', '# Test\n\nNew body');
    expect(next[0].body).toContain('New body');
    expect(next[0].isDirty).toBe(true);
    expect(next[0].content).toContain('New body');
  });

  it('не трогает другие открытые файлы', () => {
    const other: OpenFile = { ...baseFile, path: 'notes/other.md' };
    const next = patchFileBody([baseFile, other], 'notes/test.md', '# Test\n\nX');
    expect(next[1]).toBe(other);
  });
});
