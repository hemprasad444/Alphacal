// One lift: estimated max over time, best sets, every session, and how to do it.
import { exerciseById, findExercise, liftHistory, liftKey, parseIsoDate, records } from '@rei/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { ExerciseInfo } from '../components/ExerciseSheet';
import { LineChart } from '../components/LineChart';
import { Screen, SubHeader } from '../components/Screen';
import { Card, Label, Txt } from '../components/ui';
import { C } from '../lib/theme';
import { useStore } from '../state/store';

const short = (iso: string) => (parseIsoDate(iso) ?? new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function Lift() {
  const s = useStore();
  const { name = '', id } = useLocalSearchParams<{ name?: string; id?: string }>();
  const ex = useMemo(() => (id ? exerciseById(id) : undefined) ?? findExercise(name), [id, name]);
  const title = name || ex?.name || 'Exercise';
  const points = useMemo(() => liftHistory(s.sessions, title), [s.sessions, title]);
  const rec = records(s.sessions)[liftKey(title)];
  const withMax = points.filter(p => p.e1rm != null);
  const bodyweight = !withMax.length && points.length > 0;

  return (
    <Screen tabs={false}>
      <SubHeader title="LIFT" onBack={() => router.back()} />
      <Txt size={30} w={300} ls={-0.03} style={{ marginTop: 22 }}>{title}</Txt>

      {rec ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
          {[
            [rec.best.e1rm ? `${Math.round(rec.best.e1rm)} kg` : `${rec.best.reps}`, rec.best.e1rm ? 'EST. MAX' : 'BEST REPS'],
            [rec.heaviest ? `${rec.heaviest.kg} × ${rec.heaviest.reps}` : '—', 'HEAVIEST'],
            [String(rec.sessions), 'SESSIONS'],
          ].map(([v, k]) => (
            <Card key={k} style={{ flex: 1, paddingVertical: 14, alignItems: 'center', gap: 6 }}>
              <Txt size={18} w={300}>{v}</Txt>
              <Label size={9} ls={0.12}>{k}</Label>
            </Card>
          ))}
        </View>
      ) : (
        <Txt size={14} color={C.dim} style={{ marginTop: 12 }}>Not logged yet. Hold a set in a session to log its reps and weight.</Txt>
      )}

      {withMax.length || bodyweight ? (
        <Card style={{ marginTop: 14, padding: 16 }}>
          <Label size={10} style={{ marginBottom: 12 }}>{bodyweight ? 'BEST SET · REPS' : 'EST. ONE-REP MAX'}</Label>
          <LineChart
            values={bodyweight ? points.map(p => p.reps) : withMax.map(p => p.e1rm!)}
            labels={(bodyweight ? points : withMax).map(p => short(p.date))}
            color={s.accent}
            unit={bodyweight ? '' : ' kg'}
          />
        </Card>
      ) : null}

      {points.length ? (
        <>
          <Label style={{ marginTop: 26 }}>SESSIONS</Label>
          <View style={{ marginTop: 8 }}>
            {[...points].reverse().map((p, i) => (
              <View key={`${p.date}-${i}`} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line, alignItems: 'baseline' }}>
                <Txt face="mono" size={11} color={C.dim} style={{ width: 54 }}>{short(p.date)}</Txt>
                <Txt face="mono" size={12} color={C.body} style={{ flex: 1 }}>{p.sets}</Txt>
                {p.e1rm ? <Txt face="mono" size={12} color={s.accent}>{`${Math.round(p.e1rm)} kg`}</Txt> : null}
              </View>
            ))}
          </View>
        </>
      ) : null}

      {ex ? (
        <>
          <Label style={{ marginTop: 28, marginBottom: 12 }}>HOW TO</Label>
          <ExerciseInfo ex={ex} steps={6} />
        </>
      ) : null}
    </Screen>
  );
}
