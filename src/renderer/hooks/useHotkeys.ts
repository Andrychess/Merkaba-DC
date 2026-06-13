import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { isTypingTarget } from '../utils/focus';

function comboFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('control');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  parts.push(e.key.toLowerCase());
  return parts.join('+');
}

export function useHotkeys() {
  const {
    saveFile,
    toggleEditorMode,
    focusFileSearch,
    openDocumentFind,
    setSidebarMode,
    createNewNote,
    createNewFolder,
    closeFile,
    activeFile,
  } = useAppStore();

  useEffect(() => {
    const handlers: Record<string, (e: KeyboardEvent) => void> = {
      'control+n': (e) => {
        e.preventDefault();
        createNewNote();
      },
      'control+shift+n': (e) => {
        e.preventDefault();
        createNewFolder();
      },
      'control+s': (e) => {
        e.preventDefault();
        saveFile();
      },
      'control+f': (e) => {
        e.preventDefault();
        if (activeFile) {
          openDocumentFind('find');
        } else {
          focusFileSearch();
        }
      },
      'control+h': (e) => {
        e.preventDefault();
        if (activeFile) {
          openDocumentFind('replace');
        }
      },
      'control+shift+f': (e) => {
        e.preventDefault();
        focusFileSearch();
      },
      'control+g': (e) => {
        e.preventDefault();
        setSidebarMode('graph');
      },
      'control+e': (e) => {
        e.preventDefault();
        toggleEditorMode();
      },
      'control+w': (e) => {
        e.preventDefault();
        if (activeFile) closeFile(activeFile);
      },
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const combo = comboFromEvent(e);
      const typing = isTypingTarget(e.target);
      // Сохранение — из любого поля; остальные глобальные — только вне ввода
      if (typing && combo !== 'control+s') return;
      handlers[combo]?.(e);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    saveFile,
    toggleEditorMode,
    focusFileSearch,
    openDocumentFind,
    setSidebarMode,
    createNewNote,
    createNewFolder,
    closeFile,
    activeFile,
  ]);
}
