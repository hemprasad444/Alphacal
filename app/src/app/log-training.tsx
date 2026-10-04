// Log training by hand on its own page: a run, walk or ride by distance and time, a sport by minutes,
// or a gym session by name and minutes. Shows the burn and the XP before you save.
import { distanceKcal, type Movement, movementKcal, pace, parseClock, searchMovements, sessionXp } from '@rei/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Icon, type IconKey } from '../components/icons';
import { Panel, Stamp } from '../components/manga';
import { Screen, SubHeader } from '../components/Screen';
import { Tap, Txt } from '../components/ui';
import { alpha, C, fontFamily } from '../lib/theme';
import { useStore } from '../state/store';

type Kind = 'run' | 'walk' | 'cycle' | 'sport';
const KINDS: { id: Kind; icon: IconKey; label: string }[] = [
  { id: 'run', icon: 'run', label: 'Run' },
  { id: 'walk', icon: 'steps', label: 'Walk' },
  { id: 'cycle', icon: 'ride', label: 'Ride' },
  { id: 'sport', icon: 'sport', label: 'Sport' },
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
    if (!ok) return;
    if (distance) s.logCardio(dist, secs!, kind);
    else s.logActivity(sport!, mins);
    setSaved(xp);
    setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/dojo')), 1300);
  };

  const field = (value: string, set: (v: string) => void, placeholder: string, label: string, keyboard: 'decimal-pad' | 'numbers-and-punctuation' | 'default' = 'decimal-pad') => (
    <View style={{ flex: 1, gap: 8 }}>
      <Txt face="mono" size={10} ls={0.14} color={C.muted}>{label}</Txt>
      <TextInput
        value={value}
        onChangeText={set}
        placeholder={placeholder}
        placeholderTextColor={C.ghost}
        keyboardType={keyboard}
        keyboardAppearance="dark"
        style={{ height: 64, borderRadius: 12, borderWidth: 1.5, borderColor: value ? alpha(accent, 0.6) : 'rgba(255,255,255,0.12)', paddingHorizontal: 16, fontFamily: fontFamily(s.settings.font, 300), fontSize: keyboard === 'default' ? 20 : 30, color: C.text, backgroundColor: '#0D0F13' }}
      />
    </View>
  );
  const chips = (values: string[], set: (v: string) => void, unit: string) => (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {values.map(v => (
        <Tap key={v} onPress={() => set(v)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: C.line3, backgroundColor: 'rgba(255,255,255,0.03)' }}>
          <Txt face="mono" size={12} color={C.body}>{`${v} ${unit}`}</Txt>
        </Tap>
      ))}
    </View>
  );

  if (saved !== null) {
    return (
      <Screen tabs={false}>
        <View style={{ height: 560, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <Icon name="check" size={70} color={accent} strokeWidth={2.4} />
          <Txt size={30} w={600}>Logged</Txt>
          <Stamp text={`+${saved} XP`} color={C.warn} size={14} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen tabs={false}>
      <SubHeader title={fixed ? `LOG A ${meta.label.toUpperCase()}` : 'LOG TRAINING'} onBack={() => router.back()} />

      {fixed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22 }}>
          <View style={{ width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12171B', borderWidth: 1.5, borderColor: accent }}>
            <Icon name={meta.icon} size={32} color={accent} tint={0.3} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={24} w={600}>{kind === 'sport' ? 'Sport or activity' : `${meta.label}`}</Txt>
            <Txt size={13} color={C.sub}>{kind === 'sport' ? 'Pick it, then how long.' : 'Distance and time. Pace and burn work themselves out.'}</Txt>
          </View>
        </View>
      ) : (
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 22 }}>
        {KINDS.map(k => {
          const on = kind === k.id;
          return (
            <Tap key={k.id} onPress={() => setKind(k.id)} style={{ flex: 1 }}>
              <View style={{ height: 76, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: on ? accent : C.line3, backgroundColor: on ? alpha(accent, 0.12) : '#0D0F13' }}>
                <Icon name={k.icon} size={26} color={on ? accent : C.muted} tint={on ? 0.3 : 0.12} />
                <Txt size={12} w={500} color={on ? C.text : C.muted}>{k.label}</Txt>
              </View>
            </Tap>
          );
        })}
      </View>
      )}

      <Panel acc={accent} tone={0.35} style={{ marginTop: 22 }}>
        {distance ? (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {field(km, setKm, kind === 'cycle' ? '20' : '5.0', 'DISTANCE · KM')}
              {field(time, setTime, kind === 'cycle' ? '45:00' : '28:30', 'TIME · MM:SS', 'numbers-and-punctuation')}
            </View>
            {chips(kind === 'cycle' ? ['10', '20', '40'] : kind === 'walk' ? ['2', '4', '6'] : ['3', '5', '10'], setKm, 'km')}
          </View>
        ) : (
          sport ? (
            <View style={{ gap: 16 }}>
              <Tap onPress={() => setSport(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="sport" size={22} color={accent} />
                <Txt size={20} w={600} style={{ flex: 1 }}>{sport.name}</Txt>
                <Txt size={13} color={C.dim}>change</Txt>
              </Tap>
              {field(minutes, setMinutes, '60', 'MINUTES')}
              {chips(['30', '45', '60', '90'], setMinutes, 'min')}
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <TextInput
                value={q}
                onChangeText={setQ}
                autoFocus
                placeholder="Football, badminton, yoga, swimming…"
                placeholderTextColor={C.dim}
                keyboardAppearance="dark"
                style={{ height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, fontFamily: fontFamily(s.settings.font, 400), fontSize: 17, color: C.text, marginBottom: 6 }}
              />
              {searchMovements(q, 8).map(m => (
                <Tap key={m.id} onPress={() => setSport(m)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line }}>
                  <Txt size={16}>{m.name}</Txt>
                  <Txt face="mono" size={11} color={C.dim}>{`~${movementKcal(m.met, kg, 60)} KCAL/H`}</Txt>
                </Tap>
              ))}
            </View>
          )
        )}
      </Panel>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        {[
          ['PACE', distance && ok && kind !== 'cycle' ? pace(dist, secs!) : '—'],
          ['BURN', kcal ? `~${kcal} kcal` : '—'],
          ['XP', xp ? `+${xp}` : '—'],
        ].map(([k, v]) => (
          <View key={k} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.line3, alignItems: 'center', gap: 4 }}>
            <Txt size={17} w={500} color={k === 'XP' && xp ? C.warn : C.text}>{v}</Txt>
            <Txt face="mono" size={9.5} ls={0.14} color={C.dim}>{k}</Txt>
          </View>
        ))}
      </View>

      <Tap disabled={!ok} onPress={save} style={{ marginTop: 22, height: 56, borderRadius: 14, backgroundColor: ok ? accent : 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}>
        <Icon name="check" size={20} color={ok ? C.ink : C.dim} tint={0} strokeWidth={2.2} />
        <Txt size={17} w={600} color={ok ? C.ink : C.dim}>{ok ? `Save · +${xp} XP` : 'Fill in the details'}</Txt>
      </Tap>
      <Txt size={12} color={C.faint} style={{ marginTop: 12, textAlign: 'center' }}>Counts as today’s training. Burn estimates come from the Compendium of Physical Activities.</Txt>
    </Screen>
  );
}
