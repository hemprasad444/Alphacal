import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { Core } from '../components/Core';
import { Bar, IconButton, Label, Tap, Txt } from '../components/ui';
import { pad, sessionLine, SESSIONS, type SetLog, todaysPlan } from '@rei/shared';
import { C } from '../lib/theme';
import { useStore } from '../state/store';

export default function Session() {
  const s = useStore();
  const { accent, settings } = s;
  const insets = useSafeAreaInsets();
  // Rest days can still open a session from a link; fall back to push day.
  const plan = useMemo(() => todaysPlan(new Date(), s.program) ?? SESSIONS.PUSH, [s.program]);
  const [sets, setSets] = useState(() => plan.exercises.map(e => e.reps.map(() => false)));
  // What was actually lifted, editable per set with a long press; starts at the target.
  const [log, setLog] = useState(() => plan.exercises.map(e => ({ reps: [...e.reps], kg: e.reps.map(() => targetKg(e.target)) })));
  const [elapsed, setElapsed] = useState(0);
  const [t0] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(t);
  }, [t0]);

  const flat = sets.flat();
  const done = flat.filter(Boolean).length, total = flat.length, f = done / total;

  const toggle = (i: number, j: number) => {
    Haptics.impactAsync(sets[i][j] ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSets(cur => cur.map((row, a) => (a === i ? row.map((v, b) => (b === j ? !v : v)) : row)));
  };
  const complete = () => {
    if (!done) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const sets_: SetLog[] = plan.exercises.map((e, i) => ({ exercise: e.name, done: sets[i], reps: log[i].reps, kg: log[i].kg }));
    s.finishSession(done, total, elapsed, sets_);
    router.back();
  };

  /** Long press: log the reps and weight actually done for one set (iOS prompt). */
  const edit = (i: number, j: number) => {
    if (Platform.OS !== 'ios') return;
    const cur = log[i];
    const def = `${cur.reps[j]}${cur.kg[j] != null ? ` @ ${cur.kg[j]}` : ''}`;
    Alert.prompt(`${plan.exercises[i].name} · set ${j + 1}`, 'Reps @ kg, e.g. "6 @ 82.5"', value => {
      const m = /^\s*(\d+)\s*(?:[@x×]\s*(\d+(?:\.\d+)?))?/i.exec(value ?? '');
      if (!m) return;
      setLog(all => all.map((x, a) => (a === i ? { reps: x.reps.map((r, b) => (b === j ? +m[1] : r)), kg: x.kg.map((k, b) => (b === j ? (m[2] ? +m[2] : k) : k)) } : x)));
      setSets(all => all.map((row, a) => (a === i ? row.map((v, b) => (b === j ? true : v)) : row)));
    }, 'plain-text', def, 'numbers-and-punctuation');
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
        <Label size={10} ls={0.12} color={C.faint} style={{ marginTop: 6 }}>{Platform.OS === 'ios' ? 'TAP A SET WHEN DONE · HOLD TO LOG REPS AND KG' : 'TAP A SET WHEN DONE'}</Label>
        {plan.exercises.map((ex, i) => (
          <View key={ex.name} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <Txt size={17} w={500} ls={-0.01}>{ex.name}</Txt>
              <Txt face="mono" size={12} color={C.body}>{ex.target}</Txt>
            </View>
            {ex.last ? <Txt face="mono" size={11} color={C.dim} style={{ marginTop: 4 }}>{ex.last}</Txt> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {ex.reps.map((target, j) => {
                const on = sets[i][j];
                const r = log[i].reps[j];
                return (
                  <Tap key={j} haptic={false} onPress={() => toggle(i, j)} onLongPress={() => edit(i, j)} style={{ width: 48, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? accent : C.card, borderWidth: 1, borderColor: on ? accent : 'rgba(255,255,255,0.12)' }}>
                    <Txt face="mono" size={14} color={on ? C.ink : r !== target ? C.warn : C.body}>{on ? (r !== target ? String(r) : '✓') : String(r)}</Txt>
                  </Tap>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20), borderTopWidth: 1, borderTopColor: C.line }}>
        <Tap onPress={complete} disabled={!done} style={{ height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? accent : 'rgba(255,255,255,0.06)' }}>
          <Txt size={17} w={600} color={done ? C.ink : C.dim}>{f === 0 ? 'Log at least one set' : f < 1 ? `Complete session · ${done}/${total}` : 'Complete session'}</Txt>
        </Tap>
      </View>
    </View>
  );
}

/** The working weight in a target like "4 × 6 · 82.5 kg" or "+15 kg"; null for bodyweight. */
function targetKg(target: string): number | null {
  const m = /([+-]?\d+(?:\.\d+)?)\s*kg/i.exec(target);
  return m ? Math.abs(parseFloat(m[1])) : null;
}
