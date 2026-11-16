// A workout: today's planned session, or a gym session ("mode=free") built from today's plan or your
// own picks. Nothing runs until you start: train now (live timer and rests), or log one you've
// already done (just the duration). Tick sets as you finish them; every exercise shows its XP.
//
// The screen stays quiet while you train: the clock, the lift you are on, its sets, and the rest timer.
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { Chip, Field, QuietButton, StatStrip } from '../components/dojo';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { CutButton, MeterBar, MoveRow, RoundStamp, SectionHeader, useTierColors } from '../components/fight';
import { Icon } from '../components/icons';
import { InkDot } from '../components/ink';
import { PAGE_X } from '../components/Screen';
import { IconButton, Tap, Txt } from '../components/ui';
import {
  clock, defaultSets, e1rm, type Exercise, exerciseXp, findExercise, isBodyweight, lastLifts, type LibExercise, liftKey, pad, PICK_GROUPS,
  dayName, nextPlan, records, restSeconds, searchExercises, sessionLine, sessionXp, SESSIONS, type SessionPlan, type SetLog, todaysPlan,
} from '@rei/shared';
import { C, F, fontFamily, HIT, onColor, RADIUS, SP } from '../lib/theme';
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

/** The workout as it ended, frozen when you finish: what the summary shows. */
interface Summary {
  title: string;
  seconds: number;
  done: number;
  total: number;
  xp: number;
  /** Kilograms moved (weight × reps over the sets done). */
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
  // The lift you're on: the first exercise with a set still to do.
  const open = rows.findIndex(r => r.done.some(v => !v));
  const current = exercises.length ? (open < 0 ? exercises.length : open + 1) : 0;

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
    const kept = rows.flatMap(r => r.done.map((v, j) => (v ? { reps: r.reps[j], kg: r.kg[j] ?? 0 } : null))).filter(x => x !== null);
    setSummary({ title: name, seconds: elapsed, done, total, xp, volume: kept.reduce((a, x) => a + x.kg * x.reps, 0), reps: kept.reduce((a, x) => a + x.reps, 0), prs });
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

  const title = free ? 'Gym workout' : today ? `Today · ${plan.title}` : `Extra · ${plan.title}`;
  const live = phase === 'live';
  const lifts = `${exercises.length} lift${exercises.length === 1 ? '' : 's'}`;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />

      {/* The header: which workout, which lift, the clock and the sets done */}
      <View style={{ paddingTop: insets.top + SP.sm, paddingHorizontal: PAGE_X, paddingBottom: SP.lg, gap: SP.md, borderBottomWidth: 1, borderBottomColor: F.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
          <IconButton size={HIT} onPress={leave} accessibilityLabel="Close workout">
            <Icon name="close" size={20} color={F.chalk} tint={0} strokeWidth={1.6} />
          </IconButton>
          <View accessibilityRole="header" style={{ flex: 1, gap: 2 }}>
            <Txt face="heading" size={17} lh={1.35} numberOfLines={1}>{title}</Txt>
            <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{current ? `Lift ${current} of ${exercises.length}` : 'No lifts yet'}</Txt>
          </View>
          <RoundStamp label={`+${xp} XP`} tone={xp ? 'accent' : 'outline'} size="sm" style={{ alignSelf: 'center' }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SP.md }}>
          {phase === 'past' ? (
            <View style={{ gap: SP.xs }}>
              <Txt face="label" size={12} color={F.smoke}>How long it took</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
                <IconButton size={HIT} onPress={() => setMinutes(m => Math.max(5, m - 5))} accessibilityLabel="5 minutes less">−</IconButton>
                <View accessible accessibilityLabel={`${minutes} minutes`} style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6, minWidth: 88 }}>
                  <Txt face="display" exact size={34} lh={1.2}>{`${minutes}`}</Txt>
                  <Txt face="mono" size={12} color={F.smoke}>min</Txt>
                </View>
                <IconButton size={HIT} onPress={() => setMinutes(m => Math.min(300, m + 5))} accessibilityLabel="5 minutes more">+</IconButton>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'flex-start', gap: 2 }}>
              <Txt face="label" size={12} color={live ? accent : F.smoke}>{live ? 'Training' : 'Not started'}</Txt>
              <Txt face="display" exact size={40} lh={1.15} color={live ? F.chalk : F.smoke} accessibilityLabel={`${Math.floor(elapsed / 60)} minutes ${elapsed % 60} seconds`}>{`${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)}`}</Txt>
            </View>
          )}
          <View accessible accessibilityLabel={`${done} of ${total} sets done`} style={{ alignItems: 'flex-end', gap: 2, paddingBottom: 4 }}>
            <Txt face="label" size={12} color={F.smoke}>Sets done</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Txt face="num" size={28} lh={1.3} color={done ? accent : F.chalk}>{done}</Txt>
              <Txt face="mono" size={14} color={F.smoke}>{`/ ${total}`}</Txt>
            </View>
          </View>
        </View>

        <MeterBar pct={total ? done / total : 0} height={8} accessibilityLabel={`${done} of ${total} sets done`} />
        {/* REI's line always has its two lines of room, so a longer or shorter one never moves the set rows under your thumb. */}
        {!free ? (
          <View accessibilityLiveRegion="polite" style={{ height: 2 * 15 * 1.45 * s.settings.textSize, justifyContent: 'center' }}>
            <Txt face={live ? 'voice' : 'sans'} size={15} lh={1.45} color={live ? F.chalk : F.smoke} numberOfLines={2}>
              {live ? sessionLine(total ? done / total : 0, plan) : phase === 'past' ? 'Tick the sets you did and set how long it took.' : exercises.length ? 'Start the clock, or just tick your first set: that starts it too.' : 'Use today’s plan, or build your own below.'}
            </Txt>
          </View>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: SP.xxl, paddingHorizontal: PAGE_X, paddingBottom: SP.huge, gap: SP.lg }} keyboardShouldPersistTaps="handled">
        {!exercises.length ? (
          <TodayPlan plan={today} next={next} byRei={!!s.program} onUse={usePlan} onBuild={() => setAdding(true)} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.lg }}>
            <Txt face="label" w={400} size={13} lh={1.4} color={F.smoke} style={{ flex: 1 }}>Tick a set when it is done. Tap a number to change it, a name for form tips.</Txt>
            <QuietButton lit icon="rei" label="Ask REI" accessibilityLabel="Ask REI to change today's workout" onPress={() => router.push({ pathname: '/talk', params: { draft: 'Change today’s workout: ' } })} />
          </View>
        )}

        {exercises.map((ex, i) => {
          const r = rows[i];
          const n = r.done.filter(Boolean).length;
          const won = n === r.done.length;
          const on = i + 1 === current && !won;
          return (
            <View key={`${i}-${ex.name}`} style={{ backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, paddingTop: SP.md, paddingBottom: SP.lg, paddingHorizontal: CARD_PAD, gap: SP.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                <Tap haptic={false} onPress={() => setInfo(i)} accessibilityLabel={`Lift ${i + 1}, ${ex.name}. ${n} of ${r.done.length} sets done`} accessibilityHint="Form tips and swaps" style={{ flex: 1, minHeight: HIT, justifyContent: 'center', gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                    <Txt face="mono" size={12} lh={1.35} color={on ? accent : F.smoke}>{`Lift ${i + 1}`}</Txt>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {r.done.slice(0, 10).map((v, j) => <InkDot key={j} size={8} color={v ? (isPr(i, j) ? gold : accent) : F.rope} />)}
                    </View>
                  </View>
                  <Txt face="heading" size={17} lh={1.35} numberOfLines={1}>{ex.name}</Txt>
                  <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{last[liftKey(ex.name)] ?? (ex.last || 'First time · tap for form tips')}</Txt>
                </Tap>
                {won ? <RoundStamp label={`+${exerciseXp(n)} XP`} size="sm" style={{ alignSelf: 'center' }} /> : <RoundStamp label={n ? `+${exerciseXp(n)} XP` : `${r.done.length} sets`} tone={n ? 'accent' : 'outline'} size="sm" style={{ alignSelf: 'center' }} />}
                <Tap onPress={() => removeExercise(i)} accessibilityLabel={`Remove ${ex.name}`} style={{ width: HIT, height: HIT, marginRight: -SP.sm, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={16} color={F.smoke} tint={0} strokeWidth={1.6} />
                </Tap>
              </View>

              <View style={{ gap: SP.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SET_GAP }}>
                  <Txt face="mono" size={12} color={F.smoke} style={{ width: SET_TAG }}>Set</Txt>
                  <Txt face="mono" size={12} color={F.smoke} align="center" style={{ flex: KG_FLEX }}>Weight · kg</Txt>
                  <Txt face="mono" size={12} color={F.smoke} align="center" style={{ flex: 1 }}>Reps</Txt>
                  <Txt face="mono" size={12} color={F.smoke} align="center" numberOfLines={1} style={{ width: SET_TICK }}>Done</Txt>
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

              <View style={{ flexDirection: 'row', gap: SP.sm }}>
                <QuietButton icon="plus" label="Add set" onPress={() => addSet(i)} accessibilityLabel={`Add a set to ${ex.name}`} style={{ flex: 1 }} />
                {r.reps.length > 1 && !r.done[r.done.length - 1] ? <QuietButton icon="close" label="Last set" onPress={() => dropSet(i)} accessibilityLabel={`Remove the last set of ${ex.name}`} /> : null}
              </View>
            </View>
          );
        })}

        {exercises.length ? <QuietButton icon="plus" label="Add exercise" onPress={() => setAdding(true)} style={{ minHeight: 52 }} /> : null}
      </ScrollView>

      {/* The rest between sets */}
      {rest && live ? (
        <View accessibilityLiveRegion="polite" style={{ marginHorizontal: PAGE_X, marginBottom: SP.md, paddingVertical: SP.md, paddingHorizontal: SP.lg, backgroundColor: F.canvas, borderWidth: 1, borderColor: restLeft ? F.line : accent, borderRadius: RADIUS.card, gap: SP.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.md }}>
            <View style={{ alignItems: 'flex-start', flexShrink: 1, gap: 2 }}>
              <Txt face="label" size={12} color={restLeft ? F.smoke : accent}>{restLeft ? 'Rest' : 'Rest over'}</Txt>
              <Txt face="display" exact size={28} lh={1.2} color={restLeft ? F.chalk : accent} accessibilityLabel={restLeft ? `Rest, ${restLeft} seconds left` : 'Rest over. Next set'}>{restLeft ? clock(restLeft) : 'Next set'}</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: SP.sm }}>
              {restLeft ? <QuietButton label="+30" accessibilityLabel="Rest 30 seconds longer" onPress={() => setRest(x => (x ? { ...x, endsAt: x.endsAt + 30000, total: x.total + 30 } : x))} style={{ minWidth: 64 }} /> : null}
              <QuietButton label={restLeft ? 'Skip' : 'OK'} accessibilityLabel={restLeft ? 'Skip the rest' : 'Dismiss'} onPress={() => setRest(null)} style={{ minWidth: 64 }} />
            </View>
          </View>
          <MeterBar pct={1 - restLeft / rest.total} height={8} accessibilityLabel="Rest timer" />
        </View>
      ) : null}

      <View style={{ paddingTop: SP.md, paddingHorizontal: PAGE_X, paddingBottom: Math.max(insets.bottom, SP.lg), borderTopWidth: 1, borderTopColor: F.line, backgroundColor: F.arena, gap: SP.xs }}>
        {phase === 'ready' ? (
          <>
            <CutButton icon="timer" label={exercises.length ? 'Start workout' : 'Pick exercises first'} meta={exercises.length ? lifts : undefined} disabled={!exercises.length} onPress={start} />
            <Tap onPress={() => setPhase('past')} disabled={!exercises.length} style={{ minHeight: HIT, alignItems: 'center', justifyContent: 'center' }}>
              <Txt face="label" size={13} lh={1.4} color={exercises.length ? F.smoke : C.faint} align="center">Already done? Log it without the timer</Txt>
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
      {summary ? <WorkoutDone sum={summary} gold={gold} onLeave={leave} /> : null}
    </View>
  );
}

const big = (n: number) => Math.round(n).toLocaleString('en-US');

/** The summary once the workout is saved: time, sets, volume, records and the XP it earned, then one way out. */
function WorkoutDone({ sum, gold, onLeave }: { sum: Summary; gold: string; onLeave: () => void }) {
  const accent = useStore(s => s.accent);
  const insets = useSafeAreaInsets();
  const clean = sum.done === sum.total;
  const stats = [
    { k: 'Time', v: clock(sum.seconds) },
    { k: 'Sets done', v: `${sum.done}/${sum.total}` },
    sum.volume > 0 ? { k: 'Volume', v: sum.volume >= 10000 ? `${(sum.volume / 1000).toFixed(1)} t` : `${big(sum.volume)} kg` } : { k: 'Reps', v: big(sum.reps) },
    { k: 'Records', v: String(sum.prs.length), hot: sum.prs.length > 0 },
  ];
  return (
    <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, { backgroundColor: F.arena }]}>
      <Backdrop glow="bottom" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: insets.top + SP.xxl, paddingHorizontal: PAGE_X, paddingBottom: SP.xxl, gap: SP.huge }}>
        <View style={{ alignItems: 'flex-start', gap: SP.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
            <RoundStamp label="Done" size="sm" style={{ alignSelf: 'center' }} />
            <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{sum.title}</Txt>
          </View>
          <View accessibilityRole="header" accessibilityLiveRegion="polite">
            <Txt face="display" exact size={34} lh={1.2} fit>Workout saved</Txt>
          </View>
          <Txt face="voice" size={17} lh={1.5}>{clean ? 'Every set done. Eat, then sleep. That is where it turns into muscle.' : `${sum.done} of ${sum.total} sets done. Every one of them counts.`}</Txt>
        </View>

        <View style={{ gap: SP.md }}>
          <View accessible accessibilityLabel={`${sum.xp} XP earned`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.md }}>
            <Txt face="display" exact size={44} lh={1.2} color={accent}>{`+${big(sum.xp)}`}</Txt>
            <Txt face="label" size={13} color={F.smoke}>XP earned</Txt>
          </View>
          <MeterBar pct={sum.total ? sum.done / sum.total : 0} height={8} accessibilityLabel={`${sum.done} of ${sum.total} sets done`} />
        </View>

        <StatStrip items={stats} />

        {sum.prs.length ? (
          <View style={{ gap: SP.md }}>
            <SectionHeader title="New records" meta={`${sum.prs.length}`} />
            <View>
              {sum.prs.map(p => <MoveRow key={p.name} name={p.name} value={p.set} done accent={gold} />)}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <View style={{ paddingTop: SP.md, paddingHorizontal: PAGE_X, paddingBottom: Math.max(insets.bottom, SP.lg), borderTopWidth: 1, borderTopColor: F.line, backgroundColor: F.arena }}>
        <CutButton icon="check" label="Done" meta="Saved to your log" accessibilityLabel="Leave the workout. It is saved" onPress={onLeave} />
      </View>
    </View>
  );
}

// The set row's fixed columns: the set number, the gaps and the tick box. The card's side padding
// stays at 12 so two steppers still fit on a narrow phone.
const CARD_PAD = SP.md, SET_TAG = 24, SET_GAP = 6, SET_TICK = HIT, KG_FLEX = 1.25;
/** A stepper button is drawn 40pt wide; slop on its outer side makes the target 44. */
const STEP_W = 40, STEP_SLOP = HIT - STEP_W;

/** One set: weight and reps you can step or type, and the tick box. Bodyweight shows BW until a load is added. */
function SetRow({ n, kg, reps, done, pr, acc, gold, onKg, onReps, onToggle }: { n: number; kg: number | null; reps: number; done: boolean; pr: boolean; acc: string; gold: string; onKg: (v: number | null) => void; onReps: (v: number) => void; onToggle: () => void }) {
  const lit = pr ? gold : acc;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SET_GAP }}>
      <View accessible accessibilityLabel={pr ? `Set ${n}, personal record` : `Set ${n}`} style={{ width: SET_TAG, height: HIT, justifyContent: 'center' }}>
        <Txt face="num" size={pr ? 12 : 14} color={done ? lit : F.smoke}>{pr ? 'PR' : String(n)}</Txt>
      </View>
      <Stepper flex={KG_FLEX} what={`Set ${n} weight`} value={kg} step={2.5} min={0} decimals onChange={v => onKg(v === 0 ? null : v)} empty="BW" />
      <Stepper flex={1} what={`Set ${n} reps`} value={reps} step={1} min={1} onChange={v => onReps(Math.max(1, Math.round(v ?? 1)))} />
      {/* Still to do: an empty box, quiet. Done: filled in your colour (gold for a record) with the tick. Never a tick on an open set. */}
      <Tap haptic={false} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={`Set ${n} done`} style={{ width: SET_TICK, height: HIT, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? lit : F.arena, borderWidth: 1, borderColor: done ? lit : F.rule, borderRadius: RADIUS.sm }}>
        {done ? <Icon name="check" size={20} color={onColor(lit)} tint={0} strokeWidth={2} /> : null}
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
  // The frame's 1pt border comes out of the buttons, so the row stays 44pt tall.
  const btn = { width: STEP_W - 1, height: HIT - 2, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flex, flexDirection: 'row', alignItems: 'center', backgroundColor: F.arena, borderWidth: 1, borderColor: F.rule, borderRadius: RADIUS.sm }}>
      <Tap haptic={false} onPress={() => bump(-step)} accessibilityLabel={`${what}: ${step} less`} hitSlop={{ left: STEP_SLOP }} style={btn}>
        <Txt size={18} w={500} lh={1.3} color={F.smoke}>−</Txt>
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
        style={{ flex: 1, minWidth: 0, height: HIT - 2, padding: 0, textAlign: 'center', fontFamily: fontFamily('num'), fontSize: 16 * s.settings.textSize, color: F.chalk }}
      />
      <Tap haptic={false} onPress={() => bump(step)} accessibilityLabel={`${what}: ${step} more`} hitSlop={{ right: STEP_SLOP }} style={btn}>
        <Txt size={18} w={500} lh={1.3} color={F.smoke}>+</Txt>
      </Tap>
    </View>
  );
}

/** "4 × 6 · 82.5 kg" → the sets and reps ("4 × 6") and the load ("82.5 kg"). */
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
        <View style={{ gap: SP.lg }}>
          <View style={{ alignItems: 'flex-start', gap: SP.xs }}>
            <Txt face="display" exact size={24} lh={1.25}>{plan.title}</Txt>
            <Txt size={15} lh={1.45} color={F.smoke}>{plan.sub}</Txt>
          </View>
          <View>
            {plan.exercises.map((e, i) => {
              const [value, detail] = splitTarget(e.target);
              return <MoveRow key={e.name} index={i + 1} name={e.name} detail={detail} value={value} />;
            })}
          </View>
          <View style={{ gap: SP.sm }}>
            <CutButton size="md" icon="check" label="Use today’s plan" meta={`${plan.exercises.length} lift${plan.exercises.length === 1 ? '' : 's'}`} onPress={() => onUse(plan)} />
            <QuietButton lit icon="rei" label="Ask REI to change it" onPress={askRei} />
          </View>
        </View>
      ) : (
        <View style={{ gap: SP.lg }}>
          <View style={{ alignItems: 'flex-start', gap: SP.xs }}>
            <Txt face="display" exact size={24} lh={1.25}>{`${dayName()} · rest day`}</Txt>
            <Txt size={15} lh={1.45} color={F.smoke}>REI planned recovery today. Training anyway? Pull your next session forward or build your own.</Txt>
          </View>
          {next ? (
            <>
              <View style={{ backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, padding: SP.lg, gap: SP.xs }}>
                <Txt face="mono" size={12} lh={1.35} color={F.smoke}>{`Next up · ${next.day}`}</Txt>
                <Txt face="heading" size={17} lh={1.35}>{next.plan.title}</Txt>
                <Txt size={13} lh={1.4} color={F.smoke} numberOfLines={1}>{next.plan.exercises.map(e => e.name).join(' · ')}</Txt>
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

const capFirst = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

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
        <View style={{ paddingTop: SP.xxl, paddingHorizontal: PAGE_X, paddingBottom: SP.lg, gap: SP.lg, borderBottomWidth: 1, borderBottomColor: F.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
            <View style={{ flex: 1, alignItems: 'flex-start', gap: 2 }}>
              <View accessibilityRole="header">
                <Txt face="display" exact size={24} lh={1.25}>Add exercises</Txt>
              </View>
              <Txt face="mono" size={12} lh={1.35} color={F.smoke}>{`${have.length} added · tap again to remove`}</Txt>
            </View>
            <QuietButton label="Done" onPress={onClose} accessibilityLabel="Done adding exercises" style={{ minWidth: 72 }} />
          </View>
          <View>
            <Field value={q} onChangeText={setQ} placeholder="Search 750+ exercises" accessibilityLabel="Search exercises" autoCorrect={false} />
            {q ? (
              <Tap onPress={() => setQ('')} accessibilityLabel="Clear search" style={{ position: 'absolute', right: 2, top: 2, width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={16} color={F.smoke} tint={0} strokeWidth={1.6} />
              </Tap>
            ) : null}
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingTop: SP.xxl, paddingHorizontal: PAGE_X, paddingBottom: insets.bottom + SP.huge, gap: SP.md }} keyboardShouldPersistTaps="handled">
          {!q.trim() ? (
            <>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: SP.sm }}>
                {([['plan', 'Today’s plan', planTitle], ['yours', 'Your lifts', yours.length ? `${yours.length} logged` : 'none yet']] as const).map(([id, label, sub]) => (
                  <Chip key={id} label={label} sub={sub} on={group === id} onPress={() => setGroup(id)} style={{ flex: 1, minHeight: 56 }} />
                ))}
              </View>
              <SectionHeader title="By muscle" style={{ marginTop: SP.md }} />
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
                {PICK_GROUPS.map(x => <Chip key={x.id} label={x.name} on={group === x.id} onPress={() => setGroup(x.id)} style={{ width: '31%', flexGrow: 1, alignItems: 'center' }} />)}
              </View>
            </>
          ) : null}
          <SectionHeader title={title} meta={`${list.length}`} style={{ marginTop: q.trim() ? 0 : SP.md }} />
          <View>
            {list.map((name, i) => {
              const added = have.includes(liftKey(name));
              const lib = findExercise(name);
              return (
                <Tap key={`${name}-${i}`} onPress={() => (added ? onRemove(name) : onAdd(name))} accessibilityRole="checkbox" accessibilityState={{ checked: added }} accessibilityLabel={`${name}${added ? ', added' : ''}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 56, paddingVertical: SP.sm, borderBottomWidth: 1, borderBottomColor: C.line }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt size={15} w={500} lh={1.35}>{name}</Txt>
                      {lib ? <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{capFirst([lib.primary.join(', '), lib.equipment].filter(Boolean).join(' · '))}</Txt> : null}
                    </View>
                    {added ? <Txt face="label" size={12} color={accent}>Added</Txt> : null}
                    <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: added ? accent : F.canvas, borderWidth: 1, borderColor: added ? accent : F.rule, borderRadius: RADIUS.sm }}>
                      <Icon name={added ? 'check' : 'plus'} size={18} color={added ? onColor(accent) : F.chalk} tint={0} strokeWidth={1.75} />
                    </View>
                  </View>
                </Tap>
              );
            })}
            {!list.length ? <Txt size={15} lh={1.45} color={F.smoke}>{group === 'yours' && !q ? 'Lifts you log show up here.' : 'Nothing found. Try another word.'}</Txt> : null}
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
