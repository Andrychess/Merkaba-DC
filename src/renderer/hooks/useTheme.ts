import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { applyTheme } from '../lib/applyTheme';

export function useTheme() {
  const theme = useAppStore((s) => s.config.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
}
