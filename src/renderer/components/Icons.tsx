import { useId, type CSSProperties } from 'react';

interface IconProps {
  className?: string;
  style?: CSSProperties;
}

const LOGO = {
  rose: '#CB5762',
  gold: '#CBAE57',
  bg: '#1B1B2C',
  glowStart: '#7A93FF',
  glowEnd: '#4C5CA2',
} as const;

const LOGO_MARK_VIEWBOX = '90 80 580 590';
const LOGO_ICON_VIEWBOX = '0 0 747 747';

function LogoCircles({ glowId }: { glowId?: string }) {
  return (
    <>
      {glowId && (
        <ellipse
          opacity="0.3"
          cx="372.784"
          cy="373.784"
          rx="358.522"
          ry="530.849"
          transform="rotate(45 372.784 373.784)"
          fill={`url(#${glowId})`}
        />
      )}
      <circle cx="278.5" cy="468.5" r="188.5" fill={LOGO.rose} />
      <circle cx="467" cy="280" r="191" fill={LOGO.gold} />
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
  const glowId = useId();

  return (
    <svg className={className} viewBox={LOGO_ICON_VIEWBOX} fill="none" aria-hidden>
      <defs>
        <radialGradient
          id={glowId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(372.784 373.784) rotate(90) scale(530.849 358.522)"
        >
          <stop offset="0%" stopColor={LOGO.glowStart} />
          <stop offset="100%" stopColor={LOGO.glowEnd} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="747" height="747" rx="100" fill={LOGO.bg} />
      <LogoCircles glowId={glowId} />
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

export function IconGraph({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 17l8-9M8 17h8" />
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
