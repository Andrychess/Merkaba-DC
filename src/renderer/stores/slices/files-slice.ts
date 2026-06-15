import { ARCHIVE_FOLDER, isArchivePath } from '@shared/archive';
import { parseNote } from '@shared/frontmatter';
import { titleToFileName } from '@shared/note-heading';
import {
  isSpaceId,
  persistActiveSpace,
  persistSpaceSymbols,
  resolveActiveSpace,
  sanitizeSpaceName,
  getSpaceSymbol,
} from '@shared/spaces';
import { applyTextNoteTitle } from '@renderer/utils/note-helpers';
import {
  collectFilePaths,
  countNotes,
  insertFileIntoTree,
  insertFolderIntoTree,
  remapPath,
  treeHasPath,
} from '@renderer/utils/note-tree';
import type { AppSlice, AppState } from '../app-state';

export const createFilesSlice: AppSlice<Pick<
  AppState,
  | 'fileTree'
  | 'archiveTree'
  | 'pinnedNotes'
  | 'conflicts'
  | 'refreshFileTree'
  | 'refreshArchiveTree'
  | 'clearArchive'
  | 'loadPinnedNotes'
  | 'pinNote'
  | 'unpinNote'
  | 'search'
  | 'loadGraph'
  | 'loadConflicts'
  | 'resolveConflict'
  | 'createNewNote'
  | 'createNewFolder'
  | 'createSpaceWithName'
  | 'deleteFile'
  | 'deleteFolder'
  | 'moveItem'
  | 'renameFile'
  | 'renameFolder'
>> = (set, get) => ({
  fileTree: [],
  archiveTree: [],
  pinnedNotes: [],
  conflicts: [],

  refreshFileTree: async () => {
    try {
      const fileTree = await window.merkaba.getFileTree();
      const noteCount = countNotes(fileTree);
      const { activeSpace, selectedFolder } = get();
      const resolvedSpace = resolveActiveSpace(fileTree, activeSpace);
      const folderStillValid =
        selectedFolder === resolvedSpace || selectedFolder.startsWith(`${resolvedSpace}/`);
      set({
        fileTree,
        activeSpace: resolvedSpace,
        selectedFolder: folderStillValid ? selectedFolder : resolvedSpace,
        statusMessage: `${noteCount} заметок`,
      });
      if (resolvedSpace !== activeSpace) {
        persistActiveSpace(resolvedSpace);
      }
      await Promise.all([get().refreshArchiveTree(), get().loadPinnedNotes()]);
    } catch (err) {
      set({ statusMessage: `Ошибка обновления: ${err}` });
    }
  },

  refreshArchiveTree: async () => {
    try {
      const archiveTree = await window.merkaba.getArchiveTree();
      set({ archiveTree });
    } catch {
      set({ archiveTree: [] });
    }
  },

  clearArchive: async () => {
    try {
      const { mdFiles } = await window.merkaba.clearArchive();
      for (const file of mdFiles) {
        get().closeFile(file);
      }
      for (const open of get().openFiles) {
        if (isArchivePath(open.path)) {
          get().closeFile(open.path);
        }
      }
      await get().refreshArchiveTree();
      set({ statusMessage: 'Архив очищен' });
    } catch (err) {
      set({ statusMessage: `Ошибка очистки архива: ${err}` });
    }
  },

  loadPinnedNotes: async () => {
    try {
      const pinnedNotes = await window.merkaba.getPinnedNotes();
      set({ pinnedNotes });
    } catch {
      set({ pinnedNotes: [] });
    }
  },

  pinNote: async (path) => {
    try {
      const pinnedNotes = await window.merkaba.pinNote(path);
      set({ pinnedNotes, statusMessage: 'Заметка закреплена' });
    } catch (err) {
      set({ statusMessage: `Ошибка закрепления: ${err}` });
    }
  },

  unpinNote: async (path) => {
    try {
      const pinnedNotes = await window.merkaba.unpinNote(path);
      set({ pinnedNotes, statusMessage: 'Закрепление снято' });
    } catch (err) {
      set({ statusMessage: `Ошибка: ${err}` });
    }
  },

  search: async (query) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    const results = await window.merkaba.search(query);
    set({ searchResults: results });
  },

  loadGraph: async () => {
    const graph = await window.merkaba.getGraph();
    set({ graph });
  },

  loadConflicts: async () => {
    const conflicts = await window.merkaba.getConflicts();
    set({ conflicts, showConflicts: conflicts.length > 0 });
  },

  resolveConflict: async (file, choice) => {
    await window.merkaba.resolveConflict(file, choice);
    await get().loadConflicts();
    await get().refreshFileTree();
    set({ statusMessage: 'Конфликт разрешён' });
  },

  createNewNote: async (folderPath, noteType = 'text') => {
    const { activeSpace, selectedFolder } = get();
    let target = folderPath ?? selectedFolder ?? activeSpace;
    if (target === ARCHIVE_FOLDER || target.startsWith(`${ARCHIVE_FOLDER}/`)) {
      target = activeSpace;
    }
    const prefix = noteType === 'drawing' ? 'risunok' : noteType === 'music' ? 'pesnya' : 'zametka';
    const name = noteType === 'text' ? 'Новая заметка' : `${prefix}-${Date.now()}`;
    try {
      const path = await window.merkaba.createNote(target, name, noteType);
      const resolvedType = noteType === 'drawing' || noteType === 'music' ? noteType : 'text';
      set((s) => ({
        fileTree: insertFileIntoTree(s.fileTree, path, resolvedType, name, ''),
      }));
      await get().openFile(path);
      void get().refreshFileTree();
      const labels = { text: 'Заметка', drawing: 'Рисунок', music: 'Песня' };
      set((s) => ({
        statusMessage: `${labels[noteType]} создана`,
        ...(noteType === 'text' ? { editorBodyFocusToken: s.editorBodyFocusToken + 1 } : {}),
      }));
    } catch (err) {
      set({ statusMessage: `Ошибка создания: ${err}` });
    }
  },

  createNewFolder: async (parentPath, rawName) => {
    const { activeSpace, selectedFolder } = get();
    let base = parentPath ?? selectedFolder ?? activeSpace;
    if (base === ARCHIVE_FOLDER || base.startsWith(`${ARCHIVE_FOLDER}/`)) {
      base = activeSpace;
    }

    const slug = sanitizeSpaceName(rawName?.trim() ?? '');
    if (!slug) {
      set({ statusMessage: 'Недопустимое имя папки' });
      return null;
    }

    const path = `${base}/${slug}`;
    if (treeHasPath(get().fileTree, path)) {
      set({ statusMessage: 'Папка с таким именем уже есть', selectedFolder: path });
      return path;
    }

    try {
      await window.merkaba.createFolder(path);
      set((s) => ({
        fileTree: insertFolderIntoTree(s.fileTree, path),
        selectedFolder: path,
        statusMessage: 'Папка создана',
      }));
      void get().refreshFileTree();
      return path;
    } catch (err) {
      set({ statusMessage: `Ошибка создания папки: ${err}` });
      return null;
    }
  },

  createSpaceWithName: async (raw, symbol) => {
    const id = sanitizeSpaceName(raw);
    if (!id) {
      set({ statusMessage: 'Недопустимое название пространства' });
      return;
    }

    const exists = get().fileTree.some((n) => n.type === 'folder' && n.path === id);
    if (exists) {
      set({ statusMessage: 'Пространство с таким именем уже есть' });
      get().setActiveSpace(id);
      return;
    }

    try {
      await window.merkaba.createFolder(id);
      set((s) => ({
        fileTree: insertFolderIntoTree(s.fileTree, id),
      }));
      void get().refreshFileTree();
      if (symbol) {
        get().setSpaceSymbol(id, symbol);
      }
      get().setActiveSpace(id);
      set({ statusMessage: `Пространство «${id}» создано` });
    } catch (err) {
      set({ statusMessage: `Ошибка создания пространства: ${err}` });
    }
  },

  deleteFile: async (filePath) => {
    try {
      await window.merkaba.deleteFile(filePath);
      get().closeFile(filePath);
      await get().refreshFileTree();
      set({ statusMessage: 'Перемещено в архив' });
    } catch (err) {
      set({ statusMessage: `Ошибка архивации: ${err}` });
    }
  },

  deleteFolder: async (folderPath) => {
    try {
      const { mdFiles } = await window.merkaba.deleteFolder(folderPath);
      for (const file of mdFiles) {
        get().closeFile(file);
      }
      const wasSpace = isSpaceId(folderPath);
      await get().refreshFileTree();
      if (
        wasSpace ||
        get().selectedFolder === folderPath ||
        get().selectedFolder.startsWith(`${folderPath}/`)
      ) {
        const resolved = resolveActiveSpace(get().fileTree, get().activeSpace);
        persistActiveSpace(resolved);
        set({ activeSpace: resolved, selectedFolder: resolved });
      }
      set({
        statusMessage: wasSpace ? 'Пространство удалено' : 'Папка удалена',
      });
    } catch (err) {
      set({ statusMessage: `Ошибка архивации: ${err}` });
    }
  },

  moveItem: async (itemPath, targetFolderPath) => {
    try {
      const newPath = await window.merkaba.moveItem(itemPath, targetFolderPath);
      const { openFiles, activeFile } = get();
      const isFolder = !itemPath.endsWith('.md');

      set({
        openFiles: openFiles.map((f) => ({
          ...f,
          path: remapPath(f.path, itemPath, newPath, isFolder),
        })),
        activeFile: activeFile ? remapPath(activeFile, itemPath, newPath, isFolder) : null,
      });
      await get().refreshFileTree();
      set({ statusMessage: 'Перемещено' });
    } catch (err) {
      set({ statusMessage: `Ошибка перемещения: ${err}` });
    }
  },

  renameFile: async (oldPath, newName) => {
    const title = newName.trim();
    if (!title) return;

    const dir = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : '';
    const sanitized = titleToFileName(title) || 'zametka';
    const newPath = dir ? `${dir}/${sanitized}.md` : `${sanitized}.md`;

    try {
      const { openFiles, activeFile, fileTree } = get();
      let open = openFiles.find((f) => f.path === oldPath);

      if (open?.meta.noteType === 'text') {
        open = applyTextNoteTitle(open, title);
        await window.merkaba.writeFile(oldPath, open.content);
      } else if (!open) {
        try {
          const content = await window.merkaba.readFile(oldPath);
          const { meta, body } = parseNote(content);
          if (meta.noteType === 'text') {
            const updated = applyTextNoteTitle(
              { path: oldPath, content, body, meta, isDirty: false, color: meta.color },
              title
            );
            await window.merkaba.writeFile(oldPath, updated.content);
          }
        } catch {
          // только переименование
        }
      }

      if (newPath !== oldPath) {
        const exists = collectFilePaths(fileTree).has(newPath);
        if (exists) {
          set({ statusMessage: 'Заметка с таким именем уже есть' });
          return;
        }
        await window.merkaba.renameFile(oldPath, newPath);
      }

      set({
        openFiles: openFiles.map((f) => {
          if (f.path !== oldPath) return f;
          const next = open ?? f;
          return newPath !== oldPath ? { ...next, path: newPath } : next;
        }),
        activeFile: activeFile === oldPath ? (newPath !== oldPath ? newPath : activeFile) : activeFile,
      });
      await get().refreshFileTree();
      set({ statusMessage: 'Заметка переименована' });
    } catch (err) {
      set({ statusMessage: `Ошибка переименования: ${err}` });
    }
  },

  renameFolder: async (oldPath, newName) => {
    const normalized = oldPath.replace(/\\/g, '/');
    if (isArchivePath(normalized) || normalized === 'attachments') {
      set({ statusMessage: 'Эту папку нельзя переименовать' });
      return;
    }

    const sanitized = sanitizeSpaceName(newName);
    if (!sanitized) {
      set({ statusMessage: 'Недопустимое имя папки' });
      return;
    }

    const parent = normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';
    const newPath = parent ? `${parent}/${sanitized}` : sanitized;
    if (newPath === normalized) return;

    try {
      await window.merkaba.renameFile(normalized, newPath);

      const { openFiles, activeFile, selectedFolder, activeSpace, spaceSymbols } = get();
      const wasSpace = isSpaceId(normalized);

      let nextSpaceSymbols = spaceSymbols;
      const oldSym = spaceSymbols[normalized] ?? (wasSpace ? getSpaceSymbol(normalized, spaceSymbols) : null);
      if (oldSym) {
        nextSpaceSymbols = { ...spaceSymbols, [newPath]: oldSym };
        delete nextSpaceSymbols[normalized];
        persistSpaceSymbols(nextSpaceSymbols);
      }

      const nextActiveSpace = activeSpace === normalized ? newPath : remapPath(activeSpace, normalized, newPath, true);

      set({
        openFiles: openFiles.map((f) => ({
          ...f,
          path: remapPath(f.path, normalized, newPath, true),
        })),
        activeFile: activeFile ? remapPath(activeFile, normalized, newPath, true) : null,
        selectedFolder: remapPath(selectedFolder, normalized, newPath, true),
        activeSpace: nextActiveSpace,
        spaceSymbols: nextSpaceSymbols,
      });

      if (wasSpace || activeSpace === normalized) {
        persistActiveSpace(nextActiveSpace);
      }

      await get().refreshFileTree();
      set({ statusMessage: wasSpace ? 'Пространство переименовано' : 'Папка переименована' });
    } catch (err) {
      set({ statusMessage: `Ошибка переименования: ${err}` });
    }
  },
});
