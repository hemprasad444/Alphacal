// The game layer on the device: XP, rank and badges from the store (game.ts in shared does the
// maths), which badges this account has already celebrated, and posting the week's XP to the board.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { game, type GameState, isoWeek, newBadges, type GameBadge } from '@rei/shared';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { postScore } from '../lib/sync';
import { useStore } from './store';

const seenKey = (who: string) => `rei-badges-seen-${who}`;

/** Badges already celebrated, per account (or the demo), so each unlock plays once. */
const seen = {
  who: '',
  ids: [] as string[],
  loaded: false,
  listeners: new Set<() => void>(),
  emit() {
    this.listeners.forEach(l => l());
  },
  load(who: string) {
    if (this.who === who) return;
    this.who = who;
    this.ids = [];
    this.loaded = false;
    this.emit();
    AsyncStorage.getItem(seenKey(who))
      .then(v => {
        if (this.who !== who) return;
        this.ids = v ? (JSON.parse(v) as string[]) : [];
        this.loaded = true;
        this.emit();
      })
      .catch(() => {
        this.loaded = true;
        this.emit();
      });
  },
  add(ids: string[]) {
    this.ids = [...new Set([...this.ids, ...ids])];
    this.emit();
    AsyncStorage.setItem(seenKey(this.who), JSON.stringify(this.ids)).catch(() => {});
  },
};
const subscribe = (l: () => void) => {
  seen.listeners.add(l);
  return () => seen.listeners.delete(l);
};
let snap = { ids: seen.ids, loaded: seen.loaded };
const getSnap = () => {
  if (snap.ids !== seen.ids || snap.loaded !== seen.loaded) snap = { ids: seen.ids, loaded: seen.loaded };
  return snap;
};

/** XP, rank, stats and badges for whoever is using the app. */
export function useGame(): GameState & { fresh: GameBadge[]; ready: boolean; markSeen: (ids: string[]) => void } {
  const uid = useStore(s => s.account.uid), demo = useStore(s => !s.cloud);
  const today = useStore(s => s.day), profile = useStore(s => s.profile), meals = useStore(s => s.meals), sessionDone = useStore(s => s.sessionDone);
  const pastDays = useStore(s => s.pastDays), sessions = useStore(s => s.sessions), weighIns = useStore(s => s.weighIns);
  const photos = useStore(s => s.photos.length), memory = useStore(s => s.memory.length);
  const who = demo ? 'demo' : uid ?? 'demo';
  useEffect(() => seen.load(who), [who]);
  const st = useSyncExternalStore(subscribe, getSnap, getSnap);
  const g = useMemo(
    () => game({ today, profile, meals, sessionDone, pastDays, sessions, weighIns, photos, memory }, st.ids),
    [today, profile, meals, sessionDone, pastDays, sessions, weighIns, photos, memory, st.ids],
  );
  return { ...g, fresh: st.loaded ? newBadges(g, st.ids) : [], ready: st.loaded, markSeen: ids => seen.add(ids) };
}

/** Keeps this account's row on the weekly leaderboard up to date (signed-in only). */
export function useBoardSync(g: Pick<GameState, 'weekXp' | 'rank'>) {
  const uid = useStore(s => s.account.uid), cloud = useStore(s => s.cloud);
  const name = useStore(s => s.profile.name), theme = useStore(s => s.theme.id);
  useEffect(() => {
    if (!cloud || !uid) return;
    // Settle first: logging a meal can change XP a few times in a row.
    const t = setTimeout(() => postScore(uid, isoWeek(), { name: name || 'Anonymous', xp: g.weekXp, rank: g.rank.id, theme }), 4000);
    return () => clearTimeout(t);
  }, [cloud, uid, name, theme, g.weekXp, g.rank.id]);
}
