// Loading and saving the store through a SliceStore: only changed slices are written, and the
// old single-blob format (one AsyncStorage key per mode) is moved over once, then removed.
import type { SliceStore } from './sliceStore';

export interface Legacy {
  get(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
}

/** The saved state for a namespace, or null when there is none. Migrates the old blob once. */
export async function loadState<T extends object>(store: SliceStore, ns: string, slices: (keyof T & string)[], legacy?: Legacy): Promise<Partial<T> | null> {
  const rows = await store.read(ns, slices);
  if (Object.keys(rows).length) {
    const out: Partial<T> = {};
    for (const [k, json] of Object.entries(rows)) {
      try {
        (out as Record<string, unknown>)[k] = JSON.parse(json);
      } catch {
        // A damaged slice is dropped; the rest of the state still loads.
      }
    }
    return out;
  }
  const old = legacy ? await legacy.get(ns) : null;
  if (!old) return null;
  let parsed: Partial<T>;
  try {
    parsed = JSON.parse(old) as Partial<T>;
  } catch {
    return null;
  }
  await saveSlices(store, ns, parsed, null, slices);
  await legacy!.remove(ns);
  return parsed;
}

/** Slices whose value changed since the last save (compared by reference, as the store never mutates). */
export function changedSlices<T extends object>(next: Partial<T>, saved: Partial<T> | null, slices: (keyof T & string)[]): (keyof T & string)[] {
  return slices.filter(k => next[k] !== undefined && (!saved || next[k] !== saved[k]));
}

/** Write the slices that changed. Returns how many were written. */
export async function saveSlices<T extends object>(store: SliceStore, ns: string, next: Partial<T>, saved: Partial<T> | null, slices: (keyof T & string)[]): Promise<number> {
  const changed = changedSlices(next, saved, slices);
  await store.write(ns, changed.map(k => [k, JSON.stringify(next[k])]));
  return changed.length;
}
