// One lift: estimated max over time, best sets, every session, and how to do it.
import { exerciseById, findExercise, liftHistory, liftKey, parseIsoDate, records } from '@rei/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { StatStrip } from '../components/dojo';
import { ExerciseInfo } from '../components/ExerciseSheet';
import { MoveRow, SectionHeader } from '../components/fight';
import { LineChart } from '../components/LineChart';
import { Screen, SubHeader } from '../components/Screen';
import { Txt } from '../components/ui';
import { F, SP } from '../lib/theme';
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
      <SubHeader title="Lift" onBack={() => router.back()} />
      <View accessibilityRole="header" style={{ marginTop: SP.lg, alignItems: 'flex-start' }}>
        <Txt face="display" size={36} lh={1.15} numberOfLines={3}>{title.toUpperCase()}</Txt>
      </View>

      {rec ? (
        <StatStrip
          style={{ marginTop: SP.lg }}
          items={[
            { k: rec.best.e1rm ? 'Est. max' : 'Best reps', v: rec.best.e1rm ? `${Math.round(rec.best.e1rm)} kg` : `${rec.best.reps}`, hot: true },
            { k: 'Heaviest', v: rec.heaviest ? `${rec.heaviest.kg} × ${rec.heaviest.reps}` : '—' },
            { k: 'Sessions', v: String(rec.sessions) },
          ]}
        />
      ) : (
        <Txt size={14} w={500} lh={1.4} color={F.smoke} style={{ marginTop: SP.md }}>Not logged yet. Tick a set in a workout to log its reps and weight.</Txt>
      )}

      {withMax.length || bodyweight ? (
        <>
          <SectionHeader title={bodyweight ? 'Best set · reps' : 'Est. one-rep max'} style={{ marginTop: SP.xxl }} />
          <View style={{ marginTop: SP.md, padding: SP.lg, backgroundColor: F.canvas, borderWidth: 2, borderColor: F.chalk }}>
            <LineChart
              values={bodyweight ? points.map(p => p.reps) : withMax.map(p => p.e1rm!)}
              labels={(bodyweight ? points : withMax).map(p => short(p.date))}
              color={s.accent}
              unit={bodyweight ? '' : ' kg'}
            />
          </View>
        </>
      ) : null}

      {points.length ? (
        <>
          <SectionHeader title="Sessions" meta={`${points.length}`} style={{ marginTop: SP.xxl }} />
          <View style={{ marginTop: SP.md, gap: SP.xs }}>
            {[...points].reverse().map((p, i) => (
              <MoveRow key={`${p.date}-${i}`} index={short(p.date).toUpperCase()} indexWidth={52} name={p.sets} value={p.e1rm ? `${Math.round(p.e1rm)} KG` : undefined} done />
            ))}
          </View>
        </>
      ) : null}

      {ex ? (
        <>
          <SectionHeader title="How to" style={{ marginTop: SP.xxl, marginBottom: SP.md }} />
          <ExerciseInfo ex={ex} steps={6} />
        </>
      ) : null}
    </Screen>
  );
}
