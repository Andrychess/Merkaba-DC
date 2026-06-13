import type { FileNode } from './types';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Replace wiki links only outside fenced/inline code */
export function substituteWikiLinks(body: string): string {
  const fenceRe = /(```[\s\S]*?```|`[^`\n]+`)/g;
  let result = '';
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(body)) !== null) {
    result += replaceWikiInPlainText(body.slice(last, match.index));
    result += match[0];
    last = match.index + match[0].length;
  }

  result += replaceWikiInPlainText(body.slice(last));
  return result;
}

function replaceWikiInPlainText(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_m, link: string) => {
    const display = link.split('/').pop() || link;
    return `<a class="wiki-link" data-wiki="${escapeHtml(link)}" contenteditable="false">${escapeHtml(display)}</a>`;
  });
}

export function flattenMdPaths(tree: FileNode[]): string[] {
  const paths: string[] = [];

  function walk(nodes: FileNode[]) {
    for (const node of nodes) {
      if (node.type === 'file') paths.push(node.path);
      if (node.children) walk(node.children);
    }
  }

  walk(tree);
  return paths;
}

export function resolveWikiLinkTarget(link: string, paths: string[]): string | null {
  const raw = link.trim();
  if (!raw) return null;

  const withoutExt = raw.replace(/\.md$/i, '');
  const lower = withoutExt.toLowerCase();

  const map = new Map<string, string>();
  for (const path of paths) {
    const norm = path.replace(/\\/g, '/');
    const base = norm.split('/').pop()?.replace(/\.md$/i, '') ?? '';
    map.set(norm.toLowerCase(), norm);
    map.set(norm.replace(/\.md$/i, '').toLowerCase(), norm);
    if (base) map.set(base.toLowerCase(), norm);
  }

  if (map.has(lower)) return map.get(lower)!;
  if (map.has(`${lower}.md`)) return map.get(`${lower}.md`)!;

  const suffix = `/${withoutExt}`.toLowerCase();
  const bySuffix = paths.find((p) => p.replace(/\\/g, '/').toLowerCase().endsWith(suffix));
  return bySuffix?.replace(/\\/g, '/') ?? null;
}
