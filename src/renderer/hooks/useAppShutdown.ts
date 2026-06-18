import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';

export function useAppShutdown() {
  useEffect(() => {
    return window.merkaba.onPrepareShutdown(async () => {
      const { flushEditorToStore, openFiles, saveFile } = useAppStore.getState();
      flushEditorToStore();
      for (const file of openFiles) {
        if (file.isDirty) {
          await saveFile(file.path);
        }
      }
    });
  }, []);
}
