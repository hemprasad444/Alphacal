// Training log: every session and run, records per lift, and logging a run by hand.
import { clock, isoDate, pace, parseClock, parseIsoDate, prTimeline, records, type SessionLog, sessionOrder, sessionVolume } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button, Sheet } from '../components/FoodSheet';
import { Screen, SubHeader } from '../components/Screen';
import { Card, Label, Segmented, Tap, Txt } from '../components/ui';
import { C, fontFamily } from '../lib/theme';
import { useStore } from '../state/store';

const dayLabel = (iso: string) => (parseIsoDate(iso) ?? new Date()).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();

export default function History() {
  const s = useStore();
  const [logging, setLogging] = useState(false);
  const sorted = useMemo(() => [...s.sessions].sort(sessionOrder), [s.sessions]);
  // Records each session set, judged against the sessions before it, in one pass.
  const prsBy = useMemo(() => new Map([...prTimeline(sorted)].map(([l, prs]) => [l, prs.length])), [sorted]);
  const recs = useMemo(() => Object.values(records(s.sessions)).filter(r => r.best.e1rm != null).sort((a, b) => b.best.e1rm! - a.best.e1rm!).slice(0, 8), [s.sessions]);

  const [monthAgo] = useState(() => isoDate(new Date(Date.now() - 30 * 86400000)));
  const month = sorted.filter(l => l.date >= monthAgo);
  const stats = [
    ['SESSIONS', String(month.length)],
    ['VOLUME', `${Math.round(month.reduce((a, l) => a + sessionVolume(l), 0) / 1000)} t`],
    ['RUN', `${+month.reduce((a, l) => a + (l.cardio?.km ?? 0), 0).toFixed(1)} km`],
    ['PRS', String(month.reduce((a, l) => a + (prsBy.get(l) ?? 0), 0))],
  ];

  return (
    <Screen tabs={false}>
      <SubHeader title="TRAINING LOG" onBack={() => router.back()} />

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 22 }}>
        {stats.map(([k, v]) => (
          <Card key={k} style={{ flex: 1, paddingVertical: 14, alignItems: 'center', gap: 6 }}>
            <Txt size={20} w={300}>{v}</Txt>
            <Label size={9} ls={0.12}>{k}</Label>
          </Card>
        ))}
      </View>
      <Label size={10} color={C.faint} style={{ marginTop: 8 }}>LAST 30 DAYS</Label>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Button primary onPress={() => setLogging(true)}>Log a run</Button>
        <Button onPress={() => router.push('/exercises')}>Exercise library</Button>
      </View>

      {recs.length ? (
        <>
          <Label style={{ marginTop: 28 }}>RECORDS · EST. ONE-REP MAX</Label>
          <View style={{ marginTop: 8 }}>
            {recs.map(r => (
              <Tap key={r.name} onPress={() => router.push({ pathname: '/lift', params: { name: r.name } })} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.line }}>
                <Txt size={15} style={{ flex: 1 }}>{r.name}</Txt>
                <Txt face="mono" size={11} color={C.dim}>{`${r.best.kg} × ${r.best.reps}`}</Txt>
                <Txt face="mono" size={15} color={s.accent} style={{ minWidth: 64, textAlign: 'right' }}>{`${Math.round(r.best.e1rm!)} kg`}</Txt>
              </Tap>
            ))}
          </View>
        </>
      ) : null}

      <Label style={{ marginTop: 28 }}>SESSIONS</Label>
      <View style={{ marginTop: 8 }}>
        {!sorted.length ? <Txt size={14} color={C.dim} style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line }}>Nothing logged yet. Finish a session or log a run.</Txt> : null}
        {[...sorted].reverse().map((l, i) => <SessionRow key={l.id ?? `${l.date}-${i}`} l={l} prs={prsBy.get(l) ?? 0} />)}
      </View>

      <CardioSheet open={logging} onClose={() => setLogging(false)} />
    </Screen>
  );
}

function SessionRow({ l, prs }: { l: SessionLog; prs: number }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const vol = sessionVolume(l);
  const detail = l.cardio
    ? `${+l.cardio.km.toFixed(2)} km · ${clock(l.cardio.seconds)}${l.cardio.kind === 'cycle' ? '' : ` · ${pace(l.cardio.km, l.cardio.seconds)}`}`
    : `${Math.max(1, Math.round(l.seconds / 60))} min · ${l.done}/${l.total} sets${vol ? ` · ${vol.toLocaleString('en-US')} kg` : ''}`;
  return (
    <Tap haptic={false} onPress={() => setOpen(o => !o)} style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Txt face="mono" size={11} color={C.dim} style={{ width: 92 }}>{dayLabel(l.date)}</Txt>
        <Txt size={16} w={500} style={{ flex: 1 }}>{l.title ?? l.plan}</Txt>
        {prs ? <Txt face="mono" size={11} color={C.warn}>{`${prs} PR`}</Txt> : null}
      </View>
      <Txt face="mono" size={11} color={C.muted} style={{ marginLeft: 102 }}>{detail}</Txt>
      {open && l.sets?.length ? (
        <View style={{ marginLeft: 102, gap: 4, marginTop: 4 }}>
          {l.sets.map((x, i) => {
            const done = x.reps.map((r, j) => (x.done[j] ? (x.kg[j] != null ? `${x.kg[j]}×${r}` : String(r)) : null)).filter(Boolean);
            return done.length ? (
              <Tap key={i} onPress={() => router.push({ pathname: '/lift', params: { name: x.exercise } })}>
                <Txt size={13} color={C.body}>{`${x.exercise}  `}<Txt face="mono" size={11} color={s.accent}>{done.join('  ')}</Txt></Txt>
              </Tap>
            ) : null;
          })}
        </View>
      ) : null}
    </Tap>
  );
}

function CardioSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const [kind, setKind] = useState<'run' | 'walk' | 'cycle'>('run');
  const [km, setKm] = useState('');
  const [time, setTime] = useState('');
  const dist = parseFloat(km.replace(',', '.')), secs = parseClock(time);
  const ok = dist > 0 && dist < 400 && !!secs;
  const input = (value: string, set: (v: string) => void, placeholder: string, label: string) => (
    <View style={{ flex: 1, gap: 6 }}>
      <Label size={10}>{label}</Label>
      <TextInput
        value={value}
        onChangeText={set}
        placeholder={placeholder}
        placeholderTextColor={C.dim}
        keyboardType="numbers-and-punctuation"
        keyboardAppearance="dark"
        style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, fontFamily: fontFamily(s.settings.font, 400), fontSize: 18, color: C.text }}
      />
    </View>
  );
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={{ gap: 18 }}>
        <Txt size={22} w={500}>Log cardio</Txt>
        <Segmented value={kind} options={[['run', 'Run'], ['walk', 'Walk'], ['cycle', 'Ride']]} onChange={setKind} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {input(km, setKm, '5.0', 'DISTANCE, KM')}
          {input(time, setTime, '27:40', 'TIME, MM:SS')}
        </View>
        {ok && kind !== 'cycle' ? <Txt face="mono" size={13} color={s.accent}>{pace(dist, secs!)}</Txt> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button onPress={onClose}>Cancel</Button>
          <Button
            primary
            disabled={!ok}
            onPress={() => {
              s.logCardio(dist, secs!, kind);
              setKm('');
              setTime('');
              onClose();
            }}
          >
            Save
          </Button>
        </View>
      </View>
    </Sheet>
  );
}
