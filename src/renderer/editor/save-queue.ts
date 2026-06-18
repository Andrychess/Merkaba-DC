const chains = new Map<string, Promise<void>>();

/** Последовательное сохранение одного файла (без параллельных гонок). */
export function enqueueFileSave(path: string, task: () => Promise<void>): Promise<void> {
  const prev = chains.get(path) ?? Promise.resolve();
  const next = prev.then(task, task).finally(() => {
    if (chains.get(path) === next) {
      chains.delete(path);
    }
  });
  chains.set(path, next);
  return next;
}

/** Переносит очередь сохранений при переименовании файла. */
export function migrateFileSaveQueue(oldPath: string, newPath: string): void {
  if (oldPath === newPath) return;
  const oldChain = chains.get(oldPath);
  if (!oldChain) return;
  chains.delete(oldPath);
  const newChain = chains.get(newPath);
  chains.set(newPath, newChain ? newChain.then(() => oldChain) : oldChain);
}
