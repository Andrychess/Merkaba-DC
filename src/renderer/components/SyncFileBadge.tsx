import type { FileSyncStatus } from '@shared/sync';

interface SyncFileBadgeProps {
  status?: FileSyncStatus;
  className?: string;
}

const STATUS_COLOR: Record<FileSyncStatus, string> = {
  synced: '#34d399',
  pending: '#fbbf24',
  failed: '#f87171',
};

export function SyncFileBadge({ status, className = '' }: SyncFileBadgeProps) {
  if (!status) return null;

  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: STATUS_COLOR[status] }}
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
      <SyncFileBadge status="failed" />
    </div>
  );
}
