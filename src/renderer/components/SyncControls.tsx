import { IconList } from './Icons';
import { SyncButton } from './SyncButton';
import { SyncFilesDialog } from './SyncFilesDialog';
import { useAppStore } from '../stores/appStore';

export function SyncControls() {
  const showSyncFilesDialog = useAppStore((s) => s.showSyncFilesDialog);
  const openSyncFilesDialog = useAppStore((s) => s.openSyncFilesDialog);
  const closeSyncFilesDialog = useAppStore((s) => s.closeSyncFilesDialog);

  return (
    <>
      <div className="flex items-center gap-0.5">
        <SyncButton />
        <button
          type="button"
          onClick={() => openSyncFilesDialog()}
          title="Список файлов на Диске"
          className="p-1.5 rounded-full text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover border border-transparent hover:border-merkaba-border transition-colors"
        >
          <IconList className="w-3.5 h-3.5" />
        </button>
      </div>
      {showSyncFilesDialog && <SyncFilesDialog onClose={() => closeSyncFilesDialog()} />}
    </>
  );
}
