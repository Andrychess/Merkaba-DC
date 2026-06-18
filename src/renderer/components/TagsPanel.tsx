import { useEffect, useMemo, useState } from 'react';
import type { OpenFile } from '@shared/types';
import { useAppStore } from '../stores/appStore';
import {
  buildTagIndex,
  collectTaggedNotes,
  filterNotesByTags,
  type TaggedNote,
} from '../utils/note-tree';
import { IconSearch } from './Icons';
import { NoteTypeIcon } from './NoteTypeIcon';

function mergeOpenFileTags(notes: TaggedNote[], openFiles: OpenFile[]): TaggedNote[] {
  const openByPath = new Map(openFiles.map((file) => [file.path, file]));
  return notes.map((note) => {
    const open = openByPath.get(note.path);
    if (open?.meta.tags) {
      return { ...note, tags: open.meta.tags };
    }
    return note;
  });
}

export function TagsPanel() {
  const fileTree = useAppStore((s) => s.fileTree);
  const openFiles = useAppStore((s) => s.openFiles);
  const activeFile = useAppStore((s) => s.activeFile);
  const openFile = useAppStore((s) => s.openFile);
  const enrichFileTree = useAppStore((s) => s.enrichFileTree);

  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    void enrichFileTree();
  }, [enrichFileTree]);

  const taggedNotes = useMemo(
    () => mergeOpenFileTags(collectTaggedNotes(fileTree), openFiles),
    [fileTree, openFiles]
  );

  const tagIndex = useMemo(() => buildTagIndex(taggedNotes), [taggedNotes]);

  const filteredTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tagIndex;
    return tagIndex.filter((entry) => entry.tag.toLowerCase().includes(q));
  }, [tagIndex, query]);

  const matchingNotes = useMemo(
    () => filterNotesByTags(taggedNotes, selectedTags),
    [taggedNotes, selectedTags]
  );

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((value) => value !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-2 border-b border-merkaba-border shrink-0">
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-merkaba-muted pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск тега…"
            className="w-full h-8 pl-8 pr-2 text-sm rounded-lg bg-merkaba-surface border border-merkaba-border text-merkaba-text placeholder:text-merkaba-muted focus:outline-none focus:border-merkaba-accent/50"
          />
        </div>
      </div>

      {tagIndex.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-merkaba-muted leading-relaxed">
            Нет тегов. Добавьте их в свойствах заметки — поле «Теги» в панели справа.
          </p>
        </div>
      ) : (
        <>
          <div className="p-2 border-b border-merkaba-border shrink-0 max-h-[40%] overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {filteredTags.length === 0 ? (
                <p className="text-xs text-merkaba-muted px-1">Ничего не найдено</p>
              ) : (
                filteredTags.map(({ tag, count }) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                        active
                          ? 'bg-merkaba-accent-soft text-merkaba-accent'
                          : 'bg-merkaba-surface text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover'
                      }`}
                    >
                      <span>{tag}</span>
                      <span className="opacity-70">{count}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 py-1">
            {selectedTags.length === 0 ? (
              <p className="px-4 py-6 text-xs text-merkaba-muted text-center leading-relaxed">
                Выберите тег, чтобы увидеть заметки
              </p>
            ) : matchingNotes.length === 0 ? (
              <p className="px-4 py-6 text-xs text-merkaba-muted text-center">
                Нет заметок с выбранными тегами
              </p>
            ) : (
              matchingNotes.map((note) => {
                const isActive = note.path === activeFile;
                return (
                  <button
                    key={note.path}
                    type="button"
                    onClick={() => openFile(note.path)}
                    className={`w-full flex items-center gap-2 mx-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
                      isActive
                        ? 'bg-merkaba-accent-soft text-merkaba-text'
                        : 'text-merkaba-muted hover:bg-merkaba-hover hover:text-merkaba-text'
                    }`}
                  >
                    <NoteTypeIcon
                      noteType={note.noteType}
                      colorId={note.color}
                      active={isActive}
                    />
                    <span className="flex-1 truncate">{note.title}</span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
