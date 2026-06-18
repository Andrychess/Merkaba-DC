import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../stores/appStore';
import { IconX } from './Icons';

export function SyncErrorDialog() {
  const syncErrorMessage = useAppStore((s) => s.syncErrorMessage);
  const dismissSyncError = useAppStore((s) => s.dismissSyncError);
  const syncPull = useAppStore((s) => s.syncPull);
  const retryFailedSync = useAppStore((s) => s.retryFailedSync);
  const openSyncFilesDialog = useAppStore((s) => s.openSyncFilesDialog);

  useEffect(() => {
    if (!syncErrorMessage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissSyncError();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [syncErrorMessage, dismissSyncError]);

  if (!syncErrorMessage) return null;

  const isPartialFailure = syncErrorMessage.includes('• ');

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[2100] animate-fade-in p-4 app-no-drag"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismissSyncError();
      }}
    >
      <div
        className="bg-merkaba-sidebar border border-red-500/30 rounded-2xl max-w-lg w-full shadow-panel max-h-[min(85vh,560px)] flex flex-col"
        role="alertdialog"
        aria-labelledby="sync-error-title"
        aria-describedby="sync-error-body"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-merkaba-border shrink-0">
          <div>
            <h2 id="sync-error-title" className="text-lg font-semibold text-red-400">
              {isPartialFailure ? 'Синхронизация с ошибками' : 'Ошибка синхронизации'}
            </h2>
            <p className="text-xs text-merkaba-muted mt-1">
              {isPartialFailure
                ? 'Часть файлов не удалось отправить на Яндекс.Диск'
                : 'Не удалось синхронизировать с Яндекс.Диском'}
            </p>
          </div>
          <button type="button" onClick={dismissSyncError} className="btn-ghost p-1.5" title="Закрыть">
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 min-h-0 flex-1 overflow-y-auto">
          <pre
            id="sync-error-body"
            className="text-sm text-merkaba-text whitespace-pre-wrap break-words font-sans leading-relaxed px-3 py-3 rounded-xl bg-merkaba-bg border border-merkaba-border"
          >
            {syncErrorMessage}
          </pre>
        </div>

        <div className="flex flex-wrap gap-2 p-5 border-t border-merkaba-border shrink-0">
          <button
            type="button"
            onClick={() => {
              dismissSyncError();
              void (isPartialFailure ? retryFailedSync() : syncPull());
            }}
            className="btn-primary flex-1 min-w-[7rem]"
          >
            Повторить
          </button>
          {isPartialFailure && (
            <button
              type="button"
              onClick={() => {
                dismissSyncError();
                openSyncFilesDialog();
              }}
              className="btn-secondary flex-1 min-w-[7rem] !text-xs"
            >
              Список файлов
            </button>
          )}
          <button type="button" onClick={dismissSyncError} className="btn-ghost flex-1 min-w-[7rem]">
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
