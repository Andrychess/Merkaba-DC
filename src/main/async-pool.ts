/** Выполняет задачи с ограничением параллелизма */
export async function mapPool<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  };

  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    () => runWorker()
  );
  await Promise.all(workers);
  return results;
}
