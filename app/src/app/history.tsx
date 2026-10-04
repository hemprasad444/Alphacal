// Training log: everything you've trained, newest first, with your records and the XP each earned.
// Logging happens in the Dojo; this page is the history.
import { clock, isoDate, pace, parseIsoDate, prTimeline, records, type SessionLog, sessionOrder, sessionVolume, sessionXp } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Icon, type IconKey } from '../components/icons';
import { Heading, Panel, Stamp } from '../components/manga';
import { ListScreen, SubHeader } from '../components/Screen';
import { Tap, Txt } from '../components/ui';
import { C } from '../lib/theme';
import { useStore } from '../state/store';

const dayLabel = (iso: string) => (parseIsoDate(iso) ?? new Date()).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
const iconOf = (l: SessionLog): IconKey => (l.cardio ? (l.cardio.kind === 'cycle' ? 'ride' : l.cardio.kind === 'walk' ? 'steps' : 'run') : l.activity ? 'sport' : 'gym');

export default function History() {
  const s = useStore();
  const { accent } = s;
  const sorted = useMemo(() => [...s.sessions].sort(sessionOrder), [s.sessions]);
  // Records each session set, judged against the sessions before it, in one pass.
  const prsBy = useMemo(() => new Map([...prTimeline(sorted)].map(([l, prs]) => [l, prs.length])), [sorted]);
  const recs = useMemo(() => Object.values(records(s.sessions)).filter(r => r.best.e1rm != null).sort((a, b) => b.best.e1rm! - a.best.e1rm!).slice(0, 6), [s.sessions]);

  const [monthAgo] = useState(() => isoDate(new Date(Date.now() - 30 * 86400000)));
  const month = sorted.filter(l => l.date >= monthAgo);
  const stats: [IconKey, string, string][] = [
    ['train', String(month.length), 'SESSIONS'],
    ['gym', `${Math.round(month.reduce((a, l) => a + sessionVolume(l), 0) / 1000)} t`, 'LIFTED'],
    ['run', `${+month.reduce((a, l) => a + (l.cardio?.km ?? 0), 0).toFixed(1)} km`, 'COVERED'],
    ['badge', String(month.reduce((a, l) => a + (prsBy.get(l) ?? 0), 0)), 'RECORDS'],
  ];

  const newest = useMemo(() => [...sorted].reverse(), [sorted]);
  const header = (
    <View>
      <SubHeader title="TRAINING LOG" onBack={() => router.back()} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 22 }}>
        {stats.map(([icon, v, k]) => (
          <View key={k} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13', alignItems: 'center', gap: 5 }}>
            <Icon name={icon} size={18} color={accent} />
            <Txt size={17} w={500}>{v}</Txt>
            <Txt face="mono" size={8.5} ls={0.12} color={C.muted}>{k}</Txt>
          </View>
        ))}
      </View>
      <Txt face="mono" size={9.5} ls={0.12} color={C.faint} style={{ marginTop: 8 }}>LAST 30 DAYS · LOG NEW TRAINING FROM THE DOJO</Txt>

      {recs.length ? (
        <>
          <Heading icon="rank" title="Records" acc={accent} right="EST. 1-REP MAX" style={{ marginTop: 28 }} />
          <Panel acc={accent} tone={0.2} dots={false} style={{ marginTop: 12 }} pad={6}>
            {recs.map((r, i) => (
              <Tap key={r.name} onPress={() => router.push({ pathname: '/lift', params: { name: r.name } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <Icon name="gym" size={18} color={C.body} />
                <Txt size={15} style={{ flex: 1 }} numberOfLines={1}>{r.name}</Txt>
                <Txt face="mono" size={11} color={C.dim}>{`${r.best.kg} × ${r.best.reps}`}</Txt>
                <Txt face="mono" size={15} color={accent} style={{ minWidth: 64, textAlign: 'right' }}>{`${Math.round(r.best.e1rm!)} kg`}</Txt>
              </Tap>
            ))}
          </Panel>
        </>
      ) : null}

      <Heading icon="log" title="Sessions" acc={accent} right={`${sorted.length} TOTAL`} style={{ marginTop: 28, marginBottom: 12 }} />
      {!sorted.length ? (
        <View style={{ padding: 18, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line3, alignItems: 'center', gap: 8 }}>
          <Icon name="train" size={30} color={C.faint} />
          <Txt size={14} color={C.dim} align="center">Nothing logged yet. Start a workout or log a run in the Dojo.</Txt>
        </View>
      ) : null}
    </View>
  );

  return <ListScreen header={header} data={newest} keyExtractor={(l, i) => l.id ?? `${l.date}-${i}`} renderItem={({ item }) => <SessionCard l={item} prs={prsBy.get(item) ?? 0} />} />;
}

function SessionCard({ l, prs }: { l: SessionLog; prs: number }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const vol = sessionVolume(l);
  const detail = l.activity
    ? `${Math.round(l.activity.minutes)} MIN${l.activity.kcal ? ` · ~${l.activity.kcal} KCAL` : ''}`
    : l.cardio
      ? `${+l.cardio.km.toFixed(2)} KM · ${clock(l.cardio.seconds)}${l.cardio.kind === 'cycle' ? '' : ` · ${pace(l.cardio.km, l.cardio.seconds).toUpperCase()}`}`
      : `${Math.max(1, Math.round(l.seconds / 60))} MIN · ${l.done}/${l.total} SETS${vol ? ` · ${vol.toLocaleString('en-US')} KG` : ''}`;
  return (
    <Tap haptic={false} onPress={() => setOpen(o => !o)} style={{ marginBottom: 10 }}>
      <View style={{ padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: prs ? C.warn : C.line3, backgroundColor: '#0D0F13', gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name={iconOf(l)} size={22} color={s.accent} />
          <View style={{ flex: 1 }}>
            <Txt size={16} w={600} numberOfLines={1}>{l.title ?? l.plan}</Txt>
            <Txt face="mono" size={10} color={C.dim}>{dayLabel(l.date)}</Txt>
          </View>
          {prs ? <Stamp text={`${prs} PR`} color={C.warn} tilt={0} size={8.5} /> : null}
          <Stamp text={`+${sessionXp(l)} XP`} color={s.accent} tilt={0} size={8.5} />
        </View>
        <Txt face="mono" size={11} color={C.muted}>{detail}</Txt>
        {open && l.sets?.length ? (
          <View style={{ gap: 6, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line }}>
            {l.sets.map((x, i) => {
              const done = x.reps.map((r, j) => (x.done[j] ? (x.kg[j] != null ? `${x.kg[j]}×${r}` : String(r)) : null)).filter(Boolean);
              return done.length ? (
                <Tap key={i} onPress={() => router.push({ pathname: '/lift', params: { name: x.exercise } })} style={{ flexDirection: 'row', gap: 10 }}>
                  <Txt size={13} color={C.body} style={{ flex: 1 }} numberOfLines={1}>{x.exercise}</Txt>
                  <Txt face="mono" size={11} color={s.accent}>{done.join('  ')}</Txt>
                </Tap>
              ) : null;
            })}
          </View>
        ) : null}
      </View>
    </Tap>
  );
}
