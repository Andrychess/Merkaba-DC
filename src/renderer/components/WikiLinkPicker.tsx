import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { flattenNotes, toWikiLinkTarget, findNoteColor } from '../utils/note-tree';
import { IconLink, IconSearch } from './Icons';
import { NoteColorDot } from './NoteColorPicker';

interface WikiLinkPickerProps {
  activePath: string;
  content: string;
  onInsert: (targetPath: string) => void;
}

function hasWikiLink(content: string, targetPath: string): boolean {
  const target = toWikiLinkTarget(targetPath).toLowerCase();
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const linked = match[1].replace(/\.md$/i, '').toLowerCase();
    if (linked === target) return true;
  }
  return false;
}

export function WikiLinkPicker({ activePath, content, onInsert }: WikiLinkPickerProps) {
  const fileTree = useAppStore((s) => s.fileTree);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const notes = useMemo(() => flattenNotes(fileTree, activePath), [fileTree, activePath]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (note) =>
        note.name.toLowerCase().includes(q) ||
        note.path.toLowerCase().includes(q)
    );
  }, [notes, query]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (path: string) => {
    onInsert(path);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Связать с заметкой"
        className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs transition-all duration-100 ${
          open
            ? 'bg-merkaba-accent-soft text-merkaba-accent'
            : 'text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover'
        }`}
      >
        <IconLink className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Связать</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-merkaba-elevated border border-merkaba-border-strong rounded-xl shadow-panel animate-fade-in overflow-hidden">
          <div className="p-2 border-b border-merkaba-border">
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-merkaba-muted pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти заметку..."
                autoFocus
                className="input-field !pl-8 !py-1.5 !text-xs !rounded-lg"
              />
            </div>
            <p className="text-[10px] text-merkaba-muted mt-1.5 px-0.5">
              Добавляет wiki-ссылку для графа связей
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-merkaba-muted px-3 py-4 text-center">
                {notes.length === 0 ? 'Нет других заметок' : 'Ничего не найдено'}
              </p>
            ) : (
              filtered.map((note) => {
                const linked = hasWikiLink(content, note.path);
                const colorId = findNoteColor(fileTree, note.path);

                return (
                  <button
                    key={note.path}
                    type="button"
                    onClick={() => handleSelect(note.path)}
                    className="w-full text-left px-3 py-2 hover:bg-merkaba-hover transition-colors flex items-center gap-2"
                  >
                    <NoteColorDot colorId={colorId} className="w-2 h-2" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-merkaba-text truncate">{note.name}</div>
                      <div className="text-[10px] text-merkaba-muted truncate">{note.path}</div>
                    </div>
                    {linked && (
                      <span className="text-[10px] text-merkaba-accent shrink-0">связана</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
