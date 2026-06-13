import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';

export function useAutoSave() {
  const { activeFile, openFiles, saveFile, config } = useAppStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const file = openFiles.find((f) => f.path === activeFile);
    if (!file?.isDirty) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      saveFile();
    }, config.autoSaveInterval);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeFile, openFiles, saveFile, config.autoSaveInterval]);
}
