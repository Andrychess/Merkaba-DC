import { composeNote, ensureNoteMeta } from '@shared/frontmatter';
import { applyTitleHeading } from '@shared/note-heading';
import type { OpenFile } from '@shared/types';

export function patchFileBody(openFiles: OpenFile[], filePath: string, body: string): OpenFile[] {
  return openFiles.map((f) => {
    if (f.path !== filePath) return f;

    if (f.meta.noteType === 'text') {
      const { body: normalizedBody, title } = applyTitleHeading(body);
      const meta = title ? { ...f.meta, title } : f.meta;
      const content = composeNote(ensureNoteMeta(meta), normalizedBody);
      if (normalizedBody === f.body && content === f.content) return f;
      return { ...f, body: normalizedBody, content, meta, isDirty: true, saveState: undefined };
    }

    const content = composeNote(ensureNoteMeta(f.meta), body);
    if (body === f.body && content === f.content) return f;
    return { ...f, body, content, isDirty: true, saveState: undefined };
  });
}
