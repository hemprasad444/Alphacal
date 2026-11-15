// Scheduled jobs walk every user. One at a time ran out of the function's time limit as testers were
// added (a program takes 10-40 s, the limit is 540 s) and everyone after the cut got nothing, silently;
// all at once floods the model provider. A few at a time, and a clock to stop starting new ones.

export interface PoolResult {
  done: number;
  failed: number;
  /** Not started because the time budget ran out. */
  skipped: number;
}

/**
 * Run `work` for each item, `size` at a time. A failure is counted and passed to `onError`, never
 * thrown. After `budgetMs` no new item is started (the ones running finish).
 */
export async function pool<T>(items: T[], size: number, work: (item: T) => Promise<unknown>, o: { budgetMs?: number; onError?: (item: T, error: unknown) => void; now?: () => number } = {}): Promise<PoolResult> {
  const now = o.now ?? Date.now;
  const start = now();
  const result: PoolResult = { done: 0, failed: 0, skipped: 0 };
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      if (o.budgetMs !== undefined && now() - start >= o.budgetMs) return;
      const item = items[next++];
      try {
        await work(item);
        result.done++;
      } catch (e) {
        result.failed++;
        o.onError?.(item, e);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, worker));
  result.skipped = items.length - result.done - result.failed;
  return result;
}
