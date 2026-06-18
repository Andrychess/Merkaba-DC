import type { SyncFailedOp } from '@shared/sync';

export function formatSyncFailedMessage(ops: SyncFailedOp[]): string {
  if (ops.length === 0) {
    return 'Не удалось синхронизировать часть файлов.';
  }
  return ops
    .map((op) => {
      const err = simplifyApiError(op.error);
      return `• ${op.path}\n  ${err}`;
    })
    .join('\n\n');
}

function simplifyApiError(raw: string): string {
  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as { message?: string; description?: string };
      if (parsed.message) return parsed.message;
      if (parsed.description) return parsed.description;
    } catch {
      // keep raw
    }
  }
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}
