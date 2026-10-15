// Independent check: what XP, streak, rank, badges and today's totals SHOULD be, from the raw database
// rows, using the app's own shared formulas. Compared against what the screens show.
import { db, uidOf } from './lib.mjs';
import * as SH from '../packages/shared/src/index.ts';
const S = ((SH as unknown as { default?: typeof SH }).default ?? SH) as typeof SH;

export async function expected(email: string, today: string) {
  const uid = await uidOf(email);
  const u = (await db.doc(`users/${uid}`).get()).data() ?? {};
  const days = Object.fromEntries((await db.collection(`users/${uid}/days`).get()).docs.map(d => [d.id, d.data()]));
  const sessions = (await db.collection(`users/${uid}/sessions`).get()).docs.map(d => d.data());
  const weighIns = (await db.collection(`users/${uid}/weighIns`).get()).docs.map(d => ({ date: d.id, kg: d.data().kg }));
  const pastDays = Object.entries(days).filter(([d]) => d < today).sort(([a], [b]) => (a < b ? -1 : 1)).map(([d, v]) => S.daySummary(d, v as never));
  const t = (days[today] ?? {}) as { meals?: S.Meal[]; sessionDone?: boolean };
  const profile = { ...S.DEFAULT_PROFILE, ...(u.profile ?? {}) };
  const g = S.game({ today, profile, meals: t.meals ?? [], sessionDone: !!t.sessionDone, pastDays, sessions: sessions as never, weighIns, photos: 0, memory: (u.memory ?? []).length });
  const intake = S.dayIntake(t.meals ?? []);
  return {
    xp: g.xp, today: g.today, weekXp: g.weekXp, rank: g.rank.name, streak: g.stats.streak,
    earned: g.earned.map(b => b.title), kcal: Math.round(intake.totals.kcal), protein: Math.round(intake.totals.p),
    meals: (t.meals ?? []).length, sessionsToday: sessions.filter(s => s.date === today).length, weight: profile.weight,
  };
}

if (process.argv[2]) console.log(JSON.stringify(await expected(process.argv[2], process.argv[3])));
