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
    setSidebarPanelOpen,
    createNewNote,
    openNewFolderDialog,
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
        openNewFolderDialog();
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
        setSidebarMode('tags');
        setSidebarPanelOpen(true);
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
      // В режиме просмотра форматирование обрабатывает сам редактор
      if (typing && combo !== 'control+s' && combo !== 'control+e') return;
      handlers[combo]?.(e);
    };

    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;

      const state = useAppStore.getState();
      if (
        state.showSettings ||
        state.showConflicts ||
        state.showSyncFilesDialog ||
        state.syncErrorMessage ||
        state.newFolderDialogParent
      ) {
        return;
      }

      if (document.querySelector('[data-find-replace-bar]')) return;

      e.preventDefault();
      state.toggleSidebarPanel();
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keydown', onEscape);
    };
  }, [
    saveFile,
    toggleEditorMode,
    focusFileSearch,
    openDocumentFind,
    setSidebarMode,
    setSidebarPanelOpen,
    createNewNote,
    openNewFolderDialog,
    closeFile,
    activeFile,
  ]);
}
