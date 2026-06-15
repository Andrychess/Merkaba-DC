import type { FileSyncStatus } from '@shared/sync';

interface SyncFileBadgeProps {
  status?: FileSyncStatus;
  className?: string;
}

export function SyncFileBadge({ status, className = '' }: SyncFileBadgeProps) {
  if (!status) return null;

  const synced = status === 'synced';

  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: synced ? '#34d399' : '#fbbf24' }}
      aria-hidden
    />
  );
}

export function SyncLegend() {
  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-1.5 border-t border-merkaba-border/60"
      aria-hidden
    >
      <SyncFileBadge status="synced" />
      <SyncFileBadge status="pending" />
    </div>
  );
}
