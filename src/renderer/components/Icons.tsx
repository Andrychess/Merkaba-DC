import { useId, type CSSProperties } from 'react';

interface IconProps {
  className?: string;
  style?: CSSProperties;
}

const LOGO = {
  rose: '#D96671',
  gold: '#D6B555',
  bg: '#1B1B2C',
  bgCenter: '#242436',
} as const;

const LOGO_MARK_VIEWBOX = '90 80 580 590';
const LOGO_ICON_VIEWBOX = '0 0 747 747';

function LogoCircles() {
  return (
    <>
      <circle cx="285" cy="465" r="195" fill={LOGO.rose} />
      <circle cx="480" cy="275" r="145" fill={LOGO.gold} />
    </>
  );
}

/** Компактный знак — для шапки и мелких мест */
export function LogoMark({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg className={className} viewBox={LOGO_MARK_VIEWBOX} fill="none" aria-hidden>
      <LogoCircles />
    </svg>
  );
}

/** Полная иконка с фоном — для welcome, загрузки, favicon */
export function LogoIcon({ className = 'w-10 h-10' }: IconProps) {
  const bgId = useId();

  return (
    <svg className={className} viewBox={LOGO_ICON_VIEWBOX} fill="none" aria-hidden>
      <defs>
        <radialGradient id={bgId} cx="50%" cy="42%" r="72%">
          <stop offset="0%" stopColor={LOGO.bgCenter} />
          <stop offset="100%" stopColor={LOGO.bg} />
        </radialGradient>
      </defs>
      <rect width="747" height="747" rx="100" fill={`url(#${bgId})`} />
      <LogoCircles />
    </svg>
  );
}

/** Быстрое создание текстовой заметки — квадрат с карандашом */
export function IconComposeNote({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function IconFolder({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

export function IconFile({ className = 'w-4 h-4', style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6M10 13h4M10 17h4" />
    </svg>
  );
}

/** Текстовая заметка */
export function IconNoteText({ className = 'w-4 h-4', style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h5" strokeLinecap="round" />
    </svg>
  );
}

/** Рисунок */
export function IconNoteDrawing({ className = 'w-4 h-4', style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 17l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="9" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Музыкальная заметка */
export function IconNoteMusic({ className = 'w-4 h-4', style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18V6l10-3v12" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="15" r="3" />
    </svg>
  );
}

export function IconSearch({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

export function IconCheck({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function IconBoard({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 17v5" />
      <path d="M9 3h6l1 7H8L9 3z" fill="currentColor" fillOpacity="0.15" />
      <path d="M9 3h6l1 7H8L9 3z" />
      <circle cx="12" cy="14" r="3" />
    </svg>
  );
}

export function IconTag({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconLink({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function IconSettings({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

export function IconPlus({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconCloud({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  );
}

export function IconChevron({ className = 'w-3 h-3', expanded }: IconProps & { expanded?: boolean }) {
  return (
    <svg
      className={`${className} transition-transform ${expanded ? 'rotate-90' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function IconArchive({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h18v4H3V7z" />
      <path d="M5 11v8a1 1 0 001 1h12a1 1 0 001-1v-8" />
      <path d="M10 15h4" />
    </svg>
  );
}

export function IconX({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function IconPin({ className = 'w-4 h-4', filled }: IconProps & { filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 17v5" strokeLinecap="round" />
      <path
        d="M9 3h6l1 7H8L9 3z"
        fill={filled ? 'currentColor' : 'none'}
        fillOpacity={filled ? 0.25 : 0}
      />
      <path d="M9 3h6l1 7H8L9 3z" />
      <circle cx="12" cy="14" r="3" fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.2 : 0} />
      <circle cx="12" cy="14" r="3" />
    </svg>
  );
}

export function IconEye({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconList({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}
