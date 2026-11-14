// The Dojo: everything about training in one place. Rank and XP as a meter, today's session as a
// move list, one-tap logging, the week, the weekly ladder, badges as special moves and the training log.
import { clock, dayName, nextPlan, programWeek, RANKS, sessionOrder, todaysPlan } from '@rei/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { BoardPreview } from '../../components/Board';
import { Combo, CutButton, MeterBar, MoveRow, RoundStamp, SectionHeader, SpecialMoveCard } from '../../components/fight';
import { useNow } from '../../components/hooks';
import { Icon } from '../../components/icons';
import { PageTitle } from '../../components/PageTitle';
import { Screen } from '../../components/Screen';
import { Tap, Txt } from '../../components/ui';
import { WeekStrip } from '../../components/WeekStrip';
import { F, HIT, SP } from '../../lib/theme';
import { useGame } from '../../state/game';
import { useStore } from '../../state/store';

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const dateLine = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** "4 × 6 · 82.5 kg" → the loud part ("4 × 6") and the quiet part ("82.5 kg"). */
const splitTarget = (target: string): [string, string | undefined] => {
  const [value, ...rest] = target.split(' · ');
  return [value, rest.length ? rest.join(' · ') : undefined];
};

const LOG: { label: string; sub: string; go: () => void; hot?: boolean }[] = [
  { label: 'Run', sub: 'distance', go: () => router.push({ pathname: '/log-training', params: { kind: 'run' } }) },
  { label: 'Walk', sub: 'distance', go: () => router.push({ pathname: '/log-training', params: { kind: 'walk' } }) },
  { label: 'Ride', sub: 'distance', go: () => router.push({ pathname: '/log-training', params: { kind: 'cycle' } }) },
  { label: 'Sport', sub: 'any activity', go: () => router.push({ pathname: '/log-training', params: { kind: 'sport' } }) },
  { label: 'Gym', sub: 'sets · reps · kg', go: () => router.push({ pathname: '/session', params: { mode: 'free' } }) },
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

      {/* Rank and XP: a meter toward the next rank */}
      <View style={{ marginTop: SP.lg, gap: SP.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SP.md }}>
          <View style={{ flexShrink: 1, alignItems: 'flex-start' }}>
            <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{`RANK ${rankNo} OF ${RANKS.length}`}</Txt>
            <Txt face="display" size={44} lh={1.1} fit>{g.rank.name.toUpperCase()}</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingBottom: 2 }}>
            <Txt face="display" size={32} lh={1.15} color={accent}>{num(g.xp)}</Txt>
            <Txt face="label" w={600} size={14} ls={0.1} color={F.smoke}>XP</Txt>
          </View>
        </View>
        <MeterBar pct={g.progress} accessibilityLabel={g.next ? `${num(g.xp)} of ${num(g.next.min)} XP to ${g.next.name}` : `${num(g.xp)} XP, top rank`} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md }}>
          <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{g.next ? `${num(g.next.min - g.xp)} XP TO RANK UP` : 'TOP RANK'}</Txt>
          <Txt face="label" w={600} size={12} ls={0.12} numberOfLines={1} style={{ flexShrink: 1 }}>{g.next ? `NEXT: ${g.next.name.toUpperCase()} AT ${num(g.next.min)}` : 'MAX RANK'}</Txt>
        </View>
        <Txt size={14} w={500} lh={1.4} color={F.smoke}>{g.rank.line}</Txt>
        <View style={{ flexDirection: 'row', gap: SP.xl, marginTop: SP.xs }}>
          {([[`+${num(g.today)}`, 'XP TODAY', g.today > 0], [num(g.weekXp), 'XP THIS WEEK', false]] as const).map(([v, k, hot]) => (
            <View key={k} accessible accessibilityLabel={`${v} ${k.toLowerCase()}`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Txt face="display" size={22} lh={1.2} color={hot ? accent : F.chalk}>{v}</Txt>
              <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{k}</Txt>
            </View>
          ))}
        </View>
      </View>

      {/* Today's session as a move list */}
      <SectionHeader title={plan ? `Move list · ${plan.title}` : "Today's session"} meta={plan && !s.sessionDone ? `${bell} · ${plan.minutes} min` : undefined} style={{ marginTop: SP.xxl }} />
      <View style={{ marginTop: SP.md, gap: SP.md }}>
        {s.sessionDone ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
              <RoundStamp label="Round won" />
              <Txt face="display" size={24} lh={1.2}>DONE FOR TODAY</Txt>
            </View>
            <Txt size={14} w={500} lh={1.4} color={F.smoke}>{`${s.loggedMin || plan?.minutes || 0} min logged. Eat, then sleep.`}</Txt>
          </>
        ) : plan ? (
          <>
            {plan.sub ? <Txt size={14} w={500} lh={1.4} color={F.smoke}>{plan.sub}</Txt> : null}
            <View style={{ gap: SP.xs }}>
              {plan.exercises.map((e, i) => {
                const [value, detail] = splitTarget(e.target);
                return <MoveRow key={`${i}-${e.name}`} index={i + 1} name={e.name} detail={detail} value={value} />;
              })}
            </View>
            <CutButton label={`Start ${plan.title}`} meta={`Bell at ${bell}`} onPress={() => router.push('/session')} accessibilityLabel={`Begin session: ${plan.title}, ${plan.minutes} minutes`} />
          </>
        ) : (
          <>
            <View style={{ alignItems: 'flex-start', gap: SP.xs }}>
              <Txt face="display" size={28} lh={1.2}>{`${dayName(now)} · REST DAY`.toUpperCase()}</Txt>
              <Txt size={14} w={500} lh={1.4} color={F.smoke}>Walk, stretch, sleep. Played a sport anyway? Log it below.</Txt>
            </View>
            {next ? (
              <MoveRow
                name={`${next.plan.title} · ${next.plan.minutes} min`}
                index={next.day.slice(0, 3).toUpperCase()}
                indexWidth={32}
                onPress={() => router.push('/session')}
                right={<Txt face="label" w={600} size={13} ls={0.1} color={accent}>DO IT TODAY</Txt>}
                style={{ borderLeftWidth: 4, borderLeftColor: F.rope }}
              />
            ) : null}
          </>
        )}
      </View>

      {/* Log anything else */}
      <SectionHeader title="Log training" meta="Outside the plan" style={{ marginTop: SP.xxl }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.xs, marginTop: SP.md }}>
        {LOG.map(x => (
          <Tap key={x.label} onPress={x.go} accessibilityLabel={`Log ${x.label}, ${x.sub}`} style={{ width: '32%', flexGrow: 1, minHeight: 52, backgroundColor: F.canvas, borderLeftWidth: 4, borderLeftColor: x.hot ? accent : F.rope, paddingHorizontal: SP.md, paddingVertical: SP.sm, justifyContent: 'center' }}>
            <Txt size={15} w={600} color={x.hot ? accent : F.chalk} numberOfLines={1}>{x.label}</Txt>
            <Txt face="label" w={400} size={12} ls={0.1} color={F.smoke} numberOfLines={1}>{x.sub.toUpperCase()}</Txt>
          </Tap>
        ))}
      </View>

      <View style={{ marginTop: SP.xxl }}>
        <WeekStrip now={now} />
      </View>

      {/* The weekly board as a ladder */}
      <SectionHeader title={`Week ${week} ladder`} meta="Full ladder" onMeta={() => router.push('/board')} style={{ marginTop: SP.xxl }} />
      <View style={{ marginTop: SP.md }}>
        <BoardPreview you={g.weekXp} />
      </View>

      {/* Badges as special moves */}
      <SectionHeader title="Special moves" meta={`${g.earned.length} of ${total} unlocked`} onMeta={() => router.push('/badges')} style={{ marginTop: SP.xxl }} />
      <Tap onPress={() => router.push('/badges')} accessibilityLabel={`Badges: ${g.earned.length} of ${total} unlocked. See all`} style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.md }}>
        {showcase.map(b => <SpecialMoveCard key={b.id} title={b.title} tier={b.tier} earned={!!b.earned} icon={b.icon} progress={b.progress} style={{ flex: 1 }} />)}
      </Tap>

      {/* What you've logged */}
      <SectionHeader title="Training log" meta={`${s.sessions.length} logged`} onMeta={() => router.push('/history')} style={{ marginTop: SP.xxl }} />
      <View style={{ marginTop: SP.md, gap: SP.xs }}>
        {recent.length ? recent.map((l, i) => (
          <MoveRow
            key={l.id ?? i}
            done
            name={l.title ?? l.plan}
            detail={l.cardio ? `${+l.cardio.km.toFixed(1)} KM · ${clock(l.cardio.seconds)}` : l.activity ? `${Math.round(l.activity.minutes)} MIN` : `${l.done}/${l.total} SETS`}
            onPress={() => router.push('/history')}
          />
        )) : <Txt size={14} w={500} lh={1.4} color={F.smoke}>Nothing logged yet. Your first session is worth 60 XP.</Txt>}
        <Tap onPress={() => router.push('/progress')} style={{ minHeight: HIT, marginTop: SP.sm, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.md, paddingVertical: SP.sm, borderWidth: 2, borderColor: F.rope, backgroundColor: F.canvas }}>
          <Txt size={15} w={600} style={{ flex: 1 }}>Progress report, measurements, photos</Txt>
          <Icon name="chevron" size={18} color={accent} tint={0} strokeWidth={2} />
        </Tap>
      </View>
    </Screen>
  );
}
