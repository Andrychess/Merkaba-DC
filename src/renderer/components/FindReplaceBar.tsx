import { useEffect, useRef } from 'react';
import type { SourceEditorHandle } from './SourceEditor';
import type { PreviewEditorHandle } from './PreviewEditor';

interface FindReplaceBarProps {
  open: boolean;
  mode: 'find' | 'replace';
  editorMode: 'source' | 'preview';
  query: string;
  replacement: string;
  onQueryChange: (value: string) => void;
  onReplacementChange: (value: string) => void;
  onClose: () => void;
  sourceRef: React.RefObject<SourceEditorHandle | null>;
  previewRef: React.RefObject<PreviewEditorHandle | null>;
}

export function FindReplaceBar({
  open,
  mode,
  editorMode,
  query,
  replacement,
  onQueryChange,
  onReplacementChange,
  onClose,
  sourceRef,
  previewRef,
}: FindReplaceBarProps) {
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 30);
    }
  }, [open, mode]);

  if (!open) return null;

  const runFind = (direction: 'next' | 'prev') => {
    const editor = editorMode === 'source' ? sourceRef.current : previewRef.current;
    if (!editor) return;
    if (direction === 'next') {
      editor.findNext(query);
    } else {
      editor.findPrevious(query);
    }
  };

  const runReplace = (all: boolean) => {
    const editor = editorMode === 'source' ? sourceRef.current : previewRef.current;
    if (!editor) return;
    if (all) {
      editor.replaceAll(query, replacement);
    } else {
      editor.replaceOne(query, replacement);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-merkaba-elevated border-b border-merkaba-border shrink-0">
      <label className="flex items-center gap-1.5 text-xs text-merkaba-muted">
        <span className="w-14 shrink-0">Найти</span>
        <input
          ref={findInputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            } else if (e.key === 'Enter') {
              e.preventDefault();
              runFind(e.shiftKey ? 'prev' : 'next');
            }
          }}
          placeholder="Текст для поиска"
          className="input-field !py-1.5 !text-xs w-44 min-w-[8rem]"
        />
      </label>

      {mode === 'replace' && (
        <label className="flex items-center gap-1.5 text-xs text-merkaba-muted">
          <span className="w-14 shrink-0">Заменить</span>
          <input
            value={replacement}
            onChange={(e) => onReplacementChange(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'Enter') {
                e.preventDefault();
                runReplace(false);
              }
            }}
            placeholder="Новый текст"
            className="input-field !py-1.5 !text-xs w-44 min-w-[8rem]"
          />
        </label>
      )}

      <div className="flex items-center gap-1">
        <button type="button" onClick={() => runFind('prev')} className="btn-ghost !text-xs !py-1.5" title="Shift+Enter">
          ↑
        </button>
        <button type="button" onClick={() => runFind('next')} className="btn-ghost !text-xs !py-1.5" title="Enter">
          ↓
        </button>
        {mode === 'replace' && (
          <>
            <button type="button" onClick={() => runReplace(false)} className="btn-secondary !text-xs !py-1.5">
              Заменить
            </button>
            <button type="button" onClick={() => runReplace(true)} className="btn-secondary !text-xs !py-1.5">
              Все
            </button>
          </>
        )}
        <button type="button" onClick={onClose} className="btn-ghost !text-xs !py-1.5" title="Esc">
          ✕
        </button>
      </div>

      <span className="text-[10px] text-merkaba-muted ml-auto hidden sm:inline">
        {mode === 'replace' ? 'Ctrl+H' : 'Ctrl+F'}
      </span>
    </div>
  );
}
