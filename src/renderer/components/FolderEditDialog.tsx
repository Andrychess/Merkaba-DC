import { useEffect, useRef, useState } from 'react';
import {
  formatSpaceLabel,
  getFolderSymbol,
  getSpaceSymbol,
  isSpaceId,
  normalizeSpaceSymbol,
  sanitizeSpaceName,
} from '@shared/spaces';
import { useAppStore } from '../stores/appStore';
import { SpaceSymbolPicker } from './SpaceSymbolPicker';

interface FolderEditDialogProps {
  folderPath: string;
  folderName: string;
  onClose: () => void;
}

function folderPathSegment(path: string): string {
  const norm = path.replace(/\\/g, '/');
  const slash = norm.lastIndexOf('/');
  return slash === -1 ? norm : norm.slice(slash + 1);
}

export function FolderEditDialog({ folderPath, folderName, onClose }: FolderEditDialogProps) {
  const spaceSymbols = useAppStore((s) => s.spaceSymbols);
  const renameFolder = useAppStore((s) => s.renameFolder);
  const setSpaceSymbol = useAppStore((s) => s.setSpaceSymbol);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);

  const isSpace = isSpaceId(folderPath);
  const initialLabel = isSpace ? formatSpaceLabel(folderName) : folderName;
  const initialSymbol = isSpace
    ? getSpaceSymbol(folderPath, spaceSymbols)
    : (getFolderSymbol(folderPath, spaceSymbols) ?? '📁');

  const [name, setName] = useState(initialLabel);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const trimmed = name.trim();
  const slugPreview = trimmed ? sanitizeSpaceName(trimmed) : '';
  const showSlugHint = Boolean(slugPreview && slugPreview !== trimmed);

  const handleSave = async () => {
    if (saving || !trimmed || !slugPreview) return;

    const oldSegment = folderPathSegment(folderPath);
    const normPath = folderPath.replace(/\\/g, '/');
    let targetPath = normPath;

    setSaving(true);
    try {
      if (slugPreview !== oldSegment) {
        await renameFolder(folderPath, trimmed);
        targetPath = normPath.includes('/')
          ? `${normPath.slice(0, normPath.lastIndexOf('/') + 1)}${slugPreview}`
          : slugPreview;
      }

      const nextSymbol = normalizeSpaceSymbol(symbol) || initialSymbol;
      setSpaceSymbol(targetPath, nextSymbol);
      onClose();
    } catch {
      setStatusMessage('Не удалось сохранить папку');
    } finally {
      setSaving(false);
    }
  };

  const title = isSpace ? 'Переименовать пространство' : 'Переименовать папку';

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-merkaba-sidebar border border-merkaba-border-strong rounded-2xl max-w-sm w-full mx-4 shadow-panel p-5"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && !e.shiftKey) void handleSave();
        }}
      >
        <h2 className="text-lg font-semibold text-merkaba-text mb-1">{title}</h2>
        <p className="text-xs text-merkaba-muted mb-4">
          {isSpace
            ? 'Название и символ отображаются в переключателе пространств.'
            : 'Символ показывается в дереве файлов вместо стандартной иконки.'}
        </p>

        <label className="block text-xs text-merkaba-muted mb-1.5">Символ</label>
        <SpaceSymbolPicker value={symbol} onChange={setSymbol} className="mb-4" />

        <label className="block text-xs text-merkaba-muted mb-1.5">Название</label>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isSpace ? 'например: работа' : 'имя папки'}
          className="input-field mb-1"
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
            onClick={() => void handleSave()}
            disabled={!trimmed || !slugPreview || saving}
            className="btn-primary flex-1"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
