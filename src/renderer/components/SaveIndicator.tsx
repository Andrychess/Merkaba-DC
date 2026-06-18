import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { IconCheck } from './Icons';

export function SaveIndicator() {
  const activeFile = useAppStore((s) => s.activeFile);
  const openFile = useAppStore((s) => s.openFiles.find((f) => f.path === s.activeFile));

  const saveState = openFile?.saveState;
  const isDirty = openFile?.isDirty ?? false;

  useEffect(() => {
    if (!activeFile || saveState !== 'saved') return;
    const timer = setTimeout(() => {
      useAppStore.setState((state) => ({
        openFiles: state.openFiles.map((f) =>
          f.path === activeFile && f.saveState === 'saved' ? { ...f, saveState: undefined } : f
        ),
      }));
    }, 2500);
    return () => clearTimeout(timer);
  }, [activeFile, saveState]);

  if (!openFile) return null;

  if (saveState === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-merkaba-muted shrink-0" aria-live="polite">
        <span className="w-3 h-3 border-2 border-merkaba-accent/30 border-t-merkaba-accent rounded-full animate-spin" />
        Сохранение…
      </span>
    );
  }

  if (saveState === 'error') {
    return (
      <span className="text-xs text-red-400 shrink-0" aria-live="assertive" title="Не удалось сохранить">
        Ошибка сохранения
      </span>
    );
  }

  if (saveState === 'saved') {
    return (
      <span
        className="flex items-center gap-1 text-xs text-emerald-400 shrink-0 animate-fade-in"
        aria-live="polite"
      >
        <IconCheck className="w-3.5 h-3.5" />
        Сохранено
      </span>
    );
  }

  if (isDirty) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-400/90 shrink-0" aria-live="polite">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Не сохранено
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-merkaba-muted/70 shrink-0">
      <IconCheck className="w-3 h-3 opacity-60" />
      Сохранено
    </span>
  );
}
