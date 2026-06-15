import type { StateCreator } from 'zustand';
import type {
  Config,
  ConflictFile,
  FileNode,
  GraphData,
  NoteMeta,
  OpenFile,
  SearchResult,
} from '@shared/types';
import type { NoteType } from '@shared/note-types';

export interface AppState {
  initialized: boolean;
  fileTree: FileNode[];
  archiveTree: FileNode[];
  pinnedNotes: string[];
  openFiles: OpenFile[];
  activeFile: string | null;
  sidebarMode: 'files' | 'board' | 'graph' | 'archive';
  sidebarPanelOpen: boolean;
  sidebarPanelWidth: number;
  editorMode: 'source' | 'preview';
  searchQuery: string;
  searchResults: SearchResult[];
  fileSearchFocusToken: number;
  editorBodyFocusToken: number;
  documentFindToken: number;
  documentFindMode: 'find' | 'replace';
  graph: GraphData;
  conflicts: ConflictFile[];
  showConflicts: boolean;
  showSettings: boolean;
  config: Config;
  statusMessage: string;
  stickersRevision: number;
  selectedFolder: string;
  activeSpace: string;
  spaceSymbols: Record<string, string>;
  newFolderDialogParent: string | null;

  setInitialized: (value: boolean) => void;
  setSidebarMode: (mode: AppState['sidebarMode']) => void;
  toggleSidebarPanel: () => void;
  setSidebarPanelOpen: (open: boolean) => void;
  setSidebarPanelWidth: (width: number) => void;
  setEditorMode: (mode: AppState['editorMode']) => void;
  toggleEditorMode: () => void;
  setSearchQuery: (query: string) => void;
  setShowConflicts: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setStatusMessage: (message: string) => void;
  bumpStickers: () => void;
  focusFileSearch: () => void;
  openDocumentFind: (mode: 'find' | 'replace') => void;
  setSelectedFolder: (path: string) => void;
  setActiveSpace: (spaceId: string) => void;
  setSpaceSymbol: (spaceId: string, symbol: string) => void;
  setConfig: (config: Config) => void;
  openNewFolderDialog: (parentPath?: string) => void;
  closeNewFolderDialog: () => void;

  restoreSession: () => Promise<boolean>;
  bootstrapAfterAuth: () => Promise<void>;
  confirmAuthCode: (code: string) => Promise<void>;
  saveManualToken: (token: string) => Promise<void>;
  syncPull: (options?: { initial?: boolean }) => Promise<void>;
  retryFailedSync: (paths?: string[]) => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  closeFile: (filePath: string) => void;
  setActiveFile: (filePath: string) => void;
  updateContent: (body: string) => void;
  updateNoteMeta: (patch: Partial<NoteMeta>) => void;
  saveFile: () => Promise<void>;
  refreshFileTree: () => Promise<void>;
  refreshArchiveTree: () => Promise<void>;
  clearArchive: () => Promise<void>;
  loadPinnedNotes: () => Promise<void>;
  pinNote: (path: string) => Promise<void>;
  unpinNote: (path: string) => Promise<void>;
  search: (query: string) => Promise<void>;
  loadGraph: () => Promise<void>;
  loadConflicts: () => Promise<void>;
  toggleCheckbox: (filePath: string, line: number) => Promise<void>;
  resolveConflict: (file: string, choice: 'main' | 'conflict') => Promise<void>;
  createNewNote: (folderPath?: string, noteType?: NoteType) => Promise<void>;
  createNewFolder: (parentPath?: string, name?: string) => Promise<string | null>;
  createSpaceWithName: (name: string, symbol?: string) => Promise<void>;
  deleteFile: (filePath: string) => Promise<void>;
  deleteFolder: (folderPath: string) => Promise<void>;
  moveItem: (itemPath: string, targetFolderPath: string) => Promise<void>;
  renameFile: (oldPath: string, newName: string) => Promise<void>;
  renameFolder: (oldPath: string, newName: string) => Promise<void>;
  setNoteColor: (filePath: string, colorId: string | null) => Promise<void>;
}

export type AppSlice<T extends Partial<AppState>> = StateCreator<AppState, [], [], T>;
