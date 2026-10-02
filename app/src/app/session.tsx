import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { Core } from '../components/Core';
import { ExerciseSheet, SetSheet } from '../components/ExerciseSheet';
import { Bar, IconButton, Label, Tap, Txt } from '../components/ui';
import { clock, e1rm, type Exercise, lastLifts, type LibExercise, liftKey, pad, records, restSeconds, sessionLine, SESSIONS, type SetLog, todaysPlan } from '@rei/shared';
import { C } from '../lib/theme';
import { useStore } from '../state/store';

interface Rest {
  endsAt: number;
  total: number;
}

export default function Session() {
  const s = useStore();
  const { accent, settings } = s;
  const insets = useSafeAreaInsets();
  // Rest days can still open a session from a link; fall back to push day.
  const plan = useMemo(() => todaysPlan(new Date(), s.program) ?? SESSIONS.PUSH, [s.program]);
  // The exercises can change mid-session when one is swapped.
  const [exercises, setExercises] = useState<Exercise[]>(() => plan.exercises);
  const [sets, setSets] = useState(() => plan.exercises.map(e => e.reps.map(() => false)));
  // What was actually lifted, editable per set with a long press; starts at the target.
  const [log, setLog] = useState(() => plan.exercises.map(e => ({ reps: [...e.reps], kg: e.reps.map(() => targetKg(e.target)) })));
  const [t0] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState<Rest | null>(null);
  const [info, setInfo] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ i: number; j: number } | null>(null);
  const restDone = useRef(false);
  // Personal bests before today, for the PR marks on sets.
  const best = useMemo(() => records(s.sessions), [s.sessions]);
  const last = useMemo(() => lastLifts(s.sessions), [s.sessions]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.floor((now - t0) / 1000);
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (!rest || restLeft > 0 || restDone.current) return;
    restDone.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const t = setTimeout(() => setRest(null), 4000);
    return () => clearTimeout(t);
  }, [rest, restLeft]);

  const startRest = (reps: number, kg: number | null) => {
    restDone.current = false;
    setRest(restFor(reps, kg));
  };

  const flat = sets.flat();
  const done = flat.filter(Boolean).length, total = flat.length, f = total ? done / total : 0;

  const toggle = (i: number, j: number) => {
    const on = !sets[i][j];
    Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSets(cur => cur.map((row, a) => (a === i ? row.map((v, b) => (b === j ? on : v)) : row)));
    if (on) startRest(log[i].reps[j], log[i].kg[j]);
  };

  const saveSet = (i: number, j: number, reps: number, kg: number | null) => {
    setLog(all => all.map((x, a) => (a === i ? { reps: x.reps.map((r, b) => (b === j ? reps : r)), kg: x.kg.map((k, b) => (b === j ? kg : k)) } : x)));
    if (!sets[i][j]) startRest(reps, kg);
    setSets(all => all.map((row, a) => (a === i ? row.map((v, b) => (b === j ? true : v)) : row)));
  };

  const swap = (i: number, to: LibExercise) => {
    const from = exercises[i];
    const prev = best[liftKey(to.name)]?.best;
    setExercises(cur => cur.map((e, a) => (a === i ? { ...e, name: to.name, target: `${e.reps.length} × ${e.reps[0]}${prev?.kg ? ` · ${prev.kg} kg` : ''}`, last: last[liftKey(to.name)] } : e)));
    setSets(cur => cur.map((row, a) => (a === i ? row.map(() => false) : row)));
    setLog(cur => cur.map((x, a) => (a === i ? { reps: [...from.reps], kg: from.reps.map(() => prev?.kg ?? null) } : x)));
  };

  const complete = () => {
    if (!done) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const sets_: SetLog[] = exercises.map((e, i) => ({ exercise: e.name, done: sets[i], reps: log[i].reps, kg: log[i].kg }));
    s.finishSession(done, total, elapsed, sets_, plan.title);
    router.back();
  };

  /** A done set that beats this lift's best estimated max. */
  const isPr = (i: number, j: number) => {
    if (!sets[i][j]) return false;
    const prev = best[liftKey(exercises[i].name)]?.best.e1rm;
    const est = e1rm(log[i].kg[j], log[i].reps[j]);
    return prev != null && est != null && est > prev;
  };

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton size={40} onPress={() => router.back()}>✕</IconButton>
          <Label color={C.muted}>{`SESSION · ${plan.title.toUpperCase()}${settings.hud ? ` · ${plan.jp}` : ''}`}</Label>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 22 }}>
          <Txt face="mono" size={52} ls={-0.04}>{`${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)}`}</Txt>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt size={24} w={300} ls={-0.02}>{done}<Txt size={24} w={300} color={C.dim}>{` / ${total}`}</Txt></Txt>
            <Label size={10}>SETS</Label>
          </View>
        </View>
        <View style={{ marginTop: 14 }}>
          <Bar pct={f} color={accent} glow />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: C.line2 }}>
          <View style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
            <Core size={28} />
          </View>
          <Txt size={14} lh={1.4} color="#D6DAE0" style={{ flex: 1 }}>{sessionLine(f, plan)}</Txt>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 20 }}>
        <Label size={10} ls={0.12} color={C.faint} style={{ marginTop: 6 }}>TAP A SET WHEN DONE · HOLD TO LOG REPS AND KG · TAP A NAME FOR FORM AND SWAPS</Label>
        {exercises.map((ex, i) => (
          <View key={`${i}-${ex.name}`} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <Tap haptic={false} onPress={() => setInfo(i)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <Txt size={17} w={500} ls={-0.01} style={{ flex: 1 }}>{`${ex.name}  `}<Txt size={13} color={C.faint}>ⓘ</Txt></Txt>
              <Txt face="mono" size={12} color={C.body}>{ex.target}</Txt>
            </Tap>
            {ex.last || last[liftKey(ex.name)] ? <Txt face="mono" size={11} color={C.dim} style={{ marginTop: 4 }}>{last[liftKey(ex.name)] ?? ex.last}</Txt> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {ex.reps.map((target, j) => {
                const on = sets[i][j];
                const r = log[i].reps[j], kg = log[i].kg[j];
                const pr = isPr(i, j);
                return (
                  <Tap key={j} haptic={false} onPress={() => toggle(i, j)} onLongPress={() => setEditing({ i, j })} style={{ minWidth: 48, paddingHorizontal: 6, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (pr ? C.warn : accent) : C.card, borderWidth: 1, borderColor: on ? (pr ? C.warn : accent) : 'rgba(255,255,255,0.12)' }}>
                    <Txt face="mono" size={14} color={on ? C.ink : r !== target ? C.warn : C.body}>{on ? (pr ? 'PR' : r !== target ? String(r) : '✓') : String(r)}</Txt>
                    {kg != null && kg !== targetKg(ex.target) ? <Txt face="mono" size={9} color={on ? C.ink : C.dim}>{`${kg}`}</Txt> : null}
                  </Tap>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {rest ? (
        <View style={{ marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: restLeft ? C.line3 : accent, backgroundColor: 'rgba(12,14,18,0.92)', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
              <Label size={10} color={restLeft ? C.muted : accent}>{restLeft ? 'REST' : 'GO'}</Label>
              <Txt face="mono" size={26} color={restLeft ? C.text : accent}>{restLeft ? clock(restLeft) : 'Next set'}</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {restLeft ? (
                <Tap onPress={() => setRest(r => (r ? { ...r, endsAt: r.endsAt + 30000, total: r.total + 30 } : r))} style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', justifyContent: 'center' }}>
                  <Txt face="mono" size={12} color={C.body}>+30</Txt>
                </Tap>
              ) : null}
              <Tap onPress={() => setRest(null)} style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', justifyContent: 'center' }}>
                <Txt face="mono" size={12} color={C.body}>{restLeft ? 'SKIP' : 'OK'}</Txt>
              </Tap>
            </View>
          </View>
          <Bar pct={restLeft / rest.total} color={accent} />
        </View>
      ) : null}

      <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20), borderTopWidth: 1, borderTopColor: C.line }}>
        <Tap onPress={complete} disabled={!done} style={{ height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? accent : 'rgba(255,255,255,0.06)' }}>
          <Txt size={17} w={600} color={done ? C.ink : C.dim}>{f === 0 ? 'Log at least one set' : f < 1 ? `Complete session · ${done}/${total}` : 'Complete session'}</Txt>
        </Tap>
      </View>

      <ExerciseSheet name={info === null ? null : exercises[info]?.name ?? null} onClose={() => setInfo(null)} onSwap={to => info !== null && swap(info, to)} />
      <SetSheet
        edit={editing ? { title: `${exercises[editing.i].name} · set ${editing.j + 1}`, reps: log[editing.i].reps[editing.j], kg: log[editing.i].kg[editing.j] } : null}
        onClose={() => setEditing(null)}
        onSave={(reps, kg) => editing && saveSet(editing.i, editing.j, reps, kg)}
      />
    </View>
  );
}

/** A rest countdown starting now, sized to the set just done. */
function restFor(reps: number, kg: number | null): Rest {
  const total = restSeconds(reps, kg);
  return { endsAt: Date.now() + total * 1000, total };
}

/** The working weight in a target like "4 × 6 · 82.5 kg" or "+15 kg"; null for bodyweight. */
function targetKg(target: string): number | null {
  const m = /([+-]?\d+(?:\.\d+)?)\s*kg/i.exec(target);
  return m ? Math.abs(parseFloat(m[1])) : null;
}
