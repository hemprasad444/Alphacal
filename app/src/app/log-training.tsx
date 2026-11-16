// Log training by hand on its own page: a run, walk or ride by distance and time, a sport by minutes,
// or a gym session by name and minutes. Shows the burn and the XP before you save.
import { distanceKcal, type Movement, movementKcal, pace, parseClock, searchMovements, sessionXp } from '@rei/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Field, QuietButton, StatStrip } from '../components/dojo';
import { CutButton, MoveRow, RoundStamp } from '../components/fight';
import { Screen, SubHeader } from '../components/Screen';
import { Segmented, Tap, Txt } from '../components/ui';
import { F, RADIUS, SP } from '../lib/theme';
import { useStore } from '../state/store';

type Kind = 'run' | 'walk' | 'cycle' | 'sport';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'run', label: 'Run' },
  { id: 'walk', label: 'Walk' },
  { id: 'cycle', label: 'Ride' },
  { id: 'sport', label: 'Sport' },
];
const isKind = (k: unknown): k is Kind => KINDS.some(x => x.id === k);

export default function LogTraining() {
  const s = useStore();
  const params = useLocalSearchParams<{ kind?: string }>();
  // Opened for one activity (from the Dojo): just that one. Opened bare: pick one first.
  const fixed = isKind(params.kind);
  const [kind, setKind] = useState<Kind>(isKind(params.kind) ? params.kind : 'run');
  const meta = KINDS.find(k => k.id === kind)!;
  const [km, setKm] = useState('');
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState('');
  const [q, setQ] = useState('');
  const [sport, setSport] = useState<Movement | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const { accent } = s;
  const kg = parseFloat(s.profile.weight) || 0;

  const dist = parseFloat(km.replace(',', '.')), secs = parseClock(time), mins = parseFloat(minutes.replace(',', '.'));
  const distance = kind === 'run' || kind === 'walk' || kind === 'cycle';
  const ok = distance ? dist > 0 && dist < 400 && !!secs : !!sport && mins > 0 && mins < 600;
  const base = { date: s.day, plan: 'LOG', done: 1, total: 1, seconds: 0 };
  const xp = !ok
    ? 0
    : distance
      ? sessionXp({ ...base, cardio: { km: dist, seconds: secs!, kind } })
      : sessionXp({ ...base, activity: { id: sport!.id, name: sport!.name, minutes: mins, kcal: 0 } });
  const kcal = !ok ? 0 : distance ? distanceKcal(kind, dist, secs!, kg) : movementKcal(sport!.met, kg, mins);

  const save = () => {
    // One save per visit: a quick double tap must not log it twice.
    if (!ok || saved !== null) return;
    if (distance) s.logCardio(dist, secs!, kind);
    else s.logActivity(sport!, mins);
    setSaved(xp);
    setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/dojo')), 1300);
  };

  const chips = (values: string[], set: (v: string) => void, unit: string) => (
    <View style={{ flexDirection: 'row', gap: SP.sm, flexWrap: 'wrap' }}>
      {values.map(v => <QuietButton key={v} label={`${v} ${unit}`} onPress={() => set(v)} accessibilityLabel={`Set ${v} ${unit}`} style={{ minWidth: 72 }} />)}
    </View>
  );

  if (saved !== null) {
    return (
      <Screen tabs={false}>
        <View accessibilityLiveRegion="polite" style={{ height: 560, alignItems: 'center', justifyContent: 'center', gap: SP.md }}>
          <RoundStamp label="Done" style={{ alignSelf: 'center' }} />
          <Txt face="display" exact size={34} lh={1.2} align="center">Logged</Txt>
          <Txt size={15} lh={1.45} color={F.smoke} align="center">Saved to your training log.</Txt>
          <Txt face="num" size={17} lh={1.3} color={accent} align="center" style={{ marginTop: SP.xs }}>{`+${saved} XP`}</Txt>
        </View>
      </Screen>
    );
  }

  return (
    <Screen tabs={false}>
      <SubHeader title={fixed ? `Log a ${meta.label.toLowerCase()}` : 'Log training'} onBack={() => router.back()} />

      {fixed ? (
        <View style={{ marginTop: SP.xxl, alignItems: 'flex-start', gap: SP.xs }}>
          <Txt face="display" exact size={28} lh={1.25}>{kind === 'sport' ? 'Sport or activity' : meta.label}</Txt>
          <Txt size={15} lh={1.45} color={F.smoke}>{kind === 'sport' ? 'Pick it, then how long.' : 'Distance and time. Pace and burn work themselves out.'}</Txt>
        </View>
      ) : (
        <View style={{ marginTop: SP.xxl, alignItems: 'flex-start' }}>
          <Segmented value={kind} options={KINDS.map(k => [k.id, k.label] as [Kind, string])} onChange={setKind} />
        </View>
      )}

      <View style={{ marginTop: SP.xxl, gap: SP.lg }}>
        {distance ? (
          <>
            <View style={{ flexDirection: 'row', gap: SP.md }}>
              <Field size="lg" style={{ flex: 1 }} value={km} onChangeText={setKm} placeholder={kind === 'cycle' ? '20' : '5.0'} label="Distance · km" keyboardType="decimal-pad" />
              <Field size="lg" style={{ flex: 1 }} value={time} onChangeText={setTime} placeholder={kind === 'cycle' ? '45:00' : '28:30'} label="Time · mm:ss" keyboardType="numbers-and-punctuation" />
            </View>
            {chips(kind === 'cycle' ? ['10', '20', '40'] : kind === 'walk' ? ['2', '4', '6'] : ['3', '5', '10'], setKm, 'km')}
          </>
        ) : sport ? (
          <>
            <Tap onPress={() => setSport(null)} accessibilityLabel={`${sport.name}. Change`} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: SP.md, backgroundColor: F.canvas, borderWidth: 1, borderColor: F.rule, borderRadius: RADIUS.sm, paddingHorizontal: SP.lg, paddingVertical: SP.sm }}>
              <Txt face="heading" size={17} lh={1.35} style={{ flex: 1 }}>{sport.name}</Txt>
              <Txt face="label" size={13} color={accent}>Change</Txt>
            </Tap>
            <Field size="lg" value={minutes} onChangeText={setMinutes} placeholder="60" label="Minutes" keyboardType="decimal-pad" />
            {chips(['30', '45', '60', '90'], setMinutes, 'min')}
          </>
        ) : (
          <View style={{ gap: SP.sm }}>
            <Field value={q} onChangeText={setQ} autoFocus placeholder="Football, badminton, yoga, swimming…" accessibilityLabel="Search sports and activities" />
            <View>
              {searchMovements(q, 8).map(m => <MoveRow key={m.id} name={m.name} detail={`~${movementKcal(m.met, kg, 60)} kcal/h`} onPress={() => setSport(m)} />)}
            </View>
          </View>
        )}
      </View>

      <StatStrip
        style={{ marginTop: SP.huge }}
        items={[
          { k: 'Pace', v: distance && ok && kind !== 'cycle' ? pace(dist, secs!) : '—' },
          { k: 'Burn', v: kcal ? `~${kcal} kcal` : '—' },
          { k: 'XP', v: xp ? `+${xp}` : '—', hot: !!xp },
        ]}
      />

      <CutButton icon="check" label={ok ? 'Save' : 'Fill in the details'} meta={ok ? `+${xp} XP` : undefined} disabled={!ok} onPress={save} style={{ marginTop: SP.xxl }} />
      <Txt size={13} lh={1.45} color={F.smoke} align="center" style={{ marginTop: SP.md }}>Counts as today’s training. Burn estimates come from the Compendium of Physical Activities.</Txt>
    </Screen>
  );
}
