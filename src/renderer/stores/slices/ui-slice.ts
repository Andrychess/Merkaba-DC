import { defaultConfig } from '@shared/types';
import { loadSpaceSymbols, persistActiveSpace, persistSpaceSymbols } from '@shared/spaces';
import {
  clampSidebarPanelWidth,
  loadSidebarPanelWidth,
  persistSidebarPanelWidth,
} from '@renderer/utils/sidebar-layout';
import type { AppSlice, AppState } from '../app-state';

export const createUiSlice: AppSlice<Pick<
  AppState,
  | 'sidebarMode'
  | 'sidebarPanelOpen'
  | 'sidebarPanelWidth'
  | 'editorMode'
  | 'searchQuery'
  | 'searchResults'
  | 'showConflicts'
  | 'showSettings'
  | 'syncErrorMessage'
  | 'showSyncFilesDialog'
  | 'config'
  | 'statusMessage'
  | 'stickersRevision'
  | 'selectedFolder'
  | 'activeSpace'
  | 'spaceSymbols'
  | 'fileSearchFocusToken'
  | 'editorBodyFocusToken'
  | 'documentFindToken'
  | 'documentFindMode'
  | 'setInitialized'
  | 'setSidebarMode'
  | 'toggleSidebarPanel'
  | 'setSidebarPanelOpen'
  | 'setSidebarPanelWidth'
  | 'setEditorMode'
  | 'toggleEditorMode'
  | 'setSearchQuery'
  | 'setShowConflicts'
  | 'setShowSettings'
  | 'showSyncError'
  | 'dismissSyncError'
  | 'openSyncFilesDialog'
  | 'closeSyncFilesDialog'
  | 'setStatusMessage'
  | 'bumpStickers'
  | 'focusFileSearch'
  | 'openDocumentFind'
  | 'setSelectedFolder'
  | 'setActiveSpace'
  | 'setSpaceSymbol'
  | 'setConfig'
  | 'newFolderDialogParent'
  | 'openNewFolderDialog'
  | 'closeNewFolderDialog'
>> = (set, get) => ({
  sidebarMode: 'files',
  sidebarPanelOpen: true,
  sidebarPanelWidth: loadSidebarPanelWidth(),
  editorMode: 'preview',
  searchQuery: '',
  searchResults: [],
  showConflicts: false,
  showSettings: false,
  syncErrorMessage: null as string | null,
  showSyncFilesDialog: false,
  config: defaultConfig,
  statusMessage: '',
  stickersRevision: 0,
  selectedFolder: 'notes',
  activeSpace: 'notes',
  spaceSymbols: loadSpaceSymbols(),
  fileSearchFocusToken: 0,
  editorBodyFocusToken: 0,
  documentFindToken: 0,
  documentFindMode: 'find',
  newFolderDialogParent: null as string | null,

  setInitialized: (value) => set({ initialized: value }),
  setSidebarMode: (mode) => set({ sidebarMode: mode }),
  toggleSidebarPanel: () => set((s) => ({ sidebarPanelOpen: !s.sidebarPanelOpen })),
  setSidebarPanelOpen: (open) => set({ sidebarPanelOpen: open }),
  setSidebarPanelWidth: (width) => {
    const next = clampSidebarPanelWidth(width);
    persistSidebarPanelWidth(next);
    set({ sidebarPanelWidth: next });
  },
  setEditorMode: (mode) => {
    get().flushEditorToStore();
    set({ editorMode: mode });
  },
  toggleEditorMode: () => {
    get().flushEditorToStore();
    set((s) => ({ editorMode: s.editorMode === 'source' ? 'preview' : 'source' }));
  },
  setSearchQuery: (query) => set({ searchQuery: query }),
  setShowConflicts: (show) => set({ showConflicts: show }),
  setShowSettings: (show) => set({ showSettings: show }),
  showSyncError: (message) => set({ syncErrorMessage: message }),
  dismissSyncError: () => set({ syncErrorMessage: null }),
  openSyncFilesDialog: () => set({ showSyncFilesDialog: true }),
  closeSyncFilesDialog: () => set({ showSyncFilesDialog: false }),
  setStatusMessage: (message) => set({ statusMessage: message }),
  bumpStickers: () => set((s) => ({ stickersRevision: s.stickersRevision + 1 })),
  focusFileSearch: () =>
    set((s) => ({
      sidebarMode: 'files',
      sidebarPanelOpen: true,
      fileSearchFocusToken: s.fileSearchFocusToken + 1,
    })),
  openDocumentFind: (mode) =>
    set((s) => ({
      documentFindMode: mode,
      documentFindToken: s.documentFindToken + 1,
    })),
  setSelectedFolder: (path) => set({ selectedFolder: path }),
  setActiveSpace: (spaceId) => {
    persistActiveSpace(spaceId);
    set({ activeSpace: spaceId, selectedFolder: spaceId });
  },
  setSpaceSymbol: (spaceId, symbol) => {
    const next = { ...get().spaceSymbols, [spaceId]: symbol };
    persistSpaceSymbols(next);
    set({ spaceSymbols: next });
  },
  setConfig: (config) => set({ config }),
  openNewFolderDialog: (parentPath) => {
    const { activeSpace, selectedFolder } = get();
    set({
      newFolderDialogParent: parentPath ?? selectedFolder ?? activeSpace,
      sidebarMode: 'files',
      sidebarPanelOpen: true,
    });
  },
  closeNewFolderDialog: () => set({ newFolderDialogParent: null }),
});
