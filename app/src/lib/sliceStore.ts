// Saved app state, one entry per slice (settings, meals, sessions…), so a change writes only
// the slices it touched. This is the web build, used for previews: AsyncStorage keys
// "<namespace>:<slice>". On the phone, sliceStore.native.ts uses SQLite instead.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SliceStore {
  /** The stored JSON of each slice that exists. */
  read(ns: string, slices: string[]): Promise<Record<string, string>>;
  /** Replace these slices, all together. */
  write(ns: string, entries: [string, string][]): Promise<void>;
}

const key = (ns: string, slice: string) => `${ns}:${slice}`;

export const sliceStore: SliceStore = {
  async read(ns, slices) {
    const rows = await AsyncStorage.multiGet(slices.map(s => key(ns, s)));
    const out: Record<string, string> = {};
    rows.forEach(([, v], i) => {
      if (v != null) out[slices[i]] = v;
    });
    return out;
  },
  async write(ns, entries) {
    await AsyncStorage.multiSet(entries.map(([s, json]) => [key(ns, s), json]));
  },
};
