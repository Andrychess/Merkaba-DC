import type { FileNode } from './types';

/** Служебные папки корня — не показываем как пространства */
export const HIDDEN_FROM_SPACES = ['_archive', 'attachments'] as const;

const ACTIVE_SPACE_KEY = 'merkaba-active-space';

export function isSpaceId(path: string): boolean {
  const norm = path.replace(/\\/g, '/');
  if (!norm || norm.includes('/')) return false;
  return !(HIDDEN_FROM_SPACES as readonly string[]).includes(norm);
}

export function getSpacesFromTree(fileTree: FileNode[]): FileNode[] {
  return fileTree.filter((n) => n.type === 'folder' && isSpaceId(n.path));
}

export function getSpaceChildren(fileTree: FileNode[], spaceId: string): FileNode[] {
  const space = fileTree.find((n) => n.path === spaceId && n.type === 'folder');
  return space?.children ?? [];
}

export function getSpaceForPath(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  const slash = norm.indexOf('/');
  if (slash === -1) return norm || 'notes';
  return norm.slice(0, slash);
}

export function resolveActiveSpace(fileTree: FileNode[], preferred?: string | null): string {
  const spaces = getSpacesFromTree(fileTree);
  if (preferred && spaces.some((s) => s.path === preferred)) return preferred;
  try {
    const cached = localStorage.getItem(ACTIVE_SPACE_KEY);
    if (cached && spaces.some((s) => s.path === cached)) return cached;
  } catch {
    // ignore
  }
  if (spaces.some((s) => s.path === 'notes')) return 'notes';
  return spaces[0]?.path ?? 'notes';
}

export function persistActiveSpace(spaceId: string): void {
  try {
    localStorage.setItem(ACTIVE_SPACE_KEY, spaceId);
  } catch {
    // ignore
  }
}

export function formatSpaceLabel(name: string): string {
  const labels: Record<string, string> = {
    notes: 'Заметки',
    daily: 'Ежедневник',
    projects: 'Проекты',
  };
  return labels[name] ?? name.replace(/-/g, ' ');
}

/** Символы по умолчанию для известных пространств */
export const DEFAULT_SPACE_SYMBOLS: Record<string, string> = {
  notes: '📝',
  daily: '📅',
  projects: '📁',
};

export const SPACE_SYMBOL_PRESETS = [
  '📝', '📅', '📁', '✨', '💼', '🎯', '🏠', '💡',
  '📚', '🎨', '🔬', '💰', '❤️', '⭐', '🌿', '🎵', '🚀', '🌙',
] as const;

const SPACE_SYMBOLS_KEY = 'merkaba-space-symbols';

export function loadSpaceSymbols(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SPACE_SYMBOLS_KEY);
    if (!raw) return { ...DEFAULT_SPACE_SYMBOLS };
    const parsed = JSON.parse(raw) as Record<string, string>;
    return { ...DEFAULT_SPACE_SYMBOLS, ...parsed };
  } catch {
    return { ...DEFAULT_SPACE_SYMBOLS };
  }
}

export function persistSpaceSymbols(symbols: Record<string, string>): void {
  try {
    const custom: Record<string, string> = {};
    for (const [id, sym] of Object.entries(symbols)) {
      if (sym && sym !== DEFAULT_SPACE_SYMBOLS[id]) {
        custom[id] = sym;
      }
    }
    localStorage.setItem(SPACE_SYMBOLS_KEY, JSON.stringify(custom));
  } catch {
    // ignore
  }
}

export function normalizeSpaceSymbol(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  return [...trimmed][0] ?? '';
}

export function getSpaceSymbol(spaceId: string, symbols?: Record<string, string>): string {
  const map = symbols ?? loadSpaceSymbols();
  return map[spaceId] ?? DEFAULT_SPACE_SYMBOLS[spaceId] ?? '📂';
}

/** Символ вложенной папки (только если задан пользователем) */
export function getFolderSymbol(folderPath: string, symbols?: Record<string, string>): string | null {
  const map = symbols ?? loadSpaceSymbols();
  return map[folderPath] ?? null;
}

export function formatSpaceDisplay(spaceId: string, symbols?: Record<string, string>): string {
  const symbol = getSpaceSymbol(spaceId, symbols);
  const label = formatSpaceLabel(spaceId);
  return `${symbol} ${label}`;
}

export function sanitizeSpaceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zа-яё0-9_-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
