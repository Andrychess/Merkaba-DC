import { create } from 'zustand';
import type { AppState } from './app-state';
import { createUiSlice } from './slices/ui-slice';
import { createSessionSlice } from './slices/session-slice';
import { createEditorSlice } from './slices/editor-slice';
import { createFilesSlice } from './slices/files-slice';

export const useAppStore = create<AppState>()((...args) => ({
  ...createUiSlice(...args),
  ...createSessionSlice(...args),
  ...createEditorSlice(...args),
  ...createFilesSlice(...args),
}));

export type { AppState } from './app-state';
