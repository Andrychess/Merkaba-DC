import { useMemo, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { flattenNotes, findNoteInTree } from '../utils/note-tree';
import { IconFile } from './Icons';

interface NoteLinkPickerProps {
  value: string | null;
  onChange: (path: string | null) => void;
}

export function NoteLinkPicker({ value, onChange }: NoteLinkPickerProps) {
  const fileTree = useAppStore((s) => s.fileTree);
  const archiveTree = useAppStore((s) => s.archiveTree);
  const [query, setQuery] = useState('');

  const notes = useMemo(() => {
    const seen = new Set<string>();
    const list = [...flattenNotes(fileTree), ...flattenNotes(archiveTree)];
    return list.filter((note) => {
      if (seen.has(note.path)) return false;
      seen.add(note.path);
      return true;
    });
  }, [fileTree, archiveTree]);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    const node =
      findNoteInTree(fileTree, value) ?? findNoteInTree(archiveTree, value);
    return node?.title || node?.name || value.split('/').pop()?.replace(/\.md$/i, '') || value;
  }, [value, fileTree, archiveTree]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes.slice(0, 24);
    return notes
      .filter(
        (note) =>
          note.name.toLowerCase().includes(q) ||
          note.path.toLowerCase().includes(q) ||
          (findNoteInTree(fileTree, note.path)?.title?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 24);
  }, [notes, query, fileTree]);

  return (
    <div className="space-y-2">
      {value && selectedLabel && (
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-merkaba-elevated border border-merkaba-border">
          <IconFile className="w-4 h-4 shrink-0 text-merkaba-accent" />
          <span className="flex-1 min-w-0 truncate text-sm text-merkaba-text">{selectedLabel}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-merkaba-muted hover:text-red-400 transition-colors shrink-0"
          >
            Убрать
          </button>
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Найти заметку..."
        className="input-field !py-2"
      />

      <div className="max-h-44 overflow-y-auto rounded-lg border border-merkaba-border bg-merkaba-bg/50">
        {filtered.length === 0 ? (
          <p className="text-xs text-merkaba-muted px-3 py-3 text-center">Ничего не найдено</p>
        ) : (
          filtered.map((note) => {
            const node =
              findNoteInTree(fileTree, note.path) ?? findNoteInTree(archiveTree, note.path);
            const label = node?.title || note.name;
            const active = value === note.path;
            return (
              <button
                key={note.path}
                type="button"
                onClick={() => {
                  onChange(note.path);
                  setQuery('');
                }}
                className={`w-full text-left px-3 py-2 border-b border-merkaba-border/50 last:border-0 transition-colors ${
                  active
                    ? 'bg-merkaba-accent-soft text-merkaba-accent'
                    : 'hover:bg-merkaba-hover text-merkaba-text'
                }`}
              >
                <span className="text-sm truncate block">{label}</span>
                <span className="text-[10px] text-merkaba-muted truncate block mt-0.5">{note.path}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
