// Saved app state on the phone: one SQLite row per slice (settings, meals, sessions…), so a
// change writes only what it touched, in one transaction. expo-sqlite runs in Expo Go.
import * as SQLite from 'expo-sqlite';
import type { SliceStore } from './sliceStore';

export type { SliceStore } from './sliceStore';

let opened: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  opened ??= (async () => {
    const d = await SQLite.openDatabaseAsync('rei.db');
    await d.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS kv (ns TEXT NOT NULL, slice TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (ns, slice)) WITHOUT ROWID;
    `);
    return d;
  })();
  opened.catch(() => {
    opened = null;
  });
  return opened;
}

export const sliceStore: SliceStore = {
  async read(ns, slices) {
    const rows = await (await db()).getAllAsync<{ slice: string; json: string }>('SELECT slice, json FROM kv WHERE ns = ?', ns);
    const wanted = new Set(slices);
    return Object.fromEntries(rows.filter(r => wanted.has(r.slice)).map(r => [r.slice, r.json]));
  },
  async write(ns, entries) {
    if (!entries.length) return;
    const d = await db();
    await d.withTransactionAsync(async () => {
      for (const [slice, json] of entries) await d.runAsync('INSERT OR REPLACE INTO kv (ns, slice, json) VALUES (?, ?, ?)', ns, slice, json);
    });
  },
};
