import { describe, expect, it } from 'vitest';
import type { FileNode } from '@shared/types';
import {
  collectFilePaths,
  insertFileIntoTree,
  insertFolderIntoTree,
  remapPath,
} from '@renderer/utils/note-tree';

const emptyTree: FileNode[] = [
  { name: 'notes', path: 'notes', type: 'folder', children: [] },
];

describe('insertFileIntoTree', () => {
  it('adds file under parent folder', () => {
    const tree = insertFileIntoTree(emptyTree, 'notes/test.md', 'text', 'Test');
    const notes = tree.find((n) => n.path === 'notes');
    expect(notes?.children?.some((c) => c.path === 'notes/test.md')).toBe(true);
  });
});

describe('insertFolderIntoTree', () => {
  it('adds folder at root', () => {
    const tree = insertFolderIntoTree([], 'projects');
    expect(tree.some((n) => n.path === 'projects')).toBe(true);
  });
});

describe('collectFilePaths', () => {
  it('collects all file paths', () => {
    const tree: FileNode[] = [
      {
        name: 'notes',
        path: 'notes',
        type: 'folder',
        children: [{ name: 'a', path: 'notes/a.md', type: 'file' }],
      },
    ];
    expect(collectFilePaths(tree)).toEqual(new Set(['notes/a.md']));
  });
});

describe('remapPath', () => {
  it('remaps paths under renamed folder', () => {
    expect(remapPath('notes/old/x.md', 'notes/old', 'notes/new', true)).toBe('notes/new/x.md');
    expect(remapPath('notes/old', 'notes/old', 'notes/new', true)).toBe('notes/new');
    expect(remapPath('other.md', 'notes/old', 'notes/new', true)).toBe('other.md');
  });
});
