import { useEffect, useRef, useState } from 'react';
import type { FileNode } from '@shared/types';
import {
  formatSpaceLabel,
  getSpaceSymbol,
  getSpacesFromTree,
  normalizeSpaceSymbol,
  SPACE_SYMBOL_PRESETS,
} from '@shared/spaces';
import { useAppStore } from '../stores/appStore';
import { IconChevron, IconPlus } from './Icons';

interface SpaceSwitcherProps {
  fileTree: FileNode[];
}

function SpaceSymbolPicker({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (symbol: string) => void;
  className?: string;
}) {
  const [custom, setCustom] = useState('');

  return (
    <div className={className}>
      <div className="grid grid-cols-9 gap-1 mb-2">
        {SPACE_SYMBOL_PRESETS.map((sym) => (
          <button
            key={sym}
            type="button"
            onClick={() => onChange(sym)}
            className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors ${
              value === sym
                ? 'bg-merkaba-accent-soft ring-1 ring-merkaba-accent/40'
                : 'hover:bg-merkaba-hover'
            }`}
          >
            {sym}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-merkaba-muted shrink-0">Свой</span>
        <input
          value={custom}
          onChange={(e) => {
            const next = normalizeSpaceSymbol(e.target.value);
            setCustom(e.target.value);
            if (next) onChange(next);
          }}
          placeholder="эмодзи"
          maxLength={4}
          className="input-field !py-1.5 !text-sm w-20 text-center"
        />
      </div>
    </div>
  );
}

export function SpaceSwitcher({ fileTree }: SpaceSwitcherProps) {
  const activeSpace = useAppStore((s) => s.activeSpace);
  const spaceSymbols = useAppStore((s) => s.spaceSymbols);
  const setActiveSpace = useAppStore((s) => s.setActiveSpace);
  const setSpaceSymbol = useAppStore((s) => s.setSpaceSymbol);
  const createSpaceWithName = useAppStore((s) => s.createSpaceWithName);
  const deleteFolder = useAppStore((s) => s.deleteFolder);

  const [open, setOpen] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('📂');
  const [creating, setCreating] = useState(false);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const spaces = getSpacesFromTree(fileTree);
  const activeLabel = formatSpaceLabel(activeSpace);
  const activeSymbol = getSpaceSymbol(activeSpace, spaceSymbols);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingSymbol(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (showDialog) {
      setName('');
      setSymbol('📂');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showDialog]);

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await createSpaceWithName(name.trim(), symbol);
      setShowDialog(false);
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const selectSpace = (path: string) => {
    setActiveSpace(path);
    setOpen(false);
    setEditingSymbol(null);
  };

  const archiveSpace = (space: FileNode) => {
    if (confirm(`Переместить пространство «${formatSpaceLabel(space.name)}» в архив?`)) {
      deleteFolder(space.path);
      setOpen(false);
    }
  };

  return (
    <>
      <div ref={rootRef} className="px-3 pt-3 pb-2 border-b border-merkaba-border shrink-0 relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl bg-merkaba-elevated border border-merkaba-border hover:bg-merkaba-hover hover:border-merkaba-border-strong transition-colors text-left"
          title="Переключить пространство"
        >
          <span className="text-base leading-none shrink-0 w-6 text-center" aria-hidden>
            {activeSymbol}
          </span>
          <span className="flex-1 min-w-0 text-sm font-medium text-merkaba-text truncate">
            {activeLabel}
          </span>
          <IconChevron expanded={open} className="w-3.5 h-3.5 shrink-0 text-merkaba-muted" />
        </button>

        {open && (
          <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-merkaba-sidebar border border-merkaba-border-strong rounded-xl shadow-panel overflow-hidden animate-fade-in">
            {spaces.length === 0 ? (
              <div className="px-3 py-3 text-xs text-merkaba-muted text-center">
                Нет пространств
              </div>
            ) : (
              <ul className="py-1 max-h-56 overflow-y-auto">
                {spaces.map((space) => {
                  const sym = getSpaceSymbol(space.path, spaceSymbols);
                  const label = formatSpaceLabel(space.name);
                  const active = space.path === activeSpace;
                  const editing = editingSymbol === space.path;

                  return (
                    <li key={space.path}>
                      {editing ? (
                        <div className="px-2 py-2 border-b border-merkaba-border">
                          <p className="text-[10px] text-merkaba-muted mb-1.5 px-1">{label}</p>
                          <SpaceSymbolPicker
                            value={sym}
                            onChange={(next) => {
                              setSpaceSymbol(space.path, next);
                              setEditingSymbol(null);
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => selectSpace(space.path)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              archiveSpace(space);
                            }}
                            className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                              active
                                ? 'bg-merkaba-accent-soft text-merkaba-accent'
                                : 'text-merkaba-text hover:bg-merkaba-hover'
                            }`}
                          >
                            <span className="w-6 text-center text-base leading-none shrink-0">{sym}</span>
                            <span className="truncate">{label}</span>
                            {active && (
                              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-merkaba-accent shrink-0" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSymbol(space.path);
                            }}
                            title="Изменить символ"
                            className="px-2 py-2 text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover transition-colors text-xs shrink-0"
                          >
                            ✎
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="border-t border-merkaba-border p-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowDialog(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover transition-colors"
              >
                <IconPlus className="w-3.5 h-3.5" />
                Новое пространство
              </button>
            </div>
          </div>
        )}
      </div>

      {showDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in">
          <div
            className="bg-merkaba-sidebar border border-merkaba-border-strong rounded-2xl max-w-sm w-full mx-4 shadow-panel p-5"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowDialog(false);
              if (e.key === 'Enter' && !e.shiftKey) handleCreate();
            }}
          >
            <h2 className="text-lg font-semibold text-merkaba-text mb-1">Новое пространство</h2>
            <p className="text-xs text-merkaba-muted mb-4">
              Папка верхнего уровня на Яндекс.Диске — как «Заметки» или «Проекты».
            </p>

            <label className="block text-xs text-merkaba-muted mb-1.5">Символ</label>
            <SpaceSymbolPicker value={symbol} onChange={setSymbol} className="mb-4" />

            <label className="block text-xs text-merkaba-muted mb-1.5">Название</label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="например: работа"
              className="input-field mb-4"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={!name.trim() || creating}
                className="btn-primary flex-1"
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
              <button type="button" onClick={() => setShowDialog(false)} className="btn-ghost">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
