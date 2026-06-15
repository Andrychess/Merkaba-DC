export const SIDEBAR_RAIL_WIDTH = 56;
export const SIDEBAR_PANEL_MIN_WIDTH = 200;
export const SIDEBAR_PANEL_MAX_WIDTH = 560;
export const SIDEBAR_PANEL_DEFAULT_WIDTH = 244;

const STORAGE_KEY = 'merkaba-sidebar-panel-width';

export function clampSidebarPanelWidth(width: number): number {
  return Math.min(SIDEBAR_PANEL_MAX_WIDTH, Math.max(SIDEBAR_PANEL_MIN_WIDTH, Math.round(width)));
}

export function loadSidebarPanelWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SIDEBAR_PANEL_DEFAULT_WIDTH;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return SIDEBAR_PANEL_DEFAULT_WIDTH;
    return clampSidebarPanelWidth(parsed);
  } catch {
    return SIDEBAR_PANEL_DEFAULT_WIDTH;
  }
}

export function persistSidebarPanelWidth(width: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampSidebarPanelWidth(width)));
  } catch {
    // ignore
  }
}
