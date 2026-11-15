// A workout: today's planned session, or a gym session ("mode=free") built from today's plan or your
// own picks. Nothing runs until you start: train now (live timer and rests), or log one you've
// already done (just the duration). Tick sets as you finish them; every exercise shows its XP.
//
// This is the fight itself: each exercise is a round, each set a hit landed, the rest timer a round break.
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { CutBox, CutShape } from '../components/cut';
import { Chip, Field, QuietButton, StatStrip } from '../components/dojo';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { CutButton, MeterBar, MoveRow, RoundStamp, SectionHeader, useTierColors } from '../components/fight';
import { Icon } from '../components/icons';
import { IconButton, Tap, Txt } from '../components/ui';
import {
  clock, defaultSets, e1rm, type Exercise, exerciseXp, findExercise, isBodyweight, lastLifts, type LibExercise, liftKey, pad, PICK_GROUPS,
  dayName, nextPlan, records, restSeconds, searchExercises, sessionLine, sessionXp, SESSIONS, type SessionPlan, type SetLog, todaysPlan,
} from '@rei/shared';
import { C, F, fontFamily, HIT, onColor, SP } from '../lib/theme';
import { useStore } from '../state/store';

interface Rest {
  endsAt: number;
  total: number;
}
type Phase = 'ready' | 'live' | 'past';

/** The time now, for handlers (kept out of render). */
const stamp = () => Date.now();

interface Row {
  reps: number[];
  kg: (number | null)[];
  done: boolean[];
}

/** The fight as it ended, frozen when you finish: what the ROUND WON card shows. */
interface Summary {
  title: string;
  seconds: number;
  done: number;
  total: number;
  xp: number;
  /** Kilograms moved (weight × reps over the sets that landed). */
  volume: number;
  reps: number;
  /** Lifts that beat their best, with the set that did it. */
  prs: { name: string; set: string }[];
}

/** Leave the workout: back where you came from, or to the Dojo when there's nowhere to go back to (opened by link, or after a reload). */
const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dojo'));

export default function Session() {
  const s = useStore();
  const { accent } = s;
  const gold = useTierColors().gold;
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const free = params.mode === 'free';
  const today = useMemo(() => todaysPlan(new Date(), s.program), [s.program]);
  // On a rest day, the next planned session is the one on offer (never a made-up default).
  const next = useMemo(() => nextPlan(new Date(), s.program), [s.program]);
  const plan = today ?? next?.plan ?? SESSIONS.PUSH;
  const best = useMemo(() => records(s.sessions), [s.sessions]);
  const last = useMemo(() => lastLifts(s.sessions), [s.sessions]);

  const rowFor = (e: Exercise): Row => ({ reps: [...e.reps], kg: e.reps.map(() => targetKg(e.target)), done: e.reps.map(() => false) });
  const [exercises, setExercises] = useState<Exercise[]>(() => (free ? [] : plan.exercises));
  const [rows, setRows] = useState<Row[]>(() => (free ? [] : plan.exercises.map(rowFor)));
  const [phase, setPhase] = useState<Phase>('ready');
  const [t0, setT0] = useState(0);
  const [now, setNow] = useState(0);
  const [minutes, setMinutes] = useState(plan.minutes || 60);
  const [rest, setRest] = useState<Rest | null>(null);
  const finished = useRef(false);
  const [info, setInfo] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  /** The exercise the picker is asking to remove (it has ticked sets). */
  const [asking, setAsking] = useState<{ name: string; ticked: number } | null>(null);
  const restDone = useRef(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (phase !== 'live' || summary) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase, summary]);

  const start = () => {
    const t = stamp();
    setT0(t);
    setNow(t);
    setPhase('live');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };
  const elapsed = phase === 'live' ? Math.max(0, Math.floor((now - t0) / 1000)) : phase === 'past' ? minutes * 60 : 0;
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (!rest || restLeft > 0 || restDone.current) return;
    restDone.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const t = setTimeout(() => setRest(null), 4000);
    return () => clearTimeout(t);
  }, [rest, restLeft]);

  const startRest = (reps: number, kg: number | null) => {
    // Rests only make sense while you're training; a workout logged afterwards has none.
    if (phase === 'past') return;
    if (phase === 'ready') start();
    restDone.current = false;
    const total = restSeconds(reps, kg);
    setRest({ endsAt: stamp() + total * 1000, total });
  };

  const setLogs: SetLog[] = exercises.map((e, i) => ({ exercise: e.name, done: rows[i].done, reps: rows[i].reps, kg: rows[i].kg }));
  const done = rows.reduce((a, r) => a + r.done.filter(Boolean).length, 0);
  const total = rows.reduce((a, r) => a + r.done.length, 0);
  const xp = done ? sessionXp({ date: s.day, plan: 'GYM', done, total, seconds: elapsed, sets: setLogs }) : 0;
  // The round you're in: the first exercise with a set still to land.
  const open = rows.findIndex(r => r.done.some(v => !v));
  const round = exercises.length ? (open < 0 ? exercises.length : open + 1) : 0;

  const update = (i: number, f: (r: Row) => Row) => setRows(all => all.map((r, a) => (a === i ? f(r) : r)));

  const toggle = (i: number, j: number) => {
    const on = !rows[i].done[j];
    Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    update(i, r => ({ ...r, done: r.done.map((v, b) => (b === j ? on : v)) }));
    if (on) startRest(rows[i].reps[j], rows[i].kg[j]);
  };

  const addSet = (i: number) =>
    update(i, r => ({ reps: [...r.reps, r.reps[r.reps.length - 1] ?? 10], kg: [...r.kg, r.kg[r.kg.length - 1] ?? null], done: [...r.done, false] }));
  const dropSet = (i: number) => update(i, r => (r.reps.length > 1 ? { reps: r.reps.slice(0, -1), kg: r.kg.slice(0, -1), done: r.done.slice(0, -1) } : r));
  const removeExercise = (i: number) => {
    setExercises(cur => cur.filter((_, a) => a !== i));
    setRows(cur => cur.filter((_, a) => a !== i));
  };

  const usePlan = (p: SessionPlan) => {
    const fresh = p.exercises.filter(e => !exercises.some(x => liftKey(x.name) === liftKey(e.name)));
    setExercises(cur => [...cur, ...fresh]);
    setRows(cur => [...cur, ...fresh.map(rowFor)]);
    setMinutes(p.minutes || 60);
  };

  /** Add one exercise, starting from what you lifted last time. */
  const add = (name: string) => {
    if (exercises.some(e => liftKey(e.name) === liftKey(name))) return;
    const reps = defaultSets(name);
    const prevKg = best[liftKey(name)]?.heaviest?.kg ?? best[liftKey(name)]?.best.kg ?? null;
    const kg = isBodyweight(name) ? null : prevKg ?? 20;
    const e: Exercise = { name, target: `${reps.length} × ${reps[0]}${kg ? ` · ${kg} kg` : ''}`, last: last[liftKey(name)] ?? '', reps };
    Haptics.selectionAsync().catch(() => {});
    setExercises(cur => [...cur, e]);
    setRows(cur => [...cur, { reps: [...reps], kg: reps.map(() => kg), done: reps.map(() => false) }]);
  };

  /** Take an exercise back out from the picker; asks first when sets were already ticked. */
  const unadd = (name: string) => {
    const i = exercises.findIndex(e => liftKey(e.name) === liftKey(name));
    if (i < 0) return;
    const ticked = rows[i].done.filter(Boolean).length;
    if (!ticked) return removeExercise(i);
    setAsking({ name: exercises[i].name, ticked });
  };
  const confirmRemove = () => {
    const i = asking ? exercises.findIndex(e => liftKey(e.name) === liftKey(asking.name)) : -1;
    if (i >= 0) removeExercise(i);
  };

  const swap = (i: number, to: LibExercise) => {
    const prev = best[liftKey(to.name)]?.best;
    setExercises(cur => cur.map((e, a) => (a === i ? { ...e, name: to.name, target: `${e.reps.length} × ${e.reps[0]}${prev?.kg ? ` · ${prev.kg} kg` : ''}`, last: last[liftKey(to.name)] } : e)));
    update(i, r => ({ ...r, kg: r.kg.map(() => prev?.kg ?? null), done: r.done.map(() => false) }));
  };

  const complete = () => {
    // Finishing twice (a double tap before the screen closes) would log the workout twice.
    if (!done || finished.current) return;
    finished.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const name = free ? titleFor(exercises) : plan.title;
    // Worked out before saving: once this workout is in the log, its own sets are the records.
    const prs = exercises.flatMap((e, i) => {
      const beat = rows[i].done.map((_, j) => j).filter(j => isPr(i, j)).sort((a, b) => (e1rm(rows[i].kg[b], rows[i].reps[b]) ?? 0) - (e1rm(rows[i].kg[a], rows[i].reps[a]) ?? 0));
      return beat.length ? [{ name: e.name, set: `${rows[i].kg[beat[0]]} × ${rows[i].reps[beat[0]]}` }] : [];
    });
    const landed = rows.flatMap(r => r.done.map((v, j) => (v ? { reps: r.reps[j], kg: r.kg[j] ?? 0 } : null))).filter(x => x !== null);
    setSummary({ title: name, seconds: elapsed, done, total, xp, volume: landed.reduce((a, x) => a + x.kg * x.reps, 0), reps: landed.reduce((a, x) => a + x.reps, 0), prs });
    setRest(null);
    s.finishSession(done, total, elapsed, setLogs, name);
  };

  /** A done set that beats this lift's best estimated max. */
  const isPr = (i: number, j: number) => {
    if (!rows[i].done[j]) return false;
    const prev = best[liftKey(exercises[i].name)]?.best.e1rm;
    const est = e1rm(rows[i].kg[j], rows[i].reps[j]);
    return prev != null && est != null && est > prev;
  };

  const title = free ? 'GYM WORKOUT' : today ? `TODAY · ${plan.title.toUpperCase()}` : `EXTRA · ${plan.title.toUpperCase()}`;
  const live = phase === 'live';

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />

      {/* The HUD: which fight, which round, the clock and the hits landed */}
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: SP.lg, paddingBottom: SP.md, gap: SP.sm, borderBottomWidth: 2, borderBottomColor: F.rope }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
          <IconButton size={HIT} onPress={leave} accessibilityLabel="Close workout">
            <Icon name="close" size={20} color={F.chalk} tint={0} strokeWidth={2} />
          </IconButton>
          <View accessibilityRole="header" style={{ flex: 1 }}>
            <Txt face="labelItalic" w={600} size={14} ls={0.14} numberOfLines={1}>{title}</Txt>
            <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} numberOfLines={1}>{round ? `ROUND ${round} OF ${exercises.length}` : 'NO ROUNDS YET'}</Txt>
          </View>
          <RoundStamp label={`+${xp} XP`} tone={xp ? 'accent' : 'outline'} size="sm" />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SP.md }}>
          {phase === 'past' ? (
            <View style={{ gap: SP.xs }}>
              <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>HOW LONG IT TOOK</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
                <IconButton size={HIT} onPress={() => setMinutes(m => Math.max(5, m - 5))} accessibilityLabel="5 minutes less">−</IconButton>
                <View accessible accessibilityLabel={`${minutes} minutes`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Txt face="display" size={44} lh={1.1}>{`${minutes}`}</Txt>
                  <Txt face="label" w={600} size={14} ls={0.1} color={F.smoke}>MIN</Txt>
                </View>
                <IconButton size={HIT} onPress={() => setMinutes(m => Math.min(300, m + 5))} accessibilityLabel="5 minutes more">+</IconButton>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'flex-start' }}>
              <Txt face="label" w={600} size={12} ls={0.12} color={live ? accent : F.smoke}>{live ? 'TRAINING' : 'NOT STARTED'}</Txt>
              <Txt face="display" size={56} lh={1.08} ls={0.01} color={live ? F.chalk : F.smoke} accessibilityLabel={`${Math.floor(elapsed / 60)} minutes ${elapsed % 60} seconds`}>{`${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)}`}</Txt>
            </View>
          )}
          <View accessible accessibilityLabel={`${done} of ${total} sets done`} style={{ alignItems: 'flex-end', paddingBottom: 4 }}>
            <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>HITS LANDED</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Txt face="display" size={36} lh={1.12} color={done ? accent : F.chalk}>{done}</Txt>
              <Txt face="label" w={400} size={18} ls={0.03} color={F.smoke}>{`/ ${total}`}</Txt>
            </View>
          </View>
        </View>

        <MeterBar pct={total ? done / total : 0} segments={total > 1 && total <= 24 ? total : undefined} height={16} accessibilityLabel={`${done} of ${total} sets done`} />
        {/* REI's line always has its two lines of room, so a longer or shorter one never moves the set rows under your thumb. */}
        {!free ? (
          <View accessibilityLiveRegion="polite" style={{ height: 2 * 14 * 1.4 * s.settings.textSize, justifyContent: 'center' }}>
            <Txt size={14} w={500} lh={1.4} color={F.smoke} numberOfLines={2}>
              {live ? sessionLine(total ? done / total : 0, plan) : phase === 'past' ? 'Tick the sets you did and set how long it took.' : exercises.length ? 'Start the clock, or just tick your first set: that starts it too.' : 'Use today’s plan, or build your own below.'}
            </Txt>
          </View>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: SP.lg, paddingHorizontal: SP.lg, paddingBottom: SP.xxl, gap: SP.lg }} keyboardShouldPersistTaps="handled">
        {!exercises.length ? (
          <TodayPlan plan={today} next={next} byRei={!!s.program} onUse={usePlan} onBuild={() => setAdding(true)} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
            <Txt face="label" w={400} size={12} ls={0.1} lh={1.3} color={F.smoke} style={{ flex: 1 }}>TAP THE BOX WHEN A SET LANDS · TAP NUMBERS TO CHANGE · TAP A NAME FOR FORM TIPS</Txt>
            <QuietButton lit icon="rei" label="Ask REI" accessibilityLabel="Ask REI to change today's workout" onPress={() => router.push({ pathname: '/talk', params: { draft: 'Change today’s workout: ' } })} />
          </View>
        )}

        {exercises.map((ex, i) => {
          const r = rows[i];
          const n = r.done.filter(Boolean).length;
          const won = n === r.done.length;
          return (
            <View key={`${i}-${ex.name}`} style={{ backgroundColor: F.canvas, borderLeftWidth: 4, borderLeftColor: won ? accent : n ? F.chalk : F.rope, paddingVertical: SP.md, paddingLeft: SP.md, paddingRight: SP.sm, gap: SP.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                <Tap haptic={false} onPress={() => setInfo(i)} accessibilityLabel={`Round ${i + 1}, ${ex.name}. ${n} of ${r.done.length} sets done`} accessibilityHint="Form tips and swaps" style={{ flex: 1, minHeight: HIT, justifyContent: 'center', gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                    <Txt face="labelItalic" w={600} size={12} ls={0.14} color={i + 1 === round && !won ? accent : F.smoke}>{`ROUND ${i + 1}`}</Txt>
                    <View style={{ flexDirection: 'row', gap: 3 }}>
                      {r.done.slice(0, 10).map((v, j) => <CutShape key={j} width={9} height={12} fill={v ? (isPr(i, j) ? gold : F.chalk) : F.rope} />)}
                    </View>
                  </View>
                  <Txt size={17} w={600} lh={1.25} numberOfLines={1}>{ex.name}</Txt>
                  <Txt face="label" w={400} size={12} ls={0.08} color={F.smoke} numberOfLines={1}>{(last[liftKey(ex.name)] ?? (ex.last || 'First time · tap for form tips')).toUpperCase()}</Txt>
                </Tap>
                {won ? <RoundStamp label={`+${exerciseXp(n)} XP`} size="sm" /> : <RoundStamp label={n ? `+${exerciseXp(n)} XP` : `${r.done.length} sets`} tone={n ? 'accent' : 'outline'} size="sm" />}
                <Tap onPress={() => removeExercise(i)} accessibilityLabel={`Remove ${ex.name}`} style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={16} color={F.smoke} tint={0} strokeWidth={2} />
                </Tap>
              </View>

              <View style={{ gap: SP.xs, paddingRight: SP.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SET_GAP, paddingHorizontal: 6 }}>
                  <Txt face="label" w={600} size={12} ls={0.08} color={F.smoke} style={{ width: SET_TAG }}>SET</Txt>
                  <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} align="center" style={{ flex: 1.2 }}>WEIGHT · KG</Txt>
                  <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} align="center" style={{ flex: 1 }}>REPS</Txt>
                  <Txt face="label" w={600} size={12} ls={0.08} color={F.smoke} align="center" style={{ width: SET_TICK }}>LANDED</Txt>
                </View>
                {r.reps.map((reps, j) => (
                  <SetRow
                    key={j}
                    n={j + 1}
                    kg={r.kg[j]}
                    reps={reps}
                    done={r.done[j]}
                    pr={isPr(i, j)}
                    acc={accent}
                    gold={gold}
                    onKg={v => update(i, x => ({ ...x, kg: x.kg.map((k, b) => (b === j ? v : k)) }))}
                    onReps={v => update(i, x => ({ ...x, reps: x.reps.map((k, b) => (b === j ? v : k)) }))}
                    onToggle={() => toggle(i, j)}
                  />
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: SP.sm, paddingRight: SP.xs }}>
                <QuietButton icon="plus" label="Add set" onPress={() => addSet(i)} accessibilityLabel={`Add a set to ${ex.name}`} style={{ flex: 1 }} />
                {r.reps.length > 1 && !r.done[r.done.length - 1] ? <QuietButton icon="close" label="Last set" onPress={() => dropSet(i)} accessibilityLabel={`Remove the last set of ${ex.name}`} /> : null}
              </View>
            </View>
          );
        })}

        {exercises.length ? <QuietButton icon="plus" label="Add exercise" onPress={() => setAdding(true)} style={{ minHeight: 52 }} /> : null}
      </ScrollView>

      {/* The round break */}
      {rest && live ? (
        <View accessibilityLiveRegion="polite" style={{ marginHorizontal: SP.lg, marginBottom: SP.sm, padding: SP.md, backgroundColor: F.canvas, borderWidth: 2, borderColor: restLeft ? F.rope : accent, gap: SP.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.md }}>
            <View style={{ alignItems: 'flex-start', flexShrink: 1 }}>
              <Txt face="labelItalic" w={600} size={12} ls={0.14} color={restLeft ? F.smoke : accent}>{restLeft ? 'ROUND BREAK' : 'BELL'}</Txt>
              <Txt face="display" size={32} lh={1.15} color={restLeft ? F.chalk : accent} accessibilityLabel={restLeft ? `Rest, ${restLeft} seconds left` : 'Rest over. Next set'}>{restLeft ? clock(restLeft) : 'NEXT SET'}</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: SP.sm }}>
              {restLeft ? <QuietButton label="+30" accessibilityLabel="Rest 30 seconds longer" onPress={() => setRest(x => (x ? { ...x, endsAt: x.endsAt + 30000, total: x.total + 30 } : x))} style={{ minWidth: 56 }} /> : null}
              <QuietButton label={restLeft ? 'Skip' : 'OK'} accessibilityLabel={restLeft ? 'Skip the rest' : 'Dismiss'} onPress={() => setRest(null)} style={{ minWidth: 56 }} />
            </View>
          </View>
          <MeterBar pct={1 - restLeft / rest.total} height={8} accessibilityLabel="Rest timer" />
        </View>
      ) : null}

      <View style={{ paddingTop: SP.md, paddingHorizontal: SP.lg, paddingBottom: Math.max(insets.bottom, SP.lg), borderTopWidth: 2, borderTopColor: F.rope, backgroundColor: F.arena, gap: SP.sm }}>
        {phase === 'ready' ? (
          <>
            <CutButton icon="timer" label={exercises.length ? 'Start workout' : 'Pick exercises first'} meta={exercises.length ? `${exercises.length} round${exercises.length === 1 ? '' : 's'}` : undefined} disabled={!exercises.length} onPress={start} />
            <Tap onPress={() => setPhase('past')} disabled={!exercises.length} style={{ minHeight: HIT, alignItems: 'center', justifyContent: 'center' }}>
              <Txt face="label" w={600} size={14} ls={0.08} color={exercises.length ? F.chalk : C.faint} align="center">ALREADY DONE? LOG IT WITHOUT THE TIMER</Txt>
            </Tap>
          </>
        ) : (
          <CutButton icon="check" label={done ? (phase === 'past' ? 'Save workout' : 'Finish workout') : 'Tick the sets you did'} meta={done ? `+${xp} XP` : undefined} disabled={!done} onPress={complete} />
        )}
      </View>

      <AddExercise open={adding} onClose={() => setAdding(false)} onAdd={add} onRemove={unadd} have={exercises.map(e => liftKey(e.name))} planned={plan.exercises.map(e => e.name)} planTitle={today ? `${dayName()} · ${today.title}` : next ? `Next · ${next.day} · ${next.plan.title}` : plan.title} yours={Object.values(best).sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1)).slice(0, 8).map(r => r.name)}>
        {/* Inside the picker's modal, so it shows on top of it. */}
        <ConfirmSheet
          open={!!asking}
          title={`Remove ${asking?.name ?? ''}?`}
          message={asking ? `You've ticked ${asking.ticked} set${asking.ticked > 1 ? 's' : ''} on it.` : undefined}
          confirmLabel="Remove"
          cancelLabel="Keep it"
          destructive
          onConfirm={confirmRemove}
          onClose={() => setAsking(null)}
        />
      </AddExercise>
      <ExerciseSheet name={info === null ? null : exercises[info]?.name ?? null} onClose={() => setInfo(null)} onSwap={to => info !== null && swap(info, to)} />
      {summary ? <RoundWon sum={summary} gold={gold} onLeave={leave} /> : null}
    </View>
  );
}

const big = (n: number) => Math.round(n).toLocaleString('en-US');

/** The payoff: the fight card once the workout is saved. Time, hits, volume, records and the XP it earned, then one way out. */
function RoundWon({ sum, gold, onLeave }: { sum: Summary; gold: string; onLeave: () => void }) {
  const accent = useStore(s => s.accent);
  const insets = useSafeAreaInsets();
  const clean = sum.done === sum.total;
  const stats = [
    { k: 'Time', v: clock(sum.seconds) },
    { k: 'Hits landed', v: `${sum.done}/${sum.total}` },
    sum.volume > 0 ? { k: 'Volume', v: sum.volume >= 10000 ? `${(sum.volume / 1000).toFixed(1)} t` : `${big(sum.volume)} kg` } : { k: 'Reps', v: big(sum.reps) },
    { k: 'PRs', v: String(sum.prs.length), hot: sum.prs.length > 0 },
  ];
  return (
    <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, { backgroundColor: F.arena }]}>
      <Backdrop glow="bottom" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: insets.top + SP.xl, paddingHorizontal: SP.lg, paddingBottom: SP.xl, gap: SP.xl }}>
        <View style={{ alignItems: 'flex-start', gap: SP.sm }}>
          <RoundStamp label={sum.title} tone="outline" size="sm" />
          <View accessibilityRole="header" accessibilityLiveRegion="polite">
            <Txt face="display" size={68} lh={1.05} color={accent} fit>ROUND WON</Txt>
          </View>
          <Txt size={15} w={500} lh={1.4} color={F.smoke}>{clean ? 'Every set landed. Eat, then sleep: that’s where it turns into muscle.' : `${sum.done} of ${sum.total} sets landed. Every one of them counts.`}</Txt>
        </View>

        <View style={{ gap: SP.sm }}>
          <View accessible accessibilityLabel={`${sum.xp} XP earned`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.md }}>
            <Txt face="display" size={72} lh={1.08}>{`+${big(sum.xp)}`}</Txt>
            <Txt face="labelItalic" w={600} size={16} ls={0.12} color={F.smoke}>XP EARNED</Txt>
          </View>
          <MeterBar pct={sum.total ? sum.done / sum.total : 0} segments={sum.total > 1 && sum.total <= 24 ? sum.total : undefined} height={16} accessibilityLabel={`${sum.done} of ${sum.total} sets landed`} />
        </View>

        <StatStrip items={stats} />

        {sum.prs.length ? (
          <View style={{ gap: SP.md }}>
            <SectionHeader title="New records" meta={`${sum.prs.length}`} accent={gold} />
            <View style={{ gap: SP.xs }}>
              {sum.prs.map(p => <MoveRow key={p.name} name={p.name} value={p.set} accent={gold} style={{ borderLeftWidth: 4, borderLeftColor: gold }} />)}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <View style={{ paddingTop: SP.md, paddingHorizontal: SP.lg, paddingBottom: Math.max(insets.bottom, SP.lg), borderTopWidth: 2, borderTopColor: F.rope, backgroundColor: F.arena }}>
        <CutButton icon="check" label="Leave the ring" meta="Saved" accessibilityLabel="Leave the workout. It is saved" onPress={onLeave} />
      </View>
    </View>
  );
}

// Widths of the set row's fixed columns: the set number, the gaps and the landed box.
const SET_TAG = 24, SET_GAP = 6, SET_TICK = 48;
/** A stepper button is drawn 40pt wide; slop on its outer side makes the target 44. */
const STEP_W = 40, STEP_SLOP = HIT - STEP_W;

/** One set: weight and reps you can step or type, and the hit button. Bodyweight shows BW until a load is added. */
function SetRow({ n, kg, reps, done, pr, acc, gold, onKg, onReps, onToggle }: { n: number; kg: number | null; reps: number; done: boolean; pr: boolean; acc: string; gold: string; onKg: (v: number | null) => void; onReps: (v: number) => void; onToggle: () => void }) {
  const lit = pr ? gold : acc;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SET_GAP, padding: 4, borderWidth: 2, borderColor: done ? lit : F.rope, backgroundColor: done ? F.canvas2 : F.arena }}>
      <View accessible accessibilityLabel={pr ? `Set ${n}, personal record` : `Set ${n}`} style={{ width: SET_TAG, height: 24, alignItems: 'center', justifyContent: 'center' }}>
        <CutShape width={SET_TAG} height={24} fill={done ? lit : F.canvas2} style={{ position: 'absolute', left: 0, top: 0 }} />
        <Txt face="label" w={600} size={pr ? 11 : 14} color={done ? onColor(lit) : F.smoke}>{pr ? 'PR' : String(n)}</Txt>
      </View>
      <Stepper flex={1.2} what={`Set ${n} weight`} value={kg} step={2.5} min={0} decimals onChange={v => onKg(v === 0 ? null : v)} empty="BW" />
      <Stepper flex={1} what={`Set ${n} reps`} value={reps} step={1} min={1} onChange={v => onReps(Math.max(1, Math.round(v ?? 1)))} />
      {/* Still to land: an empty box, quiet. Landed: filled in your colour (gold for a record) with the tick. Never a tick on an open set. */}
      <Tap haptic={false} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={`Set ${n} done`} style={{ width: SET_TICK, height: HIT }}>
        <CutBox fill={done ? lit : F.arena} stroke={done ? undefined : F.smoke} style={{ width: SET_TICK, height: HIT, alignItems: 'center', justifyContent: 'center' }}>
          {/* In a View so it stacks above the cut shape on the web too. */}
          {done ? (
            <View>
              <Icon name="check" size={22} color={onColor(lit)} tint={0} strokeWidth={2.6} />
            </View>
          ) : null}
        </CutBox>
      </Tap>
    </View>
  );
}

/** − value + with the value typeable. `empty` is shown for null (bodyweight). */
function Stepper({ value, step, min, onChange, empty, decimals, flex, what }: { value: number | null; step: number; min: number; onChange: (v: number | null) => void; empty?: string; decimals?: boolean; flex: number; what: string }) {
  const s = useStore();
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value == null ? '' : String(+value.toFixed(2)));
  const bump = (d: number) => {
    Haptics.selectionAsync().catch(() => {});
    const v = Math.max(min, +((value ?? 0) + d).toFixed(2));
    setText(null);
    onChange(v);
  };
  const btn = { width: STEP_W, height: HIT, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flex, flexDirection: 'row', alignItems: 'center', backgroundColor: F.canvas2 }}>
      <Tap haptic={false} onPress={() => bump(-step)} accessibilityLabel={`${what}: ${step} less`} hitSlop={{ left: STEP_SLOP }} style={btn}>
        <Txt size={20} w={600} color={F.smoke}>−</Txt>
      </Tap>
      <TextInput
        value={shown}
        placeholder={empty}
        placeholderTextColor={F.smoke}
        accessibilityLabel={what}
        onChangeText={t => {
          setText(t);
          const v = parseFloat(t.replace(',', '.'));
          if (t.trim() === '') onChange(empty ? null : min);
          else if (v >= 0) onChange(decimals ? v : Math.round(v));
        }}
        onBlur={() => setText(null)}
        keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
        keyboardAppearance="dark"
        selectTextOnFocus
        style={{ flex: 1, minWidth: 0, height: HIT, padding: 0, textAlign: 'center', fontFamily: fontFamily('display', 400), fontSize: 18 * s.settings.textSize, color: F.chalk }}
      />
      <Tap haptic={false} onPress={() => bump(step)} accessibilityLabel={`${what}: ${step} more`} hitSlop={{ right: STEP_SLOP }} style={btn}>
        <Txt size={20} w={600} color={F.smoke}>+</Txt>
      </Tap>
    </View>
  );
}

/** "4 × 6 · 82.5 kg" → the loud part ("4 × 6") and the quiet part ("82.5 kg"). */
const splitTarget = (target: string): [string, string | undefined] => {
  const [value, ...rest] = target.split(' · ');
  return [value, rest.length ? rest.join(' · ') : undefined];
};

/** Today's session as REI planned it: use it as is, ask REI to change it, or build your own. */
function TodayPlan({ plan, next, byRei, onUse, onBuild }: { plan: SessionPlan | null; next: { day: string; plan: SessionPlan } | null; byRei: boolean; onUse: (p: SessionPlan) => void; onBuild: () => void }) {
  const askRei = () => router.push({ pathname: '/talk', params: { draft: 'Change today’s workout: ' } });
  return (
    <>
      <SectionHeader title={`${dayName()}'s plan`} meta={byRei ? 'Written by REI' : 'Default split'} />
      {plan ? (
        <View style={{ gap: SP.md }}>
          <View style={{ alignItems: 'flex-start', gap: 2 }}>
            <Txt face="display" size={32} lh={1.15}>{plan.title.toUpperCase()}</Txt>
            <Txt size={14} w={500} lh={1.4} color={F.smoke}>{plan.sub}</Txt>
          </View>
          <View style={{ gap: SP.xs }}>
            {plan.exercises.map((e, i) => {
              const [value, detail] = splitTarget(e.target);
              return <MoveRow key={e.name} index={i + 1} name={e.name} detail={detail} value={value} />;
            })}
          </View>
          <CutButton size="md" icon="check" label="Use today’s plan" meta={`${plan.exercises.length} rounds`} onPress={() => onUse(plan)} />
          <QuietButton lit icon="rei" label="Ask REI to change it" onPress={askRei} />
        </View>
      ) : (
        <View style={{ gap: SP.md }}>
          <View style={{ alignItems: 'flex-start', gap: SP.xs }}>
            <Txt face="display" size={28} lh={1.2}>{`${dayName()} · REST DAY`.toUpperCase()}</Txt>
            <Txt size={14} w={500} lh={1.4} color={F.smoke}>REI planned recovery today. Training anyway? Pull your next session forward or build your own.</Txt>
          </View>
          {next ? (
            <>
              <View style={{ backgroundColor: F.canvas, borderLeftWidth: 4, borderLeftColor: F.rope, padding: SP.md, gap: 2 }}>
                <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{`NEXT UP · ${next.day.toUpperCase()}`}</Txt>
                <Txt size={17} w={600}>{next.plan.title}</Txt>
                <Txt size={13} w={500} color={F.smoke} numberOfLines={1}>{next.plan.exercises.map(e => e.name).join(' · ')}</Txt>
              </View>
              <CutButton size="md" label={`Do ${next.day}'s ${next.plan.title} today`} onPress={() => onUse(next.plan)} />
            </>
          ) : null}
        </View>
      )}
      <QuietButton icon="plus" label="Build my own workout" onPress={onBuild} style={{ minHeight: 52 }} />
    </>
  );
}

/** Pick exercises: your lifts, today's plan, a muscle group, or search the whole library. `children` render inside the modal (a confirm on top of it). */
function AddExercise({ open, onClose, onAdd, onRemove, have, planned, planTitle, yours, children }: { open: boolean; onClose: () => void; onAdd: (name: string) => void; onRemove: (name: string) => void; have: string[]; planned: string[]; planTitle: string; yours: string[]; children?: ReactNode }) {
  const accent = useStore(s => s.accent);
  const insets = useSafeAreaInsets();
  const [group, setGroup] = useState<string>('chest');
  const [q, setQ] = useState('');
  const g = PICK_GROUPS.find(x => x.id === group);
  const list = q.trim()
    ? searchExercises(q, 24).filter(e => e.category !== 'stretching').map(e => e.name)
    : group === 'plan' ? planned : group === 'yours' ? yours : g?.lifts ?? [];
  const title = q.trim() ? `Results for “${q.trim()}”` : group === 'plan' ? `Today · ${planTitle}` : group === 'yours' ? 'Your lifts' : g?.name ?? '';
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: F.arena }}>
        <View style={{ paddingTop: SP.lg, paddingHorizontal: SP.lg, paddingBottom: SP.md, gap: SP.md, borderBottomWidth: 2, borderBottomColor: F.rope }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <View accessibilityRole="header">
                <Txt face="display" size={26} lh={1.2}>ADD EXERCISES</Txt>
              </View>
              <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{`${have.length} IN THIS WORKOUT · TAP AGAIN TO REMOVE`}</Txt>
            </View>
            <Tap onPress={onClose} accessibilityLabel="Done adding exercises" style={{ minHeight: HIT, minWidth: 72, paddingHorizontal: SP.lg, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
              <Txt face="display" lean={false} size={18} ls={0.04} color={onColor(accent)}>DONE</Txt>
            </Tap>
          </View>
          <View>
            <Field value={q} onChangeText={setQ} placeholder="Search 750+ exercises" accessibilityLabel="Search exercises" autoCorrect={false} />
            {q ? (
              <Tap onPress={() => setQ('')} accessibilityLabel="Clear search" style={{ position: 'absolute', right: 2, top: 2, width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={16} color={F.smoke} tint={0} strokeWidth={2} />
              </Tap>
            ) : null}
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: insets.bottom + SP.huge, gap: SP.lg }} keyboardShouldPersistTaps="handled">
          {!q.trim() ? (
            <>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: SP.sm }}>
                {([['plan', 'Today’s plan', planTitle], ['yours', 'Your lifts', yours.length ? `${yours.length} logged` : 'none yet']] as const).map(([id, label, sub]) => (
                  <Chip key={id} label={label} sub={sub} on={group === id} onPress={() => setGroup(id)} style={{ flex: 1, minHeight: 52 }} />
                ))}
              </View>
              <SectionHeader title="By muscle" />
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
                {PICK_GROUPS.map(x => <Chip key={x.id} label={x.name} on={group === x.id} onPress={() => setGroup(x.id)} style={{ width: '31%', flexGrow: 1, alignItems: 'center' }} />)}
              </View>
            </>
          ) : null}
          <SectionHeader title={title} meta={`${list.length}`} />
          <View style={{ gap: SP.xs }}>
            {list.map((name, i) => {
              const added = have.includes(liftKey(name));
              const lib = findExercise(name);
              return (
                <Tap key={`${name}-${i}`} onPress={() => (added ? onRemove(name) : onAdd(name))} accessibilityRole="checkbox" accessibilityState={{ checked: added }} accessibilityLabel={`${name}${added ? ', added' : ''}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 52, paddingVertical: SP.sm, paddingLeft: SP.md, paddingRight: SP.sm, backgroundColor: F.canvas, borderLeftWidth: 4, borderLeftColor: added ? accent : F.canvas }}>
                    <View style={{ flex: 1 }}>
                      <Txt size={15} w={600} lh={1.3}>{name}</Txt>
                      {lib ? <Txt face="label" w={400} size={12} ls={0.08} color={F.smoke} numberOfLines={1}>{[lib.primary.join(', '), lib.equipment].filter(Boolean).join(' · ').toUpperCase()}</Txt> : null}
                    </View>
                    {added ? <Txt face="label" w={600} size={12} ls={0.12} color={accent}>ADDED</Txt> : null}
                    <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: added ? accent : F.arena, borderWidth: 2, borderColor: added ? accent : F.rope }}>
                      <Icon name={added ? 'check' : 'plus'} size={18} color={added ? onColor(accent) : F.chalk} tint={0} strokeWidth={2.2} />
                    </View>
                  </View>
                </Tap>
              );
            })}
            {!list.length ? <Txt size={14} w={500} color={F.smoke}>{group === 'yours' && !q ? 'Lifts you log show up here.' : 'Nothing found. Try another word.'}</Txt> : null}
          </View>
        </ScrollView>
      </View>
      {children}
    </Modal>
  );
}

/** A name for a free workout from what was trained: "Chest + Triceps". */
function titleFor(exercises: Exercise[]): string {
  const muscles: string[] = [];
  for (const e of exercises) {
    const m = findExercise(e.name)?.primary[0];
    if (m && !muscles.includes(m)) muscles.push(m);
  }
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  return muscles.length ? muscles.slice(0, 2).map(cap).join(' + ') : 'Gym session';
}

/** The working weight in a target like "4 × 6 · 82.5 kg" or "+15 kg"; null for bodyweight. */
function targetKg(target: string): number | null {
  const m = /([+-]?\d+(?:\.\d+)?)\s*kg/i.exec(target);
  return m ? Math.abs(parseFloat(m[1])) : null;
}
