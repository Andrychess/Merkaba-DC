import type { ThemeId } from '@shared/themes';
import { THEMES } from '@shared/themes';

interface ThemePickerProps {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {THEMES.map((theme) => {
        const selected = value === theme.id;
        const { colors } = theme;

        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onChange(theme.id)}
            className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors ${
              selected
                ? 'border-merkaba-accent bg-merkaba-accent-soft ring-1 ring-merkaba-accent/30'
                : 'border-merkaba-border bg-merkaba-elevated hover:bg-merkaba-hover'
            }`}
          >
            <span
              className="w-9 h-9 rounded-lg shrink-0 border border-merkaba-border overflow-hidden grid grid-cols-2 grid-rows-2"
              aria-hidden
            >
              <span style={{ backgroundColor: colors.bg }} />
              <span style={{ backgroundColor: colors.sidebar }} />
              <span style={{ backgroundColor: colors.accent }} />
              <span style={{ backgroundColor: colors.elevated }} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-merkaba-text">{theme.label}</span>
              <span
                className="block text-[10px] text-merkaba-muted truncate"
                style={{ color: selected ? undefined : colors.muted }}
              >
                {colors.accent}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
