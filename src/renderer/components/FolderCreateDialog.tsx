import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { folderEditInitialName, getFolderSymbol, sanitizeSpaceName } from '@shared/spaces';
import { useAppStore } from '../stores/appStore';
import { SpaceSymbolPicker } from './SpaceSymbolPicker';

interface FolderCreateDialogProps {
  parentPath: string;
  onClose: () => void;
}

export function FolderCreateDialog({ parentPath, onClose }: FolderCreateDialogProps) {
  const createNewFolder = useAppStore((s) => s.createNewFolder);
  const setSpaceSymbol = useAppStore((s) => s.setSpaceSymbol);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('📁');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const trimmed = name.trim();
  const slugPreview = trimmed ? sanitizeSpaceName(trimmed) : '';
  const showSlugHint = Boolean(slugPreview && slugPreview !== trimmed);

  const handleCreate = async () => {
    if (saving || !trimmed || !slugPreview) return;

    setSaving(true);
    try {
      const path = await createNewFolder(parentPath, trimmed);
      if (path) {
        setSpaceSymbol(path, symbol);
      }
      onClose();
    } catch {
      setStatusMessage('Не удалось создать папку');
    } finally {
      setSaving(false);
    }
  };

  const dialog = (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] animate-fade-in app-no-drag"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-merkaba-sidebar border border-merkaba-border-strong rounded-2xl max-w-sm w-full mx-4 shadow-panel p-5"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <h2 className="text-lg font-semibold text-merkaba-text mb-1">Новая папка</h2>
        <p className="text-xs text-merkaba-muted mb-4">
          Внутри «{folderEditInitialName(parentPath.split('/').pop() ?? parentPath)}»
        </p>

        <label className="block text-xs text-merkaba-muted mb-1.5">Символ</label>
        <SpaceSymbolPicker value={symbol} onChange={setSymbol} className="mb-4" />

        <label className="block text-xs text-merkaba-muted mb-1.5">Название</label>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleCreate();
            }
          }}
          placeholder="например: проекты"
          className="input-field mb-1 app-no-drag"
          autoComplete="off"
        />
        {showSlugHint && (
          <p className="text-[10px] text-merkaba-muted mb-4 px-0.5">
            На диске: <span className="font-mono">{slugPreview}</span>
          </p>
        )}
        {trimmed && !slugPreview && (
          <p className="text-[10px] text-red-400/90 mb-4 px-0.5">Недопустимое имя</p>
        )}
        {(!showSlugHint && (!trimmed || slugPreview)) && <div className="mb-4" />}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!trimmed || !slugPreview || saving}
            className="btn-primary flex-1"
          >
            {saving ? 'Создание...' : 'Создать'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
