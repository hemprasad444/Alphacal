// Training log: everything you've trained, newest first, with your records and the XP each earned.
// Logging happens in the Dojo; this page is the history.
import { clock, isoDate, pace, parseIsoDate, prTimeline, records, type SessionLog, sessionOrder, sessionVolume, sessionXp } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { StatStrip } from '../components/dojo';
import { MoveRow, RoundStamp, SectionHeader } from '../components/fight';
import { ListScreen, SubHeader } from '../components/Screen';
import { Tap, Txt } from '../components/ui';
import { F, HIT, SP } from '../lib/theme';
import { useStore } from '../state/store';

const dayLabel = (iso: string) => (parseIsoDate(iso) ?? new Date()).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
const kindOf = (l: SessionLog) => (l.cardio ? (l.cardio.kind === 'cycle' ? 'RIDE' : l.cardio.kind === 'walk' ? 'WALK' : 'RUN') : l.activity ? 'SPORT' : 'GYM');

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
        style={{ marginTop: SP.lg }}
        items={[
          { k: 'Sessions', v: String(month.length) },
          { k: 'Lifted', v: `${Math.round(month.reduce((a, l) => a + sessionVolume(l), 0) / 1000)} t` },
          { k: 'Covered', v: `${+month.reduce((a, l) => a + (l.cardio?.km ?? 0), 0).toFixed(1)} km` },
          { k: 'Records', v: String(prs), hot: prs > 0 },
        ]}
      />
      <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} style={{ marginTop: SP.sm }}>LAST 30 DAYS · LOG NEW TRAINING FROM THE DOJO</Txt>

      {recs.length ? (
        <>
          <SectionHeader title="Records" meta="Est. 1-rep max" style={{ marginTop: SP.xxl }} />
          <View style={{ marginTop: SP.md, gap: SP.xs }}>
            {recs.map((r, i) => (
              <MoveRow key={r.name} index={i + 1} name={r.name} detail={`${r.best.kg} × ${r.best.reps}`} value={`${Math.round(r.best.e1rm!)} KG`} onPress={() => router.push({ pathname: '/lift', params: { name: r.name } })} />
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Sessions" meta={`${sorted.length} total`} style={{ marginTop: SP.xxl, marginBottom: SP.md }} />
      {!sorted.length ? (
        <View style={{ padding: SP.lg, borderWidth: 2, borderColor: F.rope, backgroundColor: F.canvas, alignItems: 'flex-start', gap: SP.xs }}>
          <Txt face="display" size={24} lh={1.2}>NO FIGHTS ON RECORD</Txt>
          <Txt size={14} w={500} lh={1.4} color={F.smoke}>Nothing logged yet. Start a workout or log a run in the Dojo.</Txt>
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
    ? `${Math.round(l.activity.minutes)} MIN${l.activity.kcal ? ` · ~${l.activity.kcal} KCAL` : ''}`
    : l.cardio
      ? `${+l.cardio.km.toFixed(2)} KM · ${clock(l.cardio.seconds)}${l.cardio.kind === 'cycle' ? '' : ` · ${pace(l.cardio.km, l.cardio.seconds).toUpperCase()}`}`
      : `${Math.max(1, Math.round(l.seconds / 60))} MIN · ${l.done}/${l.total} SETS${vol ? ` · ${vol.toLocaleString('en-US')} KG` : ''}`;
  const hasSets = !!l.sets?.length;
  const title = l.title ?? l.plan;
  return (
    <View style={{ marginBottom: SP.sm, backgroundColor: F.canvas, borderLeftWidth: 4, borderLeftColor: prs ? F.gold : F.rope }}>
      <Tap
        haptic={false}
        onPress={() => setOpen(o => !o)}
        accessibilityState={hasSets ? { expanded: open } : undefined}
        accessibilityLabel={`${title}, ${dayLabel(l.date)}. ${detail}. ${sessionXp(l)} XP${prs ? `, ${prs} record${prs > 1 ? 's' : ''}` : ''}`}
        style={{ minHeight: HIT, padding: SP.md, gap: SP.xs }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
          <View style={{ flex: 1 }}>
            <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{`${kindOf(l)} · ${dayLabel(l.date)}`}</Txt>
            <Txt size={17} w={600} lh={1.3} numberOfLines={1}>{title}</Txt>
          </View>
          {prs ? <RoundStamp label={`${prs} PR`} tone="accent" accent={F.gold} size="sm" /> : null}
          <Txt face="display" size={22} lh={1.15} color={accent}>{`+${sessionXp(l)}`}</Txt>
          <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>XP</Txt>
        </View>
        <Txt face="label" w={600} size={13} ls={0.08} color={F.smoke}>{detail}</Txt>
      </Tap>
      {open && hasSets ? (
        <View style={{ paddingHorizontal: SP.md, paddingBottom: SP.sm, borderTopWidth: 2, borderTopColor: F.arena }}>
          {l.sets!.map((x, i) => {
            const done = x.reps.map((r, j) => (x.done[j] ? (x.kg[j] != null ? `${x.kg[j]}×${r}` : String(r)) : null)).filter(Boolean);
            return done.length ? (
              <Tap key={i} onPress={() => router.push({ pathname: '/lift', params: { name: x.exercise } })} accessibilityLabel={`${x.exercise}: ${done.join(', ')}`} accessibilityHint="Opens this lift" style={{ minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
                <Txt size={14} w={500} style={{ flex: 1 }} numberOfLines={1}>{x.exercise}</Txt>
                <Txt face="label" w={600} size={13} ls={0.06} color={accent} align="right" style={{ flexShrink: 1 }}>{done.join('  ')}</Txt>
              </Tap>
            ) : null;
          })}
        </View>
      ) : null}
    </View>
  );
}
