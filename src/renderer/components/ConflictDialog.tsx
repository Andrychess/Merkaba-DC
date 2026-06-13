import { useAppStore } from '../stores/appStore';

export function ConflictDialog() {
  const conflicts = useAppStore((s) => s.conflicts);
  const showConflicts = useAppStore((s) => s.showConflicts);
  const setShowConflicts = useAppStore((s) => s.setShowConflicts);
  const resolveConflict = useAppStore((s) => s.resolveConflict);

  if (!showConflicts || conflicts.length === 0) return null;

  const conflict = conflicts[0];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-merkaba-sidebar border border-merkaba-border-strong rounded-2xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col shadow-panel">
        <div className="p-5 border-b border-merkaba-border">
          <h2 className="text-lg font-semibold text-merkaba-text">Конфликт синхронизации</h2>
          <p className="text-sm text-merkaba-muted mt-1">
            {conflict.mainPath}
            {conflicts.length > 1 && ` · ещё ${conflicts.length - 1}`}
          </p>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden min-h-0">
          <div className="flex flex-col border-r border-merkaba-border">
            <div className="px-4 py-2.5 bg-merkaba-elevated text-xs font-semibold uppercase tracking-wider text-merkaba-muted">
              Основная версия
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap text-merkaba-text/90">
              {conflict.mainContent}
            </pre>
          </div>
          <div className="flex flex-col">
            <div className="px-4 py-2.5 bg-merkaba-elevated text-xs font-semibold uppercase tracking-wider text-merkaba-muted">
              Конфликтная копия
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap text-merkaba-text/90">
              {conflict.conflictContent}
            </pre>
          </div>
        </div>

        <div className="flex gap-2 p-5 border-t border-merkaba-border">
          <button
            onClick={() => resolveConflict(conflict.mainPath, 'main')}
            className="btn-secondary flex-1"
          >
            Оставить основную
          </button>
          <button
            onClick={() => resolveConflict(conflict.mainPath, 'conflict')}
            className="btn-primary flex-1"
          >
            Оставить конфликтную
          </button>
          <button onClick={() => setShowConflicts(false)} className="btn-ghost">
            Позже
          </button>
        </div>
      </div>
    </div>
  );
}
