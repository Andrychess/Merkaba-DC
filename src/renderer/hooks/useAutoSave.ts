import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';

export function useAutoSave() {
  const activeFile = useAppStore((s) => s.activeFile);
  const dirtyContent = useAppStore((s) => {
    const file = s.openFiles.find((f) => f.path === s.activeFile);
    return file?.isDirty ? file.content : null;
  });
  const saveFile = useAppStore((s) => s.saveFile);
  const flushEditorToStore = useAppStore((s) => s.flushEditorToStore);
  const config = useAppStore((s) => s.config);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirtyContent) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void saveFile();
    }, config.autoSaveInterval);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeFile, dirtyContent, saveFile, config.autoSaveInterval]);

  useEffect(() => {
    const onBlur = () => {
      flushEditorToStore();
      const { activeFile: path, openFiles } = useAppStore.getState();
      const file = openFiles.find((f) => f.path === path);
      if (file?.isDirty) {
        void saveFile();
      }
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [saveFile, flushEditorToStore]);
}
