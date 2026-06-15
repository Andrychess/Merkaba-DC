import { useState } from 'react';
import { IconList } from './Icons';
import { SyncButton } from './SyncButton';
import { SyncFilesDialog } from './SyncFilesDialog';

export function SyncControls() {
  const [showFiles, setShowFiles] = useState(false);

  return (
    <>
      <div className="flex items-center gap-0.5">
        <SyncButton />
        <button
          type="button"
          onClick={() => setShowFiles(true)}
          title="Список файлов на Диске"
          className="p-1.5 rounded-full text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover border border-transparent hover:border-merkaba-border transition-colors"
        >
          <IconList className="w-3.5 h-3.5" />
        </button>
      </div>
      {showFiles && <SyncFilesDialog onClose={() => setShowFiles(false)} />}
    </>
  );
}
