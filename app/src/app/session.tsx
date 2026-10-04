// A workout: today's planned session, or a free gym session ("mode=free") you build as you go.
// Add exercises (today's plan, your usual lifts, by muscle, or search), tick sets as you finish
// them, hold a set to change reps and weight, rest between sets. Every exercise shows its XP.
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { ExerciseSheet, SetSheet } from '../components/ExerciseSheet';
import { Sheet } from '../components/FoodSheet';
import { Icon } from '../components/icons';
import { Gauge, Panel, Stamp } from '../components/manga';
import { IconButton, Tap, Txt } from '../components/ui';
import {
  clock, defaultSets, e1rm, type Exercise, exerciseXp, findExercise, isBodyweight, lastLifts, type LibExercise, liftKey, pad, PICK_GROUPS,
  records, restSeconds, searchExercises, sessionLine, sessionXp, SESSIONS, type SetLog, todaysPlan,
} from '@rei/shared';
import { alpha, C, fontFamily } from '../lib/theme';
import { useStore } from '../state/store';

interface Rest {
  endsAt: number;
  total: number;
}
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
  // Rest days can still open a session from a link; fall back to push day.
  const plan = useMemo(() => todaysPlan(new Date(), s.program) ?? SESSIONS.PUSH, [s.program]);
  const best = useMemo(() => records(s.sessions), [s.sessions]);
  const last = useMemo(() => lastLifts(s.sessions), [s.sessions]);

  const rowFor = (e: Exercise): Row => ({ reps: [...e.reps], kg: e.reps.map(() => targetKg(e.target)), done: e.reps.map(() => false) });
  const [exercises, setExercises] = useState<Exercise[]>(() => (free ? [] : plan.exercises));
  const [rows, setRows] = useState<Row[]>(() => (free ? [] : plan.exercises.map(rowFor)));
  const [t0] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState<Rest | null>(null);
  const [info, setInfo] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ i: number; j: number } | null>(null);
  const [adding, setAdding] = useState(free);
  const restDone = useRef(false);

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
    const total = restSeconds(reps, kg);
    setRest({ endsAt: Date.now() + total * 1000, total });
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

  const saveSet = (i: number, j: number, reps: number, kg: number | null) => {
    if (!rows[i].done[j]) startRest(reps, kg);
    update(i, r => ({ reps: r.reps.map((v, b) => (b === j ? reps : v)), kg: r.kg.map((v, b) => (b === j ? kg : v)), done: r.done.map((v, b) => (b === j ? true : v)) }));
  };

  const addSet = (i: number) =>
    update(i, r => ({ reps: [...r.reps, r.reps[r.reps.length - 1] ?? 10], kg: [...r.kg, r.kg[r.kg.length - 1] ?? null], done: [...r.done, false] }));
  const dropSet = (i: number) => update(i, r => (r.reps.length > 1 ? { reps: r.reps.slice(0, -1), kg: r.kg.slice(0, -1), done: r.done.slice(0, -1) } : r));
  const removeExercise = (i: number) => {
    setExercises(cur => cur.filter((_, a) => a !== i));
    setRows(cur => cur.filter((_, a) => a !== i));
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
          <Txt face="mono" size={11} ls={0.16} color={C.muted}>{free ? 'GYM WORKOUT' : `TODAY · ${plan.title.toUpperCase()}`}</Txt>
          <Stamp text={`+${xp} XP`} color={xp ? C.warn : C.dim} tilt={0} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18 }}>
          <View>
            <Txt face="mono" size={10} ls={0.14} color={C.muted}>TIME</Txt>
            <Txt face="mono" size={44} ls={-0.04}>{`${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)}`}</Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt face="mono" size={10} ls={0.14} color={C.muted}>SETS DONE</Txt>
            <Txt size={30} w={300}>{done}<Txt size={30} w={300} color={C.dim}>{` / ${total}`}</Txt></Txt>
          </View>
        </View>
        <View style={{ marginTop: 10 }}>
          <Gauge pct={total ? done / total : 0} acc={accent} segments={24} height={6} />
        </View>
        {!free ? <Txt size={13} lh={1.4} color={C.sub} style={{ marginTop: 10 }}>{sessionLine(total ? done / total : 0, plan)}</Txt> : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
        {exercises.length ? (
          <Txt face="mono" size={9.5} ls={0.12} color={C.faint}>TAP ✓ WHEN A SET IS DONE · TAP THE NUMBERS TO CHANGE THEM · TAP A NAME FOR FORM TIPS</Txt>
        ) : null}
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
              <View style={{ flexDirection: 'row', paddingHorizontal: 4, marginTop: 12, marginBottom: 4 }}>
                <Txt face="mono" size={9.5} ls={0.12} color={C.faint} style={{ width: 40 }}>SET</Txt>
                <Txt face="mono" size={9.5} ls={0.12} color={C.faint} style={{ flex: 1 }}>KG</Txt>
                <Txt face="mono" size={9.5} ls={0.12} color={C.faint} style={{ flex: 1 }}>REPS</Txt>
                <View style={{ width: 44 }} />
              </View>
              {r.reps.map((reps, j) => {
                const on = r.done[j], pr = isPr(i, j);
                return (
                  <View key={j} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 8, backgroundColor: on ? '#12171B' : 'transparent' }}>
                    <Txt face="mono" size={13} color={on ? accent : C.dim} style={{ width: 32 }}>{pr ? 'PR' : String(j + 1)}</Txt>
                    <Tap haptic={false} onPress={() => setEditing({ i, j })} style={{ flex: 1, height: 38, borderRadius: 8, borderWidth: 1, borderColor: C.line3, justifyContent: 'center', paddingHorizontal: 10 }}>
                      <Txt face="mono" size={15} color={C.text}>{r.kg[j] != null ? `${r.kg[j]}` : 'BW'}</Txt>
                    </Tap>
                    <Tap haptic={false} onPress={() => setEditing({ i, j })} style={{ flex: 1, height: 38, borderRadius: 8, borderWidth: 1, borderColor: C.line3, justifyContent: 'center', paddingHorizontal: 10 }}>
                      <Txt face="mono" size={15} color={C.text}>{String(reps)}</Txt>
                    </Tap>
                    <Tap haptic={false} onPress={() => toggle(i, j)} style={{ width: 44, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (pr ? C.warn : accent) : '#14161A', borderWidth: 1, borderColor: on ? (pr ? C.warn : accent) : C.line3 }}>
                      <Icon name="check" size={18} color={on ? C.ink : C.muted} tint={0} strokeWidth={2.2} />
                    </Tap>
                  </View>
                );
              })}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Tap onPress={() => addSet(i)} style={{ flex: 1, height: 34, borderRadius: 8, borderWidth: 1, borderColor: C.line3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                  <Icon name="plus" size={14} color={C.body} />
                  <Txt size={13} color={C.body}>Add set</Txt>
                </Tap>
                {r.reps.length > 1 && !r.done[r.done.length - 1] ? (
                  <Tap onPress={() => dropSet(i)} style={{ height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.line3, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt size={13} color={C.muted}>Remove set</Txt>
                  </Tap>
                ) : null}
              </View>
            </Panel>
          );
        })}

        <Tap onPress={() => setAdding(true)} style={{ height: 56, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: alpha(accent, 0.6), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
          <Icon name="plus" size={18} color={accent} />
          <Txt size={15} w={500} color={accent}>{exercises.length ? 'Add exercise' : 'Add your first exercise'}</Txt>
        </Tap>
      </ScrollView>

      {rest ? (
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

      <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20), borderTopWidth: 1, borderTopColor: C.line }}>
        <Tap onPress={complete} disabled={!done} style={{ height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: done ? accent : '#14161A' }}>
          <Icon name="check" size={20} color={done ? C.ink : C.dim} tint={0} strokeWidth={2.2} />
          <Txt size={17} w={600} color={done ? C.ink : C.dim}>{done ? `Finish workout · +${xp} XP` : 'Tick at least one set'}</Txt>
        </Tap>
      </View>

      <AddExercise open={adding} onClose={() => setAdding(false)} onAdd={add} have={exercises.map(e => liftKey(e.name))} planned={plan.exercises.map(e => e.name)} planTitle={plan.title} yours={Object.values(best).sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1)).slice(0, 8).map(r => r.name)} />
      <ExerciseSheet name={info === null ? null : exercises[info]?.name ?? null} onClose={() => setInfo(null)} onSwap={to => info !== null && swap(info, to)} />
      <SetSheet
        edit={editing ? { title: `${exercises[editing.i].name} · set ${editing.j + 1}`, reps: rows[editing.i].reps[editing.j], kg: rows[editing.i].kg[editing.j] } : null}
        onClose={() => setEditing(null)}
        onSave={(reps, kg) => editing && saveSet(editing.i, editing.j, reps, kg)}
      />
    </View>
  );
}

/** Pick exercises: today's plan, the ones you do, by muscle group, or search the whole library. */
function AddExercise({ open, onClose, onAdd, have, planned, planTitle, yours }: { open: boolean; onClose: () => void; onAdd: (name: string) => void; have: string[]; planned: string[]; planTitle: string; yours: string[] }) {
  const s = useStore();
  const { accent } = s;
  const [group, setGroup] = useState<string>(yours.length ? 'yours' : 'plan');
  const [q, setQ] = useState('');
  const list = q.trim()
    ? searchExercises(q, 20).filter(e => e.category !== 'stretching').map(e => e.name)
    : group === 'plan' ? planned : group === 'yours' ? yours : PICK_GROUPS.find(g => g.id === group)?.lifts ?? [];
  const chips: [string, string][] = [...(yours.length ? [['yours', 'Your lifts'] as [string, string]] : []), ['plan', `Today · ${planTitle}`], ...PICK_GROUPS.map(g => [g.id, g.name] as [string, string])];
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt size={22} w={600}>Add exercises</Txt>
          <Tap onPress={onClose} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, backgroundColor: accent }}>
            <Txt size={14} w={600} color={C.ink}>Done</Txt>
          </Tap>
        </View>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search 800+ exercises"
          placeholderTextColor={C.dim}
          keyboardAppearance="dark"
          style={{ height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: C.line3, paddingHorizontal: 14, fontFamily: fontFamily(s.settings.font, 400), fontSize: 16, color: C.text, backgroundColor: '#0D0F13' }}
        />
        {!q.trim() ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {chips.map(([id, label]) => {
              const on = group === id;
              return (
                <Tap key={id} onPress={() => setGroup(id)} style={{ height: 34, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1.5, borderColor: on ? accent : C.line3, backgroundColor: on ? '#12171B' : 'transparent', justifyContent: 'center' }}>
                  <Txt size={13} color={on ? C.text : C.body}>{label}</Txt>
                </Tap>
              );
            })}
          </ScrollView>
        ) : null}
        <View>
          {list.map((name, i) => {
            const added = have.includes(liftKey(name));
            const lib = findExercise(name);
            return (
              <Tap key={`${name}-${i}`} onPress={() => onAdd(name)} disabled={added} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ flex: 1 }}>
                  <Txt size={15} color={added ? C.dim : C.text}>{name}</Txt>
                  {lib ? <Txt face="mono" size={10} color={C.faint}>{[lib.primary.join(', '), lib.equipment].filter(Boolean).join(' · ').toUpperCase()}</Txt> : null}
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: added ? accent : '#14161A', borderWidth: 1, borderColor: added ? accent : C.line3 }}>
                  <Icon name={added ? 'check' : 'plus'} size={16} color={added ? C.ink : C.body} tint={0} strokeWidth={2} />
                </View>
              </Tap>
            );
          })}
          {!list.length ? <Txt size={14} color={C.dim}>Nothing yet. Try a muscle group or search.</Txt> : null}
        </View>
      </View>
    </Sheet>
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
