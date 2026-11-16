// Today: a greeting, where you stand, what REI has to say, the day's targets around the ensō,
// the one thing to do next, then the week and the goal behind it.
import { router } from 'expo-router';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { CoachShout, CutButton, Meter, MeterBar, RoundStamp, SectionHeader, useWarn } from '../../components/fight';
import { useNow } from '../../components/hooks';
import { Icon } from '../../components/icons';
import { BrushBar, BrushRule } from '../../components/ink';
import { PageTitle } from '../../components/PageTitle';
import { Screen } from '../../components/Screen';
import { Tap, Txt } from '../../components/ui';
import { CLEARED, dayStamp, ENERGY_WON_AT, daysBetween, minutesUntil, hero as calcHero, integrity as calcIntegrity, nutrition, parseIsoDate, programWeek, protocol, type ProtocolRow, sessionCountdown, todaysPlan, trajectory, week as calcWeek } from '@rei/shared';
import { C, F, RADIUS, soften, SP } from '../../lib/theme';
import { useGame } from '../../state/game';
import { useStore } from '../../state/store';

const CARD = { backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card } as const;

export default function Today() {
  const s = useStore();
  const now = useNow();
  const g = useGame();
  const { settings, profile, sessionDone, accent } = s;
  const strong = settings.scenario === 'Strong week';
  const tough = settings.tone !== 'Coach';
  const plan = todaysPlan(now, s.program);
  const nu = nutrition(s.meals, s.activity);
  const wk = calcWeek(s.history, sessionDone, now, s.program);
  const kcalT = parseFloat(profile.kcal) || 0;
  const protT = parseFloat(profile.protein) || 0;
  const protLeft = Math.max(0, protT - nu.protein);
  const hero = calcHero(wk, plan, sessionDone, tough, protLeft, parseFloat(profile.steps) || 0, { session: profile.sessionTime, bed: profile.bedtime, lateMin: plan && !sessionDone ? -minutesUntil(profile.sessionTime || '18:30', now) : 0 });
  const integrity = calcIntegrity(wk);
  const rows = protocol(plan, nu, profile, sessionDone, s.loggedMin, strong);
  const traj = trajectory(profile, wk.missed, now, s.weighInsOrDemo);
  const warn = useWarn();
  // Red is REI's alone: a target that is behind is said in the watch colour.
  const tone = (t: 'acc' | 'warn' | 'alert') => (t === 'acc' ? accent : warn);

  const ask = (text: string) => {
    router.push('/talk');
    s.send(text);
  };
  const toFuel = () => router.navigate('/fuel');
  const toDojo = () => router.navigate('/dojo');
  const dir = !plan
    ? {
        time: 'All day', title: 'Recover', sub: `Walk · mobility · sleep · ${(parseFloat(profile.steps) || 0).toLocaleString('en-US')} steps`,
        why: `Muscle is built between sessions. Hit protein and be in bed by ${profile.bedtime || '23:00'} so tomorrow counts.`,
        primary: 'Log a meal', meta: protLeft ? `Protein needs ${Math.round(protLeft)} g` : undefined, onPrimary: toFuel,
        secondary: 'Ask REI', onSecondary: () => ask("What's left today?"),
      }
    : sessionDone && protLeft === 0
      ? {
          time: `By ${profile.bedtime || '23:00'}`, title: 'Wind down', sub: 'Training done · protein hit',
          why: `Sleep is where today’s session turns into muscle. Screens off half an hour before ${profile.bedtime || '23:00'}.`,
          primary: 'Log a meal', meta: undefined, onPrimary: toFuel,
          secondary: 'Ask REI', onSecondary: () => ask("What's left today?"),
        }
    : sessionDone
      ? {
          time: 'By 20:30', title: 'Close protein', sub: `${protLeft} g left · one real meal`,
          why: 'Recovery is decided at dinner. 200 g chicken and 250 g Greek yogurt and today is closed.',
          primary: 'Log a meal', meta: `Protein needs ${Math.round(protLeft)} g`, onPrimary: toFuel,
          secondary: 'Ask REI', onSecondary: () => ask("What's left today?"),
        }
      : {
          time: sessionCountdown(now, profile.sessionTime).toLowerCase(), title: plan.title, sub: plan.sub,
          why: strong ? plan.why.strong : plan.why.slipping,
          primary: 'Begin', meta: `${plan.minutes} min · ${plan.exercises.length} lifts`, onPrimary: () => router.push('/session'),
          secondary: 'Reschedule', onSecondary: () => ask("Can I move tonight's workout to tomorrow?"),
        };

  const hour = now.getHours();
  const hello = hour < 5 ? 'Up late' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const cleared = rows.filter(r => CLEARED.includes(r.status)).length;
  const started = parseIsoDate(s.startedOn);
  const day = started ? Math.max(1, daysBetween(started, now) + 1) : 1;
  const missed = wk.missed ? `${wk.missed} missed` : undefined;
  const streak = g.stats.streak;

  // REI's line: the highlighted part is the one that matters, the rest is said plainly around it.
  const hl = hero.parts.findIndex(p => p.hl);
  const before = hero.parts.slice(0, Math.max(0, hl)).map(p => p.t).join('').trim();
  const shout = hl >= 0 ? hero.parts[hl].t.trim() : undefined;
  const after = hero.parts.slice(hl + 1).map(p => p.t).join('').trim();

  const [training, protein, energy, ...rest] = rows;

  return (
    <Screen>
      <PageTitle
        icon="today"
        title={`${hello}${profile.name ? `, ${profile.name}` : ''}.`}
        sub={`Day ${day} · ${soften(dayStamp(now))} · ${s.cloud ? `Week ${programWeek(s.startedOn, now)}` : 'demo'}`}
      />

      {/* Where you stand: streak, rank, XP toward the next rank. */}
      <Tap onPress={toDojo} accessibilityLabel={`${streak} day streak. ${g.rank.name}, ${g.xp.toLocaleString('en-US')} XP${g.next ? `, next rank ${g.next.name}` : ''}. Open Dojo`} style={{ marginTop: SP.md, gap: SP.sm }}>
        <BrushRule long />
        <View style={{ flexDirection: 'row', minHeight: 44 }}>
          <View style={{ flex: 1, justifyContent: 'center', gap: 2 }}>
            <Txt face="heading" size={20} lh={1.2} color={streak ? F.chalk : F.smoke}>{`${streak} ${streak === 1 ? 'day' : 'days'}`}</Txt>
            <Txt face="label" w={400} size={12} color={F.smoke}>Streak</Txt>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', gap: 2, borderLeftWidth: 1, borderLeftColor: F.rope, paddingLeft: SP.lg }}>
            <Txt face="heading" size={20} lh={1.2} fit>{g.rank.name}</Txt>
            <Txt face="label" w={400} size={12} color={F.smoke}>Rank</Txt>
          </View>
          <View style={{ flex: 1.3, justifyContent: 'center', gap: 6, borderLeftWidth: 1, borderLeftColor: F.rope, paddingLeft: SP.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Txt face="num" size={15} lh={1.35}>{`${g.xp.toLocaleString('en-US')} XP`}</Txt>
              {g.next ? <Txt face="mono" size={12} lh={1.35} color={F.smoke}>{`/ ${g.next.min.toLocaleString('en-US')}`}</Txt> : null}
            </View>
            <BrushBar pct={g.next ? g.progress : 1} color={accent} height={8} />
          </View>
        </View>
      </Tap>

      <CoachShout before={before || undefined} shout={shout} after={after || undefined} meta={missed ?? soften(hero.tag)} onPress={() => router.push('/talk')} style={{ marginTop: SP.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 }}>
          <Icon name="voice" size={16} color={F.smoke} tint={0} strokeWidth={1.6} />
          <Txt face="label" size={13} color={F.smoke}>Reply to REI</Txt>
        </View>
      </CoachShout>

      <SectionHeader title="Today" meta={`${cleared} of ${rows.length} kept`} style={{ marginTop: SP.huge }} />
      <Tap onPress={toFuel} accessibilityLabel={`Energy ${energy.value} kcal, ${energy.status.toLowerCase()}. Open Fuel`} style={{ marginTop: SP.lg }}>
        <Meter value={nu.kcal} target={kcalT} unit="kcal" size="lg" past="flag" wonAt={ENERGY_WON_AT} label="Energy" />
      </Tap>
      <View style={{ marginTop: SP.xl, gap: SP.lg }}>
        <Goal row={protein} color={tone(protein.tone)} onPress={toFuel} />
        {rest.map(r => <Goal key={r.label} row={r} color={tone(r.tone)} />)}
      </View>

      <SectionHeader title="Up next" meta={dir.time} style={{ marginTop: SP.huge }} />
      <View style={[CARD, { marginTop: SP.md, paddingHorizontal: SP.lg, paddingTop: 14, paddingBottom: SP.lg, gap: SP.md }]}>
        <Tap onPress={toDojo} accessibilityLabel={`Training: ${training.value}, ${training.status.toLowerCase()}. Open Dojo`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.md, minHeight: 44 }}>
            <View style={{ flex: 1 }}>
              <Txt face="display" exact size={22} lh={1.27} fit>{dir.title}</Txt>
              <Txt face="mono" size={12} lh={1.35} color={accent} numberOfLines={2}>{dir.sub}</Txt>
            </View>
            <RoundStamp label={training.status} size="sm" tone={training.status === 'DONE' ? 'chalk' : 'outline'} />
          </View>
        </Tap>
        <Txt size={14} lh={1.5} color={C.body}>{dir.why}</Txt>
        <CutButton label={dir.primary} meta={dir.meta} size="md" onPress={dir.onPrimary} />
      </View>
      <CutButton label={dir.secondary} tone="quiet" size="md" onPress={dir.onSecondary} style={{ marginTop: SP.sm }} />

      <SectionHeader title="This week" meta="Dojo" onMeta={toDojo} style={{ marginTop: SP.huge }} />
      <Tap onPress={toDojo} accessibilityLabel={`${integrity} percent kept. ${wk.due ? `${wk.done} of ${wk.due} sessions done` : 'No sessions due yet'}. Open Dojo`} style={{ marginTop: SP.md }}>
        <View style={[CARD, { flexDirection: 'row', alignItems: 'center', gap: SP.xl, padding: SP.lg }]}>
          <View style={{ alignItems: 'flex-start' }}>
            <Txt face="display" exact size={34} lh={1.18} color={wk.missed ? F.chalk : accent}>{`${integrity}%`}</Txt>
            <Txt face="label" w={400} size={12} color={F.smoke}>Kept</Txt>
          </View>
          <View style={{ flex: 1, gap: SP.xs }}>
            <Txt size={15} w={600} lh={1.35}>{wk.due ? `${wk.done} of ${wk.due} sessions done` : 'No sessions due yet'}</Txt>
            <Txt size={13} lh={1.5} color={F.smoke}>{wk.missed ? `${wk.missed} missed so far. Every session you keep moves this up.` : 'Every planned session kept. That is how it is done.'}</Txt>
          </View>
        </View>
      </Tap>

      <SectionHeader title="Your goal" meta={traj.eta} style={{ marginTop: SP.huge }} />
      <Tap onPress={() => router.navigate('/vow')} accessibilityLabel={`${traj.weight.toFixed(1)} kilograms now, goal ${traj.target.toFixed(1)}. ${traj.eta}. ${traj.note} Open Vow`} style={{ marginTop: SP.md }}>
        <View style={[CARD, { padding: SP.lg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
            <Txt face="display" exact size={34} lh={1.18}>{traj.weight.toFixed(1)}</Txt>
            <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{`kg now · goal ${traj.target.toFixed(1)} kg`}</Txt>
          </View>
          <TrajectoryChart history={traj.history} target={traj.target} color={accent} />
          <Txt size={14} lh={1.5} color={C.body} style={{ marginTop: SP.sm }}>{traj.note}</Txt>
        </View>
      </Tap>
    </Screen>
  );
}

/** One of the day's targets as a row: its name and where it stands, the numbers in mono, a brush stroke underneath. */
function Goal({ row, color, onPress }: { row: ProtocolRow; color: string; onPress?: () => void }) {
  const [big, target] = row.value.split(' / ');
  const body = (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm, flexShrink: 1 }}>
          <Txt size={14} w={500} lh={1.4}>{soften(row.label)}</Txt>
          <Txt face="label" w={400} size={12} color={color} numberOfLines={1}>{row.status}</Txt>
        </View>
        <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>
          <Txt face="num" size={14} lh={1.2}>{big}</Txt>
          {target ? ` / ${target}` : ''}
        </Txt>
      </View>
      <MeterBar pct={row.pct} height={14} />
    </View>
  );
  const say = `${row.label} ${row.value}, ${row.status.toLowerCase()}`;
  return onPress ? (
    <Tap onPress={onPress} accessibilityLabel={`${say}. Open Fuel`}>{body}</Tap>
  ) : (
    <View accessible accessibilityLabel={say}>{body}</View>
  );
}

function TrajectoryChart({ history, target, color }: { history: number[]; target: number; color: string }) {
  const lo = Math.min(target, ...history) - 0.6, hi = Math.max(...history) + 0.4;
  const y = (v: number) => 64 - ((v - lo) / (hi - lo)) * 60;
  // A single point (no past weigh-ins yet) sits at the right edge.
  const x = (i: number) => (history.length > 1 ? i * (230 / (history.length - 1)) : 230);
  const path = history.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const lx = x(history.length - 1), ly = y(history[history.length - 1]);
  return (
    <Svg viewBox="0 0 320 70" width="100%" height={64} style={{ marginTop: SP.sm, overflow: 'visible' }}>
      <Line x1={0} x2={320} y1={y(target)} y2={y(target)} stroke={F.rule} strokeWidth={1} strokeDasharray="4 5" />
      <Path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <Path d={`M${lx} ${ly} L320 ${y(target)}`} fill="none" stroke={F.smoke} strokeWidth={1} strokeDasharray="3 5" />
      <Circle cx={lx} cy={ly} r={4} fill={F.chalk} />
    </Svg>
  );
}
