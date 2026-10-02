import { changedSlices, loadState, saveSlices } from '../persist';
import type { SliceStore } from '../sliceStore';

function memory(): SliceStore & { rows: Map<string, string>; writes: number } {
  const rows = new Map<string, string>();
  const s = {
    rows,
    writes: 0,
    async read(ns: string, slices: string[]) {
      return Object.fromEntries(slices.flatMap(k => (rows.has(`${ns}:${k}`) ? [[k, rows.get(`${ns}:${k}`)!]] : [])));
    },
    async write(ns: string, entries: [string, string][]) {
      s.writes += entries.length;
      entries.forEach(([k, v]) => rows.set(`${ns}:${k}`, v));
    },
  };
  return s;
}

type State = { settings: { a: number }; meals: number[]; day: string };
const SLICES: (keyof State)[] = ['settings', 'meals', 'day'];

describe('persist', () => {
  it('writes only the slices that changed', async () => {
    const store = memory();
    const s1: State = { settings: { a: 1 }, meals: [], day: '2026-10-02' };
    expect(await saveSlices(store, 'ns', s1, null, SLICES)).toBe(3);
    const s2 = { ...s1, meals: [1] };
    expect(changedSlices(s2, s1, SLICES)).toEqual(['meals']);
    expect(await saveSlices(store, 'ns', s2, s1, SLICES)).toBe(1);
    expect(await loadState<State>(store, 'ns', SLICES)).toEqual(s2);
  });

  it('keeps namespaces apart and returns null when empty', async () => {
    const store = memory();
    await saveSlices(store, 'a', { settings: { a: 1 }, meals: [], day: 'x' }, null, SLICES);
    expect(await loadState<State>(store, 'b', SLICES)).toBeNull();
  });

  it('moves the old single blob over once, then removes it', async () => {
    const store = memory();
    const old = new Map([['rei-state-v1', JSON.stringify({ settings: { a: 7 }, meals: [3], day: 'd' })]]);
    const legacy = { get: async (k: string) => old.get(k) ?? null, remove: async (k: string) => void old.delete(k) };
    expect(await loadState<State>(store, 'rei-state-v1', SLICES, legacy)).toEqual({ settings: { a: 7 }, meals: [3], day: 'd' });
    expect(old.size).toBe(0);
    expect(store.writes).toBe(3);
    expect(await loadState<State>(store, 'rei-state-v1', SLICES, legacy)).toEqual({ settings: { a: 7 }, meals: [3], day: 'd' });
  });

  it('drops a damaged slice but loads the rest', async () => {
    const store = memory();
    store.rows.set('ns:settings', '{bad');
    store.rows.set('ns:day', '"2026-10-02"');
    expect(await loadState<State>(store, 'ns', SLICES)).toEqual({ day: '2026-10-02' });
  });
});
