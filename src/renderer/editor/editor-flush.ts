export interface EditorFlushResult {
  path: string;
  body: string;
}

type FlushHandler = () => EditorFlushResult | null;

let flushHandler: FlushHandler | null = null;

export function registerEditorFlush(handler: FlushHandler | null): void {
  flushHandler = handler;
}

/** Считать текст из активного редактора (без записи в store). */
export function readActiveEditorBody(): EditorFlushResult | null {
  return flushHandler?.() ?? null;
}
