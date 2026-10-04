// A workout: today's planned session, or a gym session ("mode=free") built from today's plan or your
// own picks. Nothing runs until you start: train now (live timer and rests), or log one you've
// already done (just the duration). Tick sets as you finish them; every exercise shows its XP.
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { Icon } from '../components/icons';
import { Gauge, Heading, Panel, Stamp, Tile } from '../components/manga';
import { IconButton, Tap, Txt } from '../components/ui';
import {
  clock, defaultSets, e1rm, type Exercise, exerciseXp, findExercise, isBodyweight, lastLifts, type LibExercise, liftKey, pad, PICK_GROUPS,
  dayName, nextPlan, records, restSeconds, searchExercises, SESSION_ICON, sessionLine, sessionXp, SESSIONS, type SessionPlan, type SetLog, todaysPlan,
} from '@rei/shared';
import { alpha, C, fontFamily } from '../lib/theme';
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

export default function Session() {
  const s = useStore();
  const { accent } = s;
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
  const [info, setInfo] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const restDone = useRef(false);

  useEffect(() => {
    if (phase !== 'live') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [phase]);

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
    Alert.alert(`Remove ${exercises[i].name}?`, `You've ticked ${ticked} set${ticked > 1 ? 's' : ''} on it.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeExercise(i) },
    ]);
  };

  const swap = (i: number, to: LibExercise) => {
    const prev = best[liftKey(to.name)]?.best;
    setExercises(cur => cur.map((e, a) => (a === i ? { ...e, name: to.name, target: `${e.reps.length} × ${e.reps[0]}${prev?.kg ? ` · ${prev.kg} kg` : ''}`, last: last[liftKey(to.name)] } : e)));
    update(i, r => ({ ...r, kg: r.kg.map(() => prev?.kg ?? null), done: r.done.map(() => false) }));
  };

  const complete = () => {
    if (!done) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    s.finishSession(done, total, elapsed, setLogs, free ? titleFor(exercises) : plan.title);
    router.back();
  };

  /** A done set that beats this lift's best estimated max. */
  const isPr = (i: number, j: number) => {
    if (!rows[i].done[j]) return false;
    const prev = best[liftKey(exercises[i].name)]?.best.e1rm;
    const est = e1rm(rows[i].kg[j], rows[i].reps[j]);
    return prev != null && est != null && est > prev;
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton size={40} onPress={() => router.back()}>
            <Icon name="close" size={18} color={C.body} />
          </IconButton>
          <Txt face="mono" size={11} ls={0.16} color={C.muted}>{free ? 'GYM WORKOUT' : today ? `TODAY · ${plan.title.toUpperCase()}` : `EXTRA · ${plan.title.toUpperCase()}`}</Txt>
          <Stamp text={`+${xp} XP`} color={xp ? C.warn : C.dim} tilt={0} />
        </View>
        {phase === 'past' ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18 }}>
            <View style={{ gap: 6 }}>
              <Txt face="mono" size={10} ls={0.14} color={C.muted}>HOW LONG IT TOOK</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Tap onPress={() => setMinutes(m => Math.max(5, m - 5))} style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: C.line3, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt size={20} color={C.body}>−</Txt>
                </Tap>
                <Txt face="mono" size={40} ls={-0.04}>{`${minutes}`}<Txt face="mono" size={16} color={C.muted}> min</Txt></Txt>
                <Tap onPress={() => setMinutes(m => Math.min(300, m + 5))} style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: C.line3, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt size={20} color={C.body}>+</Txt>
                </Tap>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt face="mono" size={10} ls={0.14} color={C.muted}>SETS DONE</Txt>
              <Txt size={30} w={300}>{done}<Txt size={30} w={300} color={C.dim}>{` / ${total}`}</Txt></Txt>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18 }}>
            <View>
              <Txt face="mono" size={10} ls={0.14} color={phase === 'live' ? accent : C.muted}>{phase === 'live' ? 'TRAINING' : 'NOT STARTED'}</Txt>
              <Txt face="mono" size={44} ls={-0.04} color={phase === 'live' ? C.text : C.ghost}>{`${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)}`}</Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt face="mono" size={10} ls={0.14} color={C.muted}>SETS DONE</Txt>
              <Txt size={30} w={300}>{done}<Txt size={30} w={300} color={C.dim}>{` / ${total}`}</Txt></Txt>
            </View>
          </View>
        )}
        <View style={{ marginTop: 10 }}>
          <Gauge pct={total ? done / total : 0} acc={accent} segments={24} height={6} />
        </View>
        {phase === 'live' && !free ? <Txt size={13} lh={1.4} color={C.sub} style={{ marginTop: 10 }}>{sessionLine(total ? done / total : 0, plan)}</Txt> : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
        {!exercises.length ? (
          <TodayPlan plan={today} next={next} acc={accent} byRei={!!s.program} onUse={usePlan} onBuild={() => setAdding(true)} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt face="mono" size={9.5} ls={0.12} color={C.faint} style={{ flex: 1 }}>TAP ✓ WHEN A SET IS DONE · TAP NUMBERS TO CHANGE · TAP A NAME FOR FORM TIPS</Txt>
            <Tap onPress={() => router.push({ pathname: '/talk', params: { draft: 'Change today’s workout: ' } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="rei" size={14} color={accent} />
              <Txt size={12} color={accent}>Ask REI</Txt>
            </Tap>
          </View>
        )}
        {exercises.map((ex, i) => {
          const r = rows[i];
          const n = r.done.filter(Boolean).length;
          return (
            <Panel key={`${i}-${ex.name}`} acc={n ? accent : C.muted} tone={n ? 0.35 : 0.15} dots={false} pad={14}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Tap haptic={false} onPress={() => setInfo(i)} style={{ flex: 1 }}>
                  <Txt size={17} w={600} numberOfLines={1}>{ex.name}</Txt>
                  <Txt face="mono" size={10} color={C.dim}>{last[liftKey(ex.name)] ?? (ex.last || 'FIRST TIME · TAP FOR FORM TIPS')}</Txt>
                </Tap>
                <Stamp text={n ? `+${exerciseXp(n)} XP` : `${r.done.length} sets`} color={n ? C.warn : C.muted} tilt={0} size={8.5} />
                <Tap onPress={() => removeExercise(i)} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={14} color={C.faint} />
                </Tap>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 6, paddingHorizontal: 2 }}>
                <Txt face="mono" size={9} ls={0.14} color={C.faint} style={{ width: 30 }}>SET</Txt>
                <Txt face="mono" size={9} ls={0.14} color={C.faint} style={{ flex: 1.15, textAlign: 'center' }}>WEIGHT · KG</Txt>
                <Txt face="mono" size={9} ls={0.14} color={C.faint} style={{ flex: 1, textAlign: 'center' }}>REPS</Txt>
                <View style={{ width: 46 }} />
              </View>
              <View style={{ gap: 6 }}>
                {r.reps.map((reps, j) => (
                  <SetRow
                    key={j}
                    n={j + 1}
                    kg={r.kg[j]}
                    reps={reps}
                    done={r.done[j]}
                    pr={isPr(i, j)}
                    acc={accent}
                    onKg={v => update(i, x => ({ ...x, kg: x.kg.map((k, b) => (b === j ? v : k)) }))}
                    onReps={v => update(i, x => ({ ...x, reps: x.reps.map((k, b) => (b === j ? v : k)) }))}
                    onToggle={() => toggle(i, j)}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Tap onPress={() => addSet(i)} style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: alpha(accent, 0.5), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                  <Icon name="plus" size={15} color={accent} />
                  <Txt size={13} w={500} color={accent}>Add set</Txt>
                </Tap>
                {r.reps.length > 1 && !r.done[r.done.length - 1] ? (
                  <Tap onPress={() => dropSet(i)} style={{ height: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: C.line3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                    <Icon name="close" size={13} color={C.muted} />
                    <Txt size={13} color={C.muted}>Last set</Txt>
                  </Tap>
                ) : null}
              </View>
            </Panel>
          );
        })}

        {exercises.length ? (
          <Tap onPress={() => setAdding(true)} style={{ height: 56, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: alpha(accent, 0.6), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            <Icon name="plus" size={18} color={accent} />
            <Txt size={15} w={500} color={accent}>Add exercise</Txt>
          </Tap>
        ) : null}
      </ScrollView>

      {rest && phase === 'live' ? (
        <View style={{ marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: restLeft ? C.line3 : accent, backgroundColor: '#0D0F13', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="timer" size={20} color={restLeft ? C.muted : accent} />
              <Txt face="mono" size={24} color={restLeft ? C.text : accent}>{restLeft ? clock(restLeft) : 'Next set'}</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {restLeft ? (
                <Tap onPress={() => setRest(x => (x ? { ...x, endsAt: x.endsAt + 30000, total: x.total + 30 } : x))} style={{ height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.line3, justifyContent: 'center' }}>
                  <Txt face="mono" size={12} color={C.body}>+30</Txt>
                </Tap>
              ) : null}
              <Tap onPress={() => setRest(null)} style={{ height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.line3, justifyContent: 'center' }}>
                <Txt face="mono" size={12} color={C.body}>{restLeft ? 'SKIP' : 'OK'}</Txt>
              </Tap>
            </View>
          </View>
          <Gauge pct={restLeft / rest.total} acc={accent} segments={24} height={4} />
        </View>
      ) : null}

      <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20), borderTopWidth: 1, borderTopColor: C.line, gap: 10 }}>
        {phase === 'ready' ? (
          <>
            <Tap onPress={start} disabled={!exercises.length} style={{ height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: exercises.length ? accent : '#14161A' }}>
              <Icon name="timer" size={20} color={exercises.length ? C.ink : C.dim} tint={0} strokeWidth={2} />
              <Txt size={17} w={600} color={exercises.length ? C.ink : C.dim}>{exercises.length ? 'Start workout' : 'Pick exercises first'}</Txt>
            </Tap>
            <Tap onPress={() => setPhase('past')} disabled={!exercises.length} style={{ height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: C.line3, alignItems: 'center', justifyContent: 'center' }}>
              <Txt size={14} color={exercises.length ? C.body : C.dim}>Already done? Log it without the timer</Txt>
            </Tap>
          </>
        ) : (
          <Tap onPress={complete} disabled={!done} style={{ height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: done ? accent : '#14161A' }}>
            <Icon name="check" size={20} color={done ? C.ink : C.dim} tint={0} strokeWidth={2.2} />
            <Txt size={17} w={600} color={done ? C.ink : C.dim}>{done ? `${phase === 'past' ? 'Save workout' : 'Finish workout'} · +${xp} XP` : 'Tick the sets you did'}</Txt>
          </Tap>
        )}
      </View>

      <AddExercise open={adding} onClose={() => setAdding(false)} onAdd={add} onRemove={unadd} have={exercises.map(e => liftKey(e.name))} planned={plan.exercises.map(e => e.name)} planTitle={today ? `${dayName()} · ${today.title}` : next ? `Next · ${next.day} · ${next.plan.title}` : plan.title} yours={Object.values(best).sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1)).slice(0, 8).map(r => r.name)} />
      <ExerciseSheet name={info === null ? null : exercises[info]?.name ?? null} onClose={() => setInfo(null)} onSwap={to => info !== null && swap(info, to)} />
    </View>
  );
}

/** One set: weight and reps you can step or type, and the done button. Bodyweight shows BW until a load is added. */
function SetRow({ n, kg, reps, done, pr, acc, onKg, onReps, onToggle }: { n: number; kg: number | null; reps: number; done: boolean; pr: boolean; acc: string; onKg: (v: number | null) => void; onReps: (v: number) => void; onToggle: () => void }) {
  const lit = pr ? C.warn : acc;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, borderRadius: 12, borderWidth: 1.5, borderColor: done ? lit : C.line3, backgroundColor: done ? '#12171B' : '#0B0D10' }}>
      <View style={{ width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? lit : '#16191E' }}>
        <Txt face="mono" size={pr ? 9 : 12} w={600} color={done ? C.ink : C.muted}>{pr ? 'PR' : String(n)}</Txt>
      </View>
      <Stepper flex={1.15} value={kg} step={2.5} min={0} decimals onChange={v => onKg(v === 0 ? null : v)} empty="BW" />
      <Stepper flex={1} value={reps} step={1} min={1} onChange={v => onReps(Math.max(1, Math.round(v ?? 1)))} />
      <Tap haptic={false} onPress={onToggle} style={{ width: 46, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? lit : 'transparent', borderWidth: 1.5, borderColor: done ? lit : alpha(acc, 0.45) }}>
        <Icon name="check" size={20} color={done ? C.ink : acc} tint={0} strokeWidth={2.4} />
      </Tap>
    </View>
  );
}

/** − value + with the value typeable. `empty` is shown for null (bodyweight). */
function Stepper({ value, step, min, onChange, empty, decimals, flex }: { value: number | null; step: number; min: number; onChange: (v: number | null) => void; empty?: string; decimals?: boolean; flex: number }) {
  const s = useStore();
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value == null ? '' : String(+value.toFixed(2)));
  const bump = (d: number) => {
    Haptics.selectionAsync().catch(() => {});
    const v = Math.max(min, +((value ?? 0) + d).toFixed(2));
    setText(null);
    onChange(v);
  };
  const btn = { width: 28, height: 40, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flex, flexDirection: 'row', alignItems: 'center', borderRadius: 10, backgroundColor: '#16191E' }}>
      <Tap haptic={false} onPress={() => bump(-step)} style={btn}>
        <Txt size={18} color={C.muted}>−</Txt>
      </Tap>
      <TextInput
        value={shown}
        placeholder={empty}
        placeholderTextColor={C.muted}
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
        style={{ flex: 1, minWidth: 0, height: 40, padding: 0, textAlign: 'center', fontFamily: fontFamily('mono', 500), fontSize: 16 * s.settings.textSize, color: C.text }}
      />
      <Tap haptic={false} onPress={() => bump(step)} style={btn}>
        <Txt size={18} color={C.muted}>+</Txt>
      </Tap>
    </View>
  );
}

/** Today's session as REI planned it: use it as is, ask REI to change it, or build your own. */
function TodayPlan({ plan, next, acc, byRei, onUse, onBuild }: { plan: SessionPlan | null; next: { day: string; plan: SessionPlan } | null; acc: string; byRei: boolean; onUse: (p: SessionPlan) => void; onBuild: () => void }) {
  return (
    <>
      <Heading icon="today" title={`${dayName()}'s plan`} acc={acc} right={byRei ? 'WRITTEN BY REI' : 'DEFAULT SPLIT'} />
      {plan ? (
        <Panel acc={acc} pad={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12171B', borderWidth: 1.5, borderColor: acc }}>
              <Icon name={SESSION_ICON[plan.key]} size={26} color={acc} tint={0.3} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={22} w={600}>{plan.title}</Txt>
              <Txt size={12} color={C.sub}>{plan.sub}</Txt>
            </View>
          </View>
          <View style={{ marginTop: 14, gap: 2 }}>
            {plan.exercises.map((e, i) => (
              <View key={e.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <Txt face="mono" size={11} color={C.dim} style={{ width: 18 }}>{String(i + 1)}</Txt>
                <Txt size={15} style={{ flex: 1 }} numberOfLines={1}>{e.name}</Txt>
                <Txt face="mono" size={11} color={C.muted}>{e.target}</Txt>
              </View>
            ))}
          </View>
          <Tap onPress={() => onUse(plan)} style={{ marginTop: 14, height: 50, borderRadius: 12, backgroundColor: acc, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            <Icon name="check" size={18} color={C.ink} tint={0} strokeWidth={2.2} />
            <Txt size={16} w={600} color={C.ink}>Use today’s plan</Txt>
          </Tap>
          <Tap onPress={() => router.push({ pathname: '/talk', params: { draft: 'Change today’s workout: ' } })} style={{ marginTop: 10, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: alpha(acc, 0.5), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            <Icon name="rei" size={16} color={acc} />
            <Txt size={14} color={acc}>Ask REI to change it</Txt>
          </Tap>
        </Panel>
      ) : (
        <Panel acc={C.muted} tone={0.2} pad={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="sleep" size={30} color={C.muted} />
            <View style={{ flex: 1 }}>
              <Txt size={18} w={600}>{`${dayName()} · Rest day`}</Txt>
              <Txt size={13} color={C.sub}>REI planned recovery today. Training anyway? Pull your next session forward or build your own.</Txt>
            </View>
          </View>
          {next ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: '#14161A' }}>
                <Icon name={SESSION_ICON[next.plan.key]} size={22} color={acc} />
                <View style={{ flex: 1 }}>
                  <Txt face="mono" size={9.5} ls={0.14} color={C.muted}>{`NEXT UP · ${next.day.toUpperCase()}`}</Txt>
                  <Txt size={16} w={600}>{next.plan.title}</Txt>
                  <Txt size={12} color={C.sub} numberOfLines={1}>{next.plan.exercises.map(e => e.name).join(' · ')}</Txt>
                </View>
              </View>
              <Tap onPress={() => onUse(next.plan)} style={{ marginTop: 10, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: acc, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={15} w={600} color={acc}>{`Do ${next.day}'s ${next.plan.title} today`}</Txt>
              </Tap>
            </>
          ) : null}
        </Panel>
      )}
      <Tap onPress={onBuild} style={{ height: 56, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
        <Icon name="plus" size={18} color={C.body} />
        <Txt size={15} w={500} color={C.body}>Build my own workout</Txt>
      </Tap>
    </>
  );
}

/** Pick exercises: your lifts, today's plan, a muscle group, or search the whole library. */
function AddExercise({ open, onClose, onAdd, onRemove, have, planned, planTitle, yours }: { open: boolean; onClose: () => void; onAdd: (name: string) => void; onRemove: (name: string) => void; have: string[]; planned: string[]; planTitle: string; yours: string[] }) {
  const s = useStore();
  const { accent, theme } = s;
  const insets = useSafeAreaInsets();
  const [group, setGroup] = useState<string>('chest');
  const [q, setQ] = useState('');
  const g = PICK_GROUPS.find(x => x.id === group);
  const list = q.trim()
    ? searchExercises(q, 24).filter(e => e.category !== 'stretching').map(e => e.name)
    : group === 'plan' ? planned : group === 'yours' ? yours : g?.lifts ?? [];
  const title = q.trim() ? `Results for “${q.trim()}”` : group === 'plan' ? `Today · ${planTitle}` : group === 'yours' ? 'Your lifts' : g?.name ?? '';
  const iconFor = (id: string) => (id === 'plan' ? 'today' : id === 'yours' ? 'log' : PICK_GROUPS.find(x => x.id === id)?.icon ?? 'gym');
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: 12, gap: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12171B', borderWidth: 1.5, borderColor: alpha(accent, 0.5), transform: [{ rotate: '-4deg' }] }}>
              <Icon name="gym" size={22} color={accent} tint={0.3} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={22} w={600}>Add exercises</Txt>
              <Txt face="mono" size={9.5} ls={0.14} color={C.muted}>{`${have.length} IN THIS WORKOUT · TAP AGAIN TO REMOVE`}</Txt>
            </View>
            <Tap onPress={onClose} style={{ height: 38, paddingHorizontal: 16, borderRadius: 10, backgroundColor: accent, justifyContent: 'center' }}>
              <Txt size={15} w={600} color={C.ink}>Done</Txt>
            </Tap>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: q ? alpha(accent, 0.6) : C.line3, paddingHorizontal: 14, backgroundColor: '#0D0F13' }}>
            <Icon name="search" size={18} color={C.muted} tint={0} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search 800+ exercises"
              placeholderTextColor={C.dim}
              keyboardAppearance="dark"
              style={{ flex: 1, fontFamily: fontFamily(s.settings.font, 400), fontSize: 16, color: C.text }}
            />
            {q ? (
              <Tap onPress={() => setQ('')}>
                <Icon name="close" size={16} color={C.muted} />
              </Tap>
            ) : null}
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30, gap: 16 }} keyboardShouldPersistTaps="handled">
          {!q.trim() ? (
            <>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {([['plan', 'Today’s plan', planTitle], ['yours', 'Your lifts', yours.length ? `${yours.length} logged` : 'none yet']] as const).map(([id, label, sub]) => (
                  <Tile key={id} icon={iconFor(id)} label={label} sub={sub} acc={accent} hot={group === id} onPress={() => setGroup(id)} />
                ))}
              </View>
              <Heading icon="fist" title="By muscle" acc={accent} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {PICK_GROUPS.map(x => {
                  const on = group === x.id;
                  return (
                    <Tap key={x.id} onPress={() => setGroup(x.id)} style={{ width: '31%', flexGrow: 1 }}>
                      <View style={{ height: 74, borderRadius: 12, borderWidth: 1.5, borderColor: on ? accent : C.line3, backgroundColor: on ? '#12171B' : '#0D0F13', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Icon name={x.icon} size={24} color={on ? accent : C.muted} tint={on ? 0.3 : 0.1} />
                        <Txt size={13} w={600} color={on ? C.text : C.body}>{x.name}</Txt>
                      </View>
                    </Tap>
                  );
                })}
              </View>
            </>
          ) : null}
          <Heading icon={q.trim() ? 'search' : iconFor(group)} title={title} acc={accent} right={`${list.length}`} />
          <View style={{ gap: 8 }}>
            {list.map((name, i) => {
              const added = have.includes(liftKey(name));
              const lib = findExercise(name);
              return (
                <Tap key={`${name}-${i}`} onPress={() => (added ? onRemove(name) : onAdd(name))}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: added ? accent : C.line3, backgroundColor: added ? '#12171B' : '#0D0F13' }}>
                    <Icon name={isBodyweight(name) ? 'fist' : 'gym'} size={22} color={added ? accent : C.body} />
                    <View style={{ flex: 1 }}>
                      <Txt size={15} w={600} color={C.text}>{name}</Txt>
                      {lib ? <Txt face="mono" size={9.5} ls={0.06} color={C.dim}>{[lib.primary.join(', '), lib.equipment].filter(Boolean).join(' · ').toUpperCase()}</Txt> : null}
                    </View>
                    {added ? <Txt face="mono" size={9} ls={0.12} color={accent}>ADDED</Txt> : null}
                    <View style={{ width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: added ? accent : '#14161A', borderWidth: 1.5, borderColor: added ? accent : C.line3 }}>
                      <Icon name={added ? 'check' : 'plus'} size={16} color={added ? C.ink : C.body} tint={0} strokeWidth={2.2} />
                    </View>
                  </View>
                </Tap>
              );
            })}
            {!list.length ? <Txt size={14} color={C.dim}>{group === 'yours' && !q ? 'Lifts you log show up here.' : 'Nothing found. Try another word.'}</Txt> : null}
          </View>
        </ScrollView>
      </View>
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
