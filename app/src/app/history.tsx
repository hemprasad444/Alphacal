// Training log: everything you've trained, newest first, with your records and the XP each earned.
// Logging happens in the Dojo; this page is the history.
import { clock, isoDate, pace, parseIsoDate, prTimeline, records, type SessionLog, sessionOrder, sessionVolume, sessionXp } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { StatStrip } from '../components/dojo';
import { MoveRow, RoundStamp, SectionHeader, useTierColors } from '../components/fight';
import { ListScreen, SubHeader } from '../components/Screen';
import { Tap, Txt } from '../components/ui';
import { C, F, HIT, RADIUS, SP } from '../lib/theme';
import { useStore } from '../state/store';

const dayLabel = (iso: string) => (parseIsoDate(iso) ?? new Date()).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const kindOf = (l: SessionLog) => (l.cardio ? (l.cardio.kind === 'cycle' ? 'Ride' : l.cardio.kind === 'walk' ? 'Walk' : 'Run') : l.activity ? 'Sport' : 'Gym');

export default function History() {
  const s = useStore();
  const sorted = useMemo(() => [...s.sessions].sort(sessionOrder), [s.sessions]);
  // Records each session set, judged against the sessions before it, in one pass.
  const prsBy = useMemo(() => new Map([...prTimeline(sorted)].map(([l, prs]) => [l, prs.length])), [sorted]);
  const recs = useMemo(() => Object.values(records(s.sessions)).filter(r => r.best.e1rm != null).sort((a, b) => b.best.e1rm! - a.best.e1rm!).slice(0, 6), [s.sessions]);

  const [monthAgo] = useState(() => isoDate(new Date(Date.now() - 30 * 86400000)));
  const month = sorted.filter(l => l.date >= monthAgo);
  const prs = month.reduce((a, l) => a + (prsBy.get(l) ?? 0), 0);

  const newest = useMemo(() => [...sorted].reverse(), [sorted]);
  const header = (
    <View>
      <SubHeader title="Training log" onBack={() => router.back()} />
      <StatStrip
        style={{ marginTop: SP.xxl }}
        items={[
          { k: 'Sessions', v: String(month.length) },
          { k: 'Lifted', v: `${Math.round(month.reduce((a, l) => a + sessionVolume(l), 0) / 1000)} t` },
          { k: 'Covered', v: `${+month.reduce((a, l) => a + (l.cardio?.km ?? 0), 0).toFixed(1)} km` },
          { k: 'Records', v: String(prs), hot: prs > 0 },
        ]}
      />
      <Txt face="mono" size={12} lh={1.4} color={F.smoke} style={{ marginTop: SP.md }}>Last 30 days · log new training from the Dojo</Txt>

      {recs.length ? (
        <>
          <SectionHeader title="Records" meta="Est. 1-rep max" style={{ marginTop: SP.huge }} />
          <View style={{ marginTop: SP.xs }}>
            {recs.map((r, i) => (
              <MoveRow key={r.name} index={i + 1} name={r.name} detail={`${r.best.kg} × ${r.best.reps}`} value={`${Math.round(r.best.e1rm!)} kg`} onPress={() => router.push({ pathname: '/lift', params: { name: r.name } })} />
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Sessions" meta={`${sorted.length} total`} style={{ marginTop: SP.huge, marginBottom: SP.md }} />
      {!sorted.length ? (
        <View style={{ padding: SP.lg, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, backgroundColor: F.canvas, alignItems: 'flex-start', gap: SP.xs }}>
          <Txt face="heading" size={17} lh={1.4}>Nothing logged yet</Txt>
          <Txt size={15} lh={1.45} color={F.smoke}>Start a workout or log a run in the Dojo.</Txt>
        </View>
      ) : null}
    </View>
  );

  return <ListScreen header={header} data={newest} keyExtractor={(l, i) => l.id ?? `${l.date}-${i}`} renderItem={({ item }) => <SessionCard l={item} prs={prsBy.get(item) ?? 0} />} />;
}

function SessionCard({ l, prs }: { l: SessionLog; prs: number }) {
  const accent = useStore(s => s.accent);
  const [open, setOpen] = useState(false);
  const vol = sessionVolume(l);
  const detail = l.activity
    ? `${Math.round(l.activity.minutes)} min${l.activity.kcal ? ` · ~${l.activity.kcal} kcal` : ''}`
    : l.cardio
      ? `${+l.cardio.km.toFixed(2)} km · ${clock(l.cardio.seconds)}${l.cardio.kind === 'cycle' ? '' : ` · ${pace(l.cardio.km, l.cardio.seconds)}`}`
      : `${Math.max(1, Math.round(l.seconds / 60))} min · ${l.done}/${l.total} sets${vol ? ` · ${vol.toLocaleString('en-US')} kg` : ''}`;
  const hasSets = !!l.sets?.length;
  const title = l.title ?? l.plan;
  const gold = useTierColors().gold;
  return (
    <View style={{ marginBottom: SP.sm, backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card }}>
      <Tap
        haptic={false}
        onPress={() => setOpen(o => !o)}
        accessibilityState={hasSets ? { expanded: open } : undefined}
        accessibilityLabel={`${title}, ${dayLabel(l.date)}. ${detail}. ${sessionXp(l)} XP${prs ? `, ${prs} record${prs > 1 ? 's' : ''}` : ''}`}
        style={{ minHeight: HIT, paddingVertical: SP.md, paddingHorizontal: SP.lg, gap: SP.xs }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{`${kindOf(l)} · ${dayLabel(l.date)}`}</Txt>
            <Txt face="heading" size={17} lh={1.35} numberOfLines={1}>{title}</Txt>
          </View>
          {prs ? <RoundStamp label={`${prs} PR`} tone="accent" accent={gold} size="sm" style={{ alignSelf: 'center' }} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.xs }}>
            <Txt face="num" size={17} lh={1.3} color={accent}>{`+${sessionXp(l)}`}</Txt>
            <Txt face="mono" size={12} color={F.smoke}>XP</Txt>
          </View>
        </View>
        <Txt face="mono" size={12} lh={1.4} color={F.smoke}>{detail}</Txt>
      </Tap>
      {open && hasSets ? (
        <View style={{ paddingHorizontal: SP.lg, paddingBottom: SP.sm, borderTopWidth: 1, borderTopColor: C.line }}>
          {l.sets!.map((x, i) => {
            const done = x.reps.map((r, j) => (x.done[j] ? (x.kg[j] != null ? `${x.kg[j]}×${r}` : String(r)) : null)).filter(Boolean);
            return done.length ? (
              <Tap key={i} onPress={() => router.push({ pathname: '/lift', params: { name: x.exercise } })} accessibilityLabel={`${x.exercise}: ${done.join(', ')}`} accessibilityHint="Opens this lift" style={{ minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
                <Txt size={15} w={500} lh={1.35} style={{ flex: 1 }} numberOfLines={1}>{x.exercise}</Txt>
                <Txt face="mono" size={12} lh={1.4} color={accent} align="right" style={{ flexShrink: 1 }}>{done.join('  ')}</Txt>
              </Tap>
            ) : null;
          })}
        </View>
      ) : null}
    </View>
  );
}
