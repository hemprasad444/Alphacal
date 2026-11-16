// The Dojo: everything about training in one place. Rank and XP as a brush stroke, today's
// session and its lifts, one-tap logging, the week, the weekly board, seals and the training log.
import { clock, dayName, nextPlan, programWeek, RANKS, sessionOrder, todaysPlan } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { BoardPreview } from '../../components/Board';
import { Combo, CutButton, MeterBar, MoveRow, RoundStamp, SectionHeader, SpecialMoveCard } from '../../components/fight';
import { HankoSeal } from '../../components/ink';
import { useNow } from '../../components/hooks';
import { Icon } from '../../components/icons';
import { PageTitle } from '../../components/PageTitle';
import { Screen } from '../../components/Screen';
import { Tap, Txt } from '../../components/ui';
import { WeekStrip } from '../../components/WeekStrip';
import { C, F, RADIUS, SP } from '../../lib/theme';
import { useGame } from '../../state/game';
import { useStore } from '../../state/store';

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const dateLine = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** "4 × 6 · 82.5 kg" → the sets ("4 × 6") and the load ("82.5 kg"). */
const splitTarget = (target: string): [string, string | undefined] => {
  const [value, ...rest] = target.split(' · ');
  return [value, rest.length ? rest.join(' · ') : undefined];
};

const LOG: { label: string; sub: string; go: () => void; hot?: boolean }[] = [
  { label: 'Run', sub: 'distance', go: () => router.push({ pathname: '/log-training', params: { kind: 'run' } }) },
  { label: 'Walk', sub: 'distance', go: () => router.push({ pathname: '/log-training', params: { kind: 'walk' } }) },
  { label: 'Ride', sub: 'distance', go: () => router.push({ pathname: '/log-training', params: { kind: 'cycle' } }) },
  { label: 'Sport', sub: 'any activity', go: () => router.push({ pathname: '/log-training', params: { kind: 'sport' } }) },
  { label: 'Gym', sub: 'sets · reps', go: () => router.push({ pathname: '/session', params: { mode: 'free' } }) },
  { label: 'Tell REI', sub: 'just say it', go: () => router.push('/talk'), hot: true },
];

export default function Dojo() {
  const s = useStore();
  const now = useNow();
  const g = useGame();
  const { accent } = s;
  const plan = todaysPlan(now, s.program);
  const next = plan ? null : nextPlan(now, s.program);
  const recent = useMemo(() => [...s.sessions].sort(sessionOrder).reverse().slice(0, 3), [s.sessions]);
  const rankNo = RANKS.findIndex(r => r.id === g.rank.id) + 1;
  const showcase = [...g.earned.slice(0, 3), ...g.locked.slice(0, 5 - Math.min(3, g.earned.length))].slice(0, 5);
  const total = g.earned.length + g.locked.length;
  const bell = s.profile.sessionTime || '18:30';
  const week = programWeek(s.startedOn, now);

  return (
    <Screen>
      <PageTitle icon="train" title="Dojo" sub={`Week ${week} · ${dateLine(now)}`} right={<Combo count={g.stats.streak} size="sm" />} />

      {/* Rank and XP: a brush stroke toward the next rank */}
      <View style={{ marginTop: SP.xl, flexDirection: 'row', alignItems: 'center', gap: SP.lg }}>
        <HankoSeal size={72} shape="round" mark={String(rankNo)} tilt={-6} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.sm }}>
            <View style={{ flexShrink: 1 }}><Txt face="display" exact size={30} lh={1.2} fit>{g.rank.name}</Txt></View>
            <Txt face="num" size={17} lh={1.4} color={accent}>{`${num(g.xp)} XP`}</Txt>
          </View>
          <MeterBar pct={g.progress} height={18} accessibilityLabel={g.next ? `${num(g.xp)} of ${num(g.next.min)} XP to ${g.next.name}` : `${num(g.xp)} XP, top rank`} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md }}>
            <Txt face="label" w={400} size={12} color={F.smoke}>{g.next ? `${num(g.next.min - g.xp)} XP to go` : 'Top rank'}</Txt>
            <Txt face="label" w={400} size={12} color={F.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{g.next ? `${g.next.name} · ${num(g.next.min)}` : `Rank ${rankNo} of ${RANKS.length}`}</Txt>
          </View>
        </View>
      </View>
      <Txt face="voice" size={15} lh={1.5} color={F.smoke} style={{ marginTop: SP.md }}>{g.rank.line}</Txt>
      <View style={{ flexDirection: 'row', gap: SP.xl, marginTop: SP.sm }}>
        {([[`+${num(g.today)}`, 'XP today', g.today > 0], [num(g.weekXp), 'XP this week', false], [`${rankNo} of ${RANKS.length}`, 'rank', false]] as const).map(([v, k, hot]) => (
          <View key={k} accessible accessibilityLabel={`${v} ${k}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Txt face="num" size={15} lh={1.35} color={hot ? accent : F.chalk}>{v}</Txt>
            <Txt face="label" w={400} size={12} color={F.smoke}>{k}</Txt>
          </View>
        ))}
      </View>

      {/* Today's session and its lifts */}
      <SectionHeader title={plan && !s.sessionDone ? 'Up next' : "Today's session"} meta={plan && !s.sessionDone ? `${plan.exercises.length} lifts` : undefined} style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.md }}>
        {s.sessionDone ? (
          <View style={{ backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, padding: SP.lg, gap: SP.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.md }}>
              <Txt face="display" exact size={22} lh={1.27}>Done for today</Txt>
              <RoundStamp label="Kept" />
            </View>
            <Txt size={14} lh={1.5} color={F.smoke}>{`${s.loggedMin || plan?.minutes || 0} min logged. Eat, then sleep.`}</Txt>
          </View>
        ) : plan ? (
          <View style={{ backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, paddingHorizontal: SP.lg, paddingTop: 14, paddingBottom: SP.lg, gap: SP.sm }}>
            <View>
              <Txt face="display" exact size={22} lh={1.27} fit>{plan.title}</Txt>
              <Txt face="mono" size={12} lh={1.35} color={accent}>{`${bell} · ${plan.minutes} min`}</Txt>
            </View>
            {plan.sub ? <Txt size={14} lh={1.5} color={F.smoke}>{plan.sub}</Txt> : null}
            <View>
              {plan.exercises.map((e, i) => {
                const [value, detail] = splitTarget(e.target);
                return (
                  <View key={`${i}-${e.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 36, borderTopWidth: 1, borderTopColor: C.line }}>
                    <Txt size={14} w={500} lh={1.4} numberOfLines={1} style={{ flex: 1 }}>{e.name}</Txt>
                    {detail ? <Txt face="mono" size={12} lh={1.35} color={F.smoke}>{detail}</Txt> : null}
                    <Txt face="num" size={13} lh={1.35} align="right" style={{ minWidth: 44 }}>{value}</Txt>
                  </View>
                );
              })}
            </View>
            <CutButton size="md" label="Begin" meta={`${plan.title} · ${bell}`} onPress={() => router.push('/session')} accessibilityLabel={`Begin session: ${plan.title}, ${plan.minutes} minutes`} style={{ marginTop: SP.xs }} />
          </View>
        ) : (
          <View style={{ gap: SP.sm }}>
            <View style={{ alignItems: 'flex-start', gap: SP.xs }}>
              <Txt face="display" exact size={22} lh={1.27}>{`${dayName(now)} · rest day`}</Txt>
              <Txt size={14} lh={1.5} color={F.smoke}>Walk, stretch, sleep. Played a sport anyway? Log it below.</Txt>
            </View>
            {next ? (
              <MoveRow
                name={`${next.plan.title} · ${next.plan.minutes} min`}
                index={next.day.slice(0, 3)}
                indexWidth={32}
                onPress={() => router.push('/session')}
                right={<Txt face="label" size={13} color={accent}>Do it today</Txt>}
              />
            ) : null}
          </View>
        )}
      </View>

      {/* Log anything else */}
      <SectionHeader title="Log training" meta="Outside the plan" style={{ marginTop: SP.huge }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {LOG.map(x => (
          <Tap key={x.label} onPress={x.go} accessibilityLabel={`Log ${x.label}, ${x.sub}`} style={{ width: '30%', flexGrow: 1, minHeight: 56, backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, paddingHorizontal: SP.md, paddingVertical: SP.sm, justifyContent: 'center' }}>
            <Txt size={15} w={600} lh={1.35} color={x.hot ? accent : F.chalk} numberOfLines={1}>{x.label}</Txt>
            <Txt face="label" w={400} size={12} color={F.smoke} numberOfLines={1}>{x.sub}</Txt>
          </Tap>
        ))}
      </View>

      <View style={{ marginTop: SP.huge }}>
        <WeekStrip now={now} />
      </View>

      {/* The weekly board */}
      <SectionHeader title="This week's board" meta="Full board" onMeta={() => router.push('/board')} style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.md }}>
        <BoardPreview you={g.weekXp} rank={g.rank.name} />
      </View>

      {/* Badges as seals */}
      <SectionHeader title="Seals" meta={`${g.earned.length} of ${total} earned`} onMeta={() => router.push('/badges')} style={{ marginTop: SP.huge }} />
      <Tap onPress={() => router.push('/badges')} accessibilityLabel={`Seals: ${g.earned.length} of ${total} earned. See all`} style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.lg }}>
        {showcase.map(b => <SpecialMoveCard key={b.id} title={b.title} tier={b.tier} earned={!!b.earned} icon={b.icon} progress={b.progress} style={{ flex: 1 }} />)}
      </Tap>

      {/* What you've logged */}
      <SectionHeader title="Training log" meta={`${s.sessions.length} logged`} onMeta={() => router.push('/history')} style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.xs }}>
        {recent.length ? recent.map((l, i) => (
          <MoveRow
            key={l.id ?? i}
            done
            name={l.title ?? l.plan}
            detail={l.cardio ? `${+l.cardio.km.toFixed(1)} km · ${clock(l.cardio.seconds)}` : l.activity ? `${Math.round(l.activity.minutes)} min` : `${l.done}/${l.total} sets`}
            onPress={() => router.push('/history')}
          />
        )) : <Txt size={14} lh={1.5} color={F.smoke} style={{ marginTop: SP.sm }}>Nothing logged yet. Your first session is worth 60 XP.</Txt>}
        <Tap onPress={() => router.push('/progress')} style={{ minHeight: 48, marginTop: SP.lg, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.lg, paddingVertical: SP.sm, borderWidth: 1, borderColor: F.rule, borderRadius: RADIUS.sm, backgroundColor: F.canvas }}>
          <Txt face="heading" size={15} lh={1.35} style={{ flex: 1 }}>Progress, measurements, photos</Txt>
          <Icon name="chevron" size={18} color={accent} tint={0} strokeWidth={1.8} />
        </Tap>
      </View>
    </Screen>
  );
}
