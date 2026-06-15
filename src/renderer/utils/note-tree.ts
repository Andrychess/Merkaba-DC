import type { FileNode } from '@shared/types';
import type { NoteType } from '@shared/note-types';

export interface NoteOption {
  path: string;
  name: string;
}

export function flattenNotes(tree: FileNode[], excludePath?: string): NoteOption[] {
  const result: NoteOption[] = [];

  function walk(nodes: FileNode[]) {
    for (const node of nodes) {
      if (node.type === 'file' && node.path !== excludePath) {
        result.push({ path: node.path, name: node.name });
      }
      if (node.children) walk(node.children);
    }
  }

  walk(tree);
  return result.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function toWikiLinkTarget(path: string): string {
  return path.replace(/\.md$/i, '');
}

export function findNoteColor(tree: FileNode[], path: string): string | null {
  const node = findNoteInTree(tree, path);
  return node?.color ?? null;
}

export function findNoteInTree(tree: FileNode[], path: string): FileNode | null {
  for (const node of tree) {
    if (node.type === 'file' && node.path === path) return node;
    if (node.children) {
      const found = findNoteInTree(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

function sortTreeNodes(a: FileNode, b: FileNode): number {
  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
  return a.name.localeCompare(b.name, 'ru');
}

export function countNotes(tree: FileNode[]): number {
  let count = 0;
  for (const node of tree) {
    if (node.type === 'file') count++;
    if (node.children) count += countNotes(node.children);
  }
  return count;
}

export function collectFilePaths(tree: FileNode[]): Set<string> {
  const paths = new Set<string>();
  const walk = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file') paths.add(node.path);
      if (node.children) walk(node.children);
    }
  };
  walk(tree);
  return paths;
}

export function treeHasPath(tree: FileNode[], targetPath: string): boolean {
  const norm = targetPath.replace(/\\/g, '/');
  const walk = (nodes: FileNode[]): boolean => {
    for (const node of nodes) {
      if (node.path === norm) return true;
      if (node.children?.length && walk(node.children)) return true;
    }
    return false;
  };
  return walk(tree);
}

export function setTreeNodeColor(tree: FileNode[], path: string, color: string | null): FileNode[] {
  return tree.map((node) => {
    if (node.type === 'file' && node.path === path) {
      return { ...node, color };
    }
    if (node.children) {
      return { ...node, children: setTreeNodeColor(node.children, path, color) };
    }
    return node;
  });
}

export function insertFileIntoTree(
  tree: FileNode[],
  filePath: string,
  noteType: NoteType,
  title?: string,
  preview?: string
): FileNode[] {
  const norm = filePath.replace(/\\/g, '/');
  const baseName = norm.split('/').pop() ?? norm;
  const node: FileNode = {
    name: baseName.replace(/\.md$/i, ''),
    path: norm,
    type: 'file',
    noteType,
    title: title ?? baseName.replace(/\.md$/i, ''),
    preview,
  };

  const parentPath = norm.includes('/') ? norm.slice(0, norm.lastIndexOf('/')) : '';

  const walk = (nodes: FileNode[]): FileNode[] =>
    nodes.map((n) => {
      if (n.path === parentPath && n.type === 'folder') {
        const children = n.children ?? [];
        if (children.some((c) => c.path === norm)) return n;
        return { ...n, children: [...children, node].sort(sortTreeNodes) };
      }
      if (n.children?.length) {
        return { ...n, children: walk(n.children) };
      }
      return n;
    });

  if (!parentPath) {
    if (tree.some((n) => n.path === norm)) return tree;
    return [...tree, node].sort(sortTreeNodes);
  }
  return walk(tree);
}

export function insertFolderIntoTree(tree: FileNode[], folderPath: string): FileNode[] {
  const norm = folderPath.replace(/\\/g, '/');
  const baseName = norm.split('/').pop() ?? norm;
  const node: FileNode = {
    name: baseName,
    path: norm,
    type: 'folder',
    children: [],
  };

  const parentPath = norm.includes('/') ? norm.slice(0, norm.lastIndexOf('/')) : '';

  const walk = (nodes: FileNode[]): FileNode[] =>
    nodes.map((n) => {
      if (n.path === parentPath && n.type === 'folder') {
        const children = n.children ?? [];
        if (children.some((c) => c.path === norm)) return n;
        return { ...n, children: [...children, node].sort(sortTreeNodes) };
      }
      if (n.children?.length) {
        return { ...n, children: walk(n.children) };
      }
      return n;
    });

  if (!parentPath) {
    if (tree.some((n) => n.path === norm)) return tree;
    return [...tree, node].sort(sortTreeNodes);
  }
  return walk(tree);
}

/** Переназначает путь при перемещении/переименовании папки или файла. */
export function remapPath(
  path: string,
  oldPrefix: string,
  newPrefix: string,
  isFolder: boolean
): string {
  if (path === oldPrefix) return newPrefix;
  if (isFolder && path.startsWith(`${oldPrefix}/`)) {
    return `${newPrefix}${path.slice(oldPrefix.length)}`;
  }
  return path;
}
