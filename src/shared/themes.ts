export type ThemeId = 'midnight' | 'daylight' | 'ocean' | 'forest' | 'amethyst' | 'sunset';

export interface ThemeColors {
  bg: string;
  sidebar: string;
  elevated: string;
  surface: string;
  hover: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  text: string;
  muted: string;
  border: string;
  borderStrong: string;
  shadowPanel: string;
  shadowGlow: string;
  graphLink: string;
  graphNodeStroke: string;
  scrollbar: string;
  scrollbarHover: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  colors: ThemeColors;
}

const midnight: ThemeColors = {
  bg: '#0c0c10',
  sidebar: '#111118',
  elevated: '#18181f',
  surface: '#1f1f2a',
  hover: '#28283a',
  accent: '#f43f5e',
  accentHover: '#e11d48',
  accentSoft: 'rgba(244, 63, 94, 0.12)',
  text: '#f4f4f5',
  muted: '#8b8b9a',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  shadowPanel: '0 4px 24px rgba(0, 0, 0, 0.4)',
  shadowGlow: '0 0 20px rgba(244, 63, 94, 0.15)',
  graphLink: 'rgba(255, 255, 255, 0.1)',
  graphNodeStroke: 'rgba(255, 255, 255, 0.2)',
  scrollbar: 'rgba(255, 255, 255, 0.1)',
  scrollbarHover: 'rgba(255, 255, 255, 0.18)',
};

const daylight: ThemeColors = {
  bg: '#f4f4f6',
  sidebar: '#ffffff',
  elevated: '#ececf0',
  surface: '#e4e4e9',
  hover: '#d8d8e0',
  accent: '#e11d48',
  accentHover: '#be123c',
  accentSoft: 'rgba(225, 29, 72, 0.1)',
  text: '#18181b',
  muted: '#71717a',
  border: 'rgba(0, 0, 0, 0.08)',
  borderStrong: 'rgba(0, 0, 0, 0.14)',
  shadowPanel: '0 4px 24px rgba(0, 0, 0, 0.08)',
  shadowGlow: '0 0 20px rgba(225, 29, 72, 0.12)',
  graphLink: 'rgba(0, 0, 0, 0.1)',
  graphNodeStroke: 'rgba(0, 0, 0, 0.15)',
  scrollbar: 'rgba(0, 0, 0, 0.12)',
  scrollbarHover: 'rgba(0, 0, 0, 0.2)',
};

export const THEMES: ThemeDefinition[] = [
  { id: 'midnight', label: 'Полночь', colors: midnight },
  { id: 'daylight', label: 'День', colors: daylight },
  {
    id: 'ocean',
    label: 'Океан',
    colors: {
      ...midnight,
      bg: '#0a0f1a',
      sidebar: '#0f1629',
      elevated: '#141e33',
      surface: '#1a2740',
      hover: '#223352',
      accent: '#0ea5e9',
      accentHover: '#0284c7',
      accentSoft: 'rgba(14, 165, 233, 0.12)',
      shadowGlow: '0 0 20px rgba(14, 165, 233, 0.15)',
    },
  },
  {
    id: 'forest',
    label: 'Лес',
    colors: {
      ...midnight,
      bg: '#0a120e',
      sidebar: '#0f1812',
      elevated: '#142019',
      surface: '#1a2a20',
      hover: '#223528',
      accent: '#10b981',
      accentHover: '#059669',
      accentSoft: 'rgba(16, 185, 129, 0.12)',
      shadowGlow: '0 0 20px rgba(16, 185, 129, 0.15)',
    },
  },
  {
    id: 'amethyst',
    label: 'Аметист',
    colors: {
      ...midnight,
      bg: '#0f0a18',
      sidebar: '#14101f',
      elevated: '#1b1528',
      surface: '#231c33',
      hover: '#2d2540',
      accent: '#8b5cf6',
      accentHover: '#7c3aed',
      accentSoft: 'rgba(139, 92, 246, 0.12)',
      shadowGlow: '0 0 20px rgba(139, 92, 246, 0.15)',
    },
  },
  {
    id: 'sunset',
    label: 'Закат',
    colors: {
      ...midnight,
      bg: '#120c0a',
      sidebar: '#18110e',
      elevated: '#211814',
      surface: '#2a201a',
      hover: '#352a22',
      accent: '#f59e0b',
      accentHover: '#d97706',
      accentSoft: 'rgba(245, 158, 11, 0.12)',
      shadowGlow: '0 0 20px rgba(245, 158, 11, 0.15)',
    },
  },
];

export const THEME_MAP = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<ThemeId, ThemeDefinition>;

export const DEFAULT_THEME: ThemeId = 'midnight';

export function isThemeId(value: string): value is ThemeId {
  return value in THEME_MAP;
}

export function normalizeThemeId(value: string | undefined): ThemeId {
  if (!value) return DEFAULT_THEME;
  if (value === 'dark') return 'midnight';
  if (value === 'light') return 'daylight';
  if (isThemeId(value)) return value;
  return DEFAULT_THEME;
}

export function hexToRgbChannels(hex: string): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}
