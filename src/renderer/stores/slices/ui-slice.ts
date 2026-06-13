import { defaultConfig } from '@shared/types';
import { loadSpaceSymbols, persistActiveSpace, persistSpaceSymbols } from '@shared/spaces';
import type { AppSlice, AppState } from '../app-state';

export const createUiSlice: AppSlice<Pick<
  AppState,
  | 'sidebarMode'
  | 'sidebarPanelOpen'
  | 'editorMode'
  | 'searchQuery'
  | 'searchResults'
  | 'graph'
  | 'showConflicts'
  | 'showSettings'
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
  | 'setEditorMode'
  | 'toggleEditorMode'
  | 'setSearchQuery'
  | 'setShowConflicts'
  | 'setShowSettings'
  | 'setStatusMessage'
  | 'bumpStickers'
  | 'focusFileSearch'
  | 'openDocumentFind'
  | 'setSelectedFolder'
  | 'setActiveSpace'
  | 'setSpaceSymbol'
  | 'setConfig'
>> = (set, get) => ({
  sidebarMode: 'files',
  sidebarPanelOpen: true,
  editorMode: 'preview',
  searchQuery: '',
  searchResults: [],
  graph: { nodes: [], edges: [] },
  showConflicts: false,
  showSettings: false,
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

  setInitialized: (value) => set({ initialized: value }),
  setSidebarMode: (mode) => set({ sidebarMode: mode }),
  toggleSidebarPanel: () => set((s) => ({ sidebarPanelOpen: !s.sidebarPanelOpen })),
  setSidebarPanelOpen: (open) => set({ sidebarPanelOpen: open }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  toggleEditorMode: () =>
    set((s) => ({ editorMode: s.editorMode === 'source' ? 'preview' : 'source' })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setShowConflicts: (show) => set({ showConflicts: show }),
  setShowSettings: (show) => set({ showSettings: show }),
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
});
