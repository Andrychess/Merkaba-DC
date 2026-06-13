import type { ThemeColors, ThemeId } from '@shared/themes';
import { DEFAULT_THEME, THEME_MAP, normalizeThemeId, hexToRgbChannels } from '@shared/themes';

const STORAGE_KEY = 'merkaba-theme';

const CSS_VARS: Array<[keyof ThemeColors, string]> = [
  ['bg', '--merkaba-bg'],
  ['sidebar', '--merkaba-sidebar'],
  ['elevated', '--merkaba-elevated'],
  ['surface', '--merkaba-surface'],
  ['hover', '--merkaba-hover'],
  ['accent', '--merkaba-accent'],
  ['accentHover', '--merkaba-accent-hover'],
  ['accentSoft', '--merkaba-accent-soft'],
  ['text', '--merkaba-text'],
  ['muted', '--merkaba-muted'],
  ['border', '--merkaba-border'],
  ['borderStrong', '--merkaba-border-strong'],
  ['shadowPanel', '--merkaba-shadow-panel'],
  ['shadowGlow', '--merkaba-shadow-glow'],
  ['graphLink', '--merkaba-graph-link'],
  ['graphNodeStroke', '--merkaba-graph-node-stroke'],
  ['scrollbar', '--merkaba-scrollbar'],
  ['scrollbarHover', '--merkaba-scrollbar-hover'],
];

const RGB_VARS: Array<[keyof ThemeColors, string]> = [
  ['bg', '--merkaba-bg-rgb'],
  ['sidebar', '--merkaba-sidebar-rgb'],
  ['elevated', '--merkaba-elevated-rgb'],
  ['surface', '--merkaba-surface-rgb'],
  ['hover', '--merkaba-hover-rgb'],
  ['accent', '--merkaba-accent-rgb'],
  ['accentHover', '--merkaba-accent-hover-rgb'],
  ['text', '--merkaba-text-rgb'],
  ['muted', '--merkaba-muted-rgb'],
];

export function getCachedTheme(): ThemeId {
  try {
    return normalizeThemeId(localStorage.getItem(STORAGE_KEY) ?? undefined);
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(themeId: ThemeId): void {
  const theme = THEME_MAP[themeId] ?? THEME_MAP[DEFAULT_THEME];
  const root = document.documentElement;

  root.dataset.theme = theme.id;
  root.classList.toggle('theme-light', theme.id === 'daylight');

  for (const [key, cssVar] of CSS_VARS) {
    root.style.setProperty(cssVar, theme.colors[key]);
  }

  for (const [key, cssVar] of RGB_VARS) {
    const hex = theme.colors[key];
    if (hex.startsWith('#')) {
      root.style.setProperty(cssVar, hexToRgbChannels(hex));
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    // ignore quota errors
  }

  window.merkaba?.setWindowBackground?.(theme.colors.bg);
}

export function readThemeColor(cssVar: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
}
