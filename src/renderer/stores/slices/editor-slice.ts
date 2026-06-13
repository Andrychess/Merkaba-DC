import { composeNote, ensureNoteMeta, parseNote, setFrontmatterColor } from '@shared/frontmatter';
import { applyTitleHeading, getNoteDisplayTitle } from '@shared/note-heading';
import { toggleTaskLine } from '@shared/markdown-tasks';
import { getSpaceForPath, isSpaceId, persistActiveSpace } from '@shared/spaces';
import { collectFilePaths, setTreeNodeColor } from '@renderer/utils/note-tree';
import type { AppSlice, AppState } from '../app-state';

export const createEditorSlice: AppSlice<Pick<
  AppState,
  | 'openFiles'
  | 'activeFile'
  | 'openFile'
  | 'closeFile'
  | 'setActiveFile'
  | 'updateContent'
  | 'updateNoteMeta'
  | 'saveFile'
  | 'toggleCheckbox'
  | 'setNoteColor'
>> = (set, get) => ({
  openFiles: [],
  activeFile: null,

  openFile: async (filePath) => {
    try {
      const space = getSpaceForPath(filePath);
      const { openFiles, activeSpace } = get();
      const existing = openFiles.find((f) => f.path === filePath);

      const spaceUpdate =
        isSpaceId(space) && space !== activeSpace
          ? { activeSpace: space, selectedFolder: space }
          : {};

      if (spaceUpdate.activeSpace) {
        persistActiveSpace(spaceUpdate.activeSpace);
      }

      if (!existing) {
        const content = await window.merkaba.readFile(filePath);
        const { meta, body } = parseNote(content);
        let normalizedBody = body;
        let nextMeta = meta;
        if (meta.noteType === 'text') {
          const applied = applyTitleHeading(body);
          normalizedBody = applied.body;
          if (applied.title) nextMeta = { ...meta, title: applied.title };
        }
        set({
          ...spaceUpdate,
          openFiles: [
            ...openFiles,
            {
              path: filePath,
              content: composeNote(nextMeta, normalizedBody),
              body: normalizedBody,
              meta: nextMeta,
              isDirty: false,
              color: nextMeta.color,
            },
          ],
          activeFile: filePath,
        });
      } else {
        set({ ...spaceUpdate, activeFile: filePath });
      }

      const opened = get().openFiles.find((f) => f.path === filePath);
      const displayTitle = opened
        ? getNoteDisplayTitle(opened.meta.title, opened.body, filePath)
        : filePath.split('/').pop()?.replace('.md', '') || 'Merkaba';
      await window.merkaba.setTitle(`${displayTitle} — Merkaba`);
    } catch (err) {
      set({ statusMessage: `Ошибка открытия файла: ${err}` });
    }
  },

  closeFile: (filePath) => {
    const { openFiles, activeFile } = get();
    const newOpen = openFiles.filter((f) => f.path !== filePath);
    const newActive =
      activeFile === filePath
        ? newOpen.length > 0
          ? newOpen[newOpen.length - 1].path
          : null
        : activeFile;

    set({ openFiles: newOpen, activeFile: newActive });
  },

  setActiveFile: (filePath) => {
    set({ activeFile: filePath });
    const file = get().openFiles.find((f) => f.path === filePath);
    const displayTitle = file
      ? getNoteDisplayTitle(file.meta.title, file.body, filePath)
      : filePath.split('/').pop()?.replace('.md', '') || 'Merkaba';
    window.merkaba.setTitle(`${displayTitle} — Merkaba`);
  },

  updateContent: (body) => {
    const { activeFile, openFiles } = get();
    if (!activeFile) return;

    set({
      openFiles: openFiles.map((f) => {
        if (f.path !== activeFile) return f;

        if (f.meta.noteType === 'text') {
          const { body: normalizedBody, title } = applyTitleHeading(body);
          const meta = title ? { ...f.meta, title } : f.meta;
          const content = composeNote(ensureNoteMeta(meta), normalizedBody);
          if (title) window.merkaba.setTitle(`${title} — Merkaba`);
          return { ...f, body: normalizedBody, content, meta, isDirty: true };
        }

        const content = composeNote(ensureNoteMeta(f.meta), body);
        return { ...f, body, content, isDirty: true };
      }),
    });
  },

  updateNoteMeta: (patch) => {
    const { activeFile, openFiles } = get();
    if (!activeFile) return;

    set({
      openFiles: openFiles.map((f) => {
        if (f.path !== activeFile) return f;
        const meta = { ...f.meta, ...patch };
        let body = f.body;

        if (patch.title !== undefined && f.meta.noteType === 'text') {
          const lines = body.split('\n');
          const idx = lines.findIndex((line) => line.trim().length > 0);
          if (idx !== -1) {
            lines[idx] = patch.title?.trim() ? `# ${patch.title.trim()}` : '#';
          } else if (patch.title?.trim()) {
            lines.unshift(`# ${patch.title.trim()}`);
          }
          body = lines.join('\n');
        } else if (f.meta.noteType === 'text') {
          const applied = applyTitleHeading(body);
          body = applied.body;
          if (applied.title) meta.title = applied.title;
        }

        const content = composeNote(meta, body);
        return { ...f, meta, body, content, color: meta.color, isDirty: true };
      }),
    });
  },

  saveFile: async () => {
    const { activeFile, openFiles, fileTree } = get();
    let file = getActiveOpenFile(get().openFiles, get().activeFile);
    if (!activeFile || !file) return;

    let targetPath = activeFile;

    try {
      if (file.meta.noteType === 'text' && file.meta.title?.trim()) {
        const existing = collectFilePaths(fileTree);
        existing.delete(activeFile);
        const nextPath = resolveNotePathForTitle(file.meta.title, activeFile, existing);
        if (nextPath) {
          await window.merkaba.renameFile(activeFile, nextPath);
          targetPath = nextPath;
          set({
            openFiles: openFiles.map((f) =>
              f.path === activeFile ? { ...f, path: nextPath } : f
            ),
            activeFile: nextPath,
          });
          file = get().openFiles.find((f) => f.path === nextPath) ?? file;
        }
      }

      const saved = await window.merkaba.writeFile(targetPath, file.content);
      const { meta, body } = parseNote(saved);
      set({
        openFiles: get().openFiles.map((f) =>
          f.path === targetPath
            ? { ...f, content: saved, body, meta, color: meta.color, isDirty: false }
            : f
        ),
        statusMessage: 'Сохранено',
      });
      void get().refreshFileTree();
    } catch (err) {
      set({ statusMessage: `Ошибка сохранения: ${err}` });
    }
  },

  toggleCheckbox: async (filePath, bodyLine) => {
    const openFile = get().openFiles.find((f) => f.path === filePath);
    if (!openFile) return;

    const newBody = toggleTaskLine(openFile.body, bodyLine);
    if (!newBody) return;

    const { body: normalizedBody, title } = applyTitleHeading(newBody);
    const meta = ensureNoteMeta({
      ...openFile.meta,
      modified: new Date().toISOString(),
      ...(title ? { title } : {}),
    });
    const content = composeNote(meta, normalizedBody);

    set({
      openFiles: get().openFiles.map((f) =>
        f.path === filePath ? { ...f, body: normalizedBody, content, meta, isDirty: true } : f
      ),
    });

    try {
      await window.merkaba.writeFile(filePath, content);
      set({
        openFiles: get().openFiles.map((f) =>
          f.path === filePath ? { ...f, isDirty: false } : f
        ),
      });
    } catch (err) {
      set({ statusMessage: `Ошибка переключения задачи: ${err}` });
    }
  },

  setNoteColor: async (filePath, colorId) => {
    try {
      const { openFiles, fileTree, archiveTree } = get();
      const open = openFiles.find((f) => f.path === filePath);

      let updated: string;
      if (open) {
        const meta = { ...open.meta, color: colorId };
        updated = composeNote(meta, open.body);
      } else {
        const content = await window.merkaba.readFile(filePath);
        updated = setFrontmatterColor(content, colorId);
      }

      await window.merkaba.writeFile(filePath, updated);
      const parsed = parseNote(updated);

      set({
        openFiles: openFiles.map((f) =>
          f.path === filePath
            ? {
                ...f,
                content: updated,
                body: parsed.body,
                meta: parsed.meta,
                color: colorId,
                isDirty: false,
              }
            : f
        ),
        fileTree: setTreeNodeColor(fileTree, filePath, colorId),
        archiveTree: setTreeNodeColor(archiveTree, filePath, colorId),
        statusMessage: colorId ? 'Цвет заметки обновлён' : 'Цвет снят',
      });
    } catch (err) {
      set({ statusMessage: `Ошибка: ${err}` });
    }
  },
});
