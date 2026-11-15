// The scheduled jobs' loop over users: a few at a time, failures counted, and a time budget.
import { pool } from '../src/pool';

const tick = (ms = 1) => new Promise(r => setTimeout(r, ms));

describe('pool', () => {
  it('runs everything, a few at a time', async () => {
    let running = 0, peak = 0;
    const seen: number[] = [];
    const r = await pool([1, 2, 3, 4, 5, 6, 7], 3, async n => {
      peak = Math.max(peak, ++running);
      await tick();
      seen.push(n);
      running--;
    });
    expect(r).toEqual({ done: 7, failed: 0, skipped: 0 });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(peak).toBe(3);
  });
  it('counts a failure and carries on with the rest', async () => {
    const failed: number[] = [];
    const r = await pool([1, 2, 3, 4], 2, async n => {
      if (n % 2 === 0) throw new Error(`no ${n}`);
    }, { onError: n => failed.push(n) });
    expect(r).toEqual({ done: 2, failed: 2, skipped: 0 });
    expect(failed).toEqual([2, 4]);
  });
  it('starts nothing new once the time is up, and says how many were left', async () => {
    let clock = 0;
    const started: number[] = [];
    const r = await pool([1, 2, 3, 4, 5], 1, async n => {
      started.push(n);
      clock += 100;
    }, { budgetMs: 250, now: () => clock });
    expect(started).toEqual([1, 2, 3]);
    expect(r).toEqual({ done: 3, failed: 0, skipped: 2 });
  });
  it('is fine with nothing to do', async () => {
    expect(await pool([], 4, async () => undefined)).toEqual({ done: 0, failed: 0, skipped: 0 });
  });
});
