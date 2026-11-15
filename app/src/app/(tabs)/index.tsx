// Today: the fight card. You vs. Excuses with the clock to today's bell, the day's meters, REI
// shouting from your corner, the one thing to do next, then the week and the goal behind it.
import { router } from 'expo-router';
import { View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { Combo, CoachShout, CutButton, Meter, MeterBar, RoundStamp, SectionHeader, useWarn, VersusHeader } from '../../components/fight';
import { useNow } from '../../components/hooks';
import { Icon } from '../../components/icons';
import { PageTitle } from '../../components/PageTitle';
import { Screen } from '../../components/Screen';
import { Tap, Txt } from '../../components/ui';
import { CLEARED, dayStamp, ENERGY_WON_AT, daysBetween, minutesUntil, hero as calcHero, integrity as calcIntegrity, nutrition, pad, parseIsoDate, programWeek, protocol, type ProtocolRow, sessionCountdown, todaysPlan, trajectory, week as calcWeek } from '@rei/shared';
import { C, F, SP } from '../../lib/theme';
import { useGame } from '../../state/game';
import { useStore } from '../../state/store';

/** Screen's side padding: the versus poster runs edge to edge through it. */
const GUTTER = 20;

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
  const tone = (t: 'acc' | 'warn' | 'alert') => (t === 'alert' ? C.alert : t === 'warn' ? warn : accent);

  const ask = (text: string) => {
    router.push('/talk');
    s.send(text);
  };
  const toFuel = () => router.navigate('/fuel');
  const toDojo = () => router.navigate('/dojo');
  const dir = !plan
    ? {
        time: 'ALL DAY', title: 'Recover', sub: `Walk · mobility · sleep · ${(parseFloat(profile.steps) || 0).toLocaleString('en-US')} steps`,
        why: `Muscle is built between sessions. Hit protein and be in bed by ${profile.bedtime || '23:00'} so tomorrow counts.`,
        primary: 'Log a meal', meta: protLeft ? `Protein needs ${Math.round(protLeft)} g` : undefined, onPrimary: toFuel,
        secondary: 'Ask REI', onSecondary: () => ask("What's left today?"),
      }
    : sessionDone && protLeft === 0
      ? {
          time: `BY ${profile.bedtime || '23:00'}`, title: 'Wind down', sub: 'Training done · protein hit',
          why: `Sleep is where today’s session turns into muscle. Screens off half an hour before ${profile.bedtime || '23:00'}.`,
          primary: 'Log a meal', meta: undefined, onPrimary: toFuel,
          secondary: 'Ask REI', onSecondary: () => ask("What's left today?"),
        }
    : sessionDone
      ? {
          time: 'BY 20:30', title: 'Close protein', sub: `${protLeft} g left · one real meal`,
          why: 'Recovery is decided at dinner. 200 g chicken and 250 g Greek yogurt and today is closed.',
          primary: 'Log a meal', meta: `Protein needs ${Math.round(protLeft)} g`, onPrimary: toFuel,
          secondary: 'Ask REI', onSecondary: () => ask("What's left today?"),
        }
      : {
          time: sessionCountdown(now, profile.sessionTime), title: plan.title, sub: plan.sub,
          why: strong ? plan.why.strong : plan.why.slipping,
          primary: 'Begin session', meta: `${plan.minutes} min · ${plan.exercises.length} moves`, onPrimary: () => router.push('/session'),
          secondary: 'Reschedule', onSecondary: () => ask("Can I move tonight's workout to tomorrow?"),
        };

  const hour = now.getHours();
  const hello = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const cleared = rows.filter(r => CLEARED.includes(r.status)).length;
  const started = parseIsoDate(s.startedOn);
  const round = started ? Math.max(1, daysBetween(started, now) + 1) : 1;

  // The plate on the slash: the clock to today's bell. A half-typed training time falls back to the default.
  const bell = Number.isNaN(minutesUntil(profile.sessionTime || '18:30', now)) ? '18:30' : profile.sessionTime || '18:30';
  const mins = minutesUntil(bell, now);
  const clock = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const plate = !plan
    ? { big: 'REST', small: 'Recovery day' }
    : sessionDone
      ? { big: 'WON', small: `${plan.title} · done` }
      : mins > 0
        ? { big: clock(mins), small: `To the bell · ${bell}` }
        : mins > -15
          ? { big: 'NOW', small: `The bell · ${bell}` }
          : { big: `+${clock(-mins)}`, small: `Past the bell · ${bell}` };
  const taken = wk.missed ? `${wk.missed} ${wk.missed === 1 ? 'session' : 'sessions'} taken this week` : 'Nothing taken this week';
  const rankLine = `${g.rank.name} · ${g.xp.toLocaleString('en-US')} XP`;

  // REI's call-out: the highlighted part is the shout, the rest is said plainly around it.
  const hl = hero.parts.findIndex(p => p.hl);
  const before = hero.parts.slice(0, Math.max(0, hl)).map(p => p.t).join('').trim();
  const shout = hl >= 0 ? hero.parts[hl].t.trim() : undefined;
  const after = hero.parts.slice(hl + 1).map(p => p.t).join('').trim();

  const [training, protein, energy, ...rest] = rows;

  return (
    <Screen>
      <PageTitle
        title={`Round ${round}`}
        sub={`${dayStamp(now)} · WEEK ${programWeek(s.startedOn, now)}${s.cloud ? '' : ' · DEMO'}`}
        right={
          <Tap onPress={toDojo} accessibilityLabel={`${g.stats.streak} day combo. Open Dojo`} hitSlop={10}>
            <Combo count={g.stats.streak} size="sm" />
          </Tap>
        }
      />
      <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} style={{ marginTop: SP.xs }}>{`${hello}${profile.name ? `, ${profile.name}` : ''}`.toUpperCase()}</Txt>

      <Tap onPress={toDojo} accessibilityLabel={`${profile.name || 'You'} versus Excuses. ${rankLine}. ${taken}. ${plate.big}, ${plate.small}. Open Dojo`} style={{ marginHorizontal: -GUTTER, marginTop: SP.md }}>
        <VersusHeader name={profile.name || 'You'} sub={rankLine} rivalSub={taken} plate={plate} />
      </Tap>

      <SectionHeader title="Today's goals" meta={`${cleared} of ${rows.length} done`} style={{ marginTop: SP.xl }} />
      <Tap onPress={toFuel} accessibilityLabel={`Energy ${energy.value} kcal, ${energy.status.toLowerCase()}. Open Fuel`} style={{ marginTop: SP.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>ENERGY</Txt>
          <Txt face="label" w={600} size={12} ls={0.12} color={tone(energy.tone)}>{energy.status}</Txt>
        </View>
        <Meter value={nu.kcal} target={kcalT} unit="kcal" size="lg" past="flag" wonAt={ENERGY_WON_AT} label="Energy" />
      </Tap>
      <View style={{ flexDirection: 'row', gap: SP.lg, marginTop: SP.lg }}>
        <Goal row={protein} color={tone(protein.tone)} onPress={toFuel} />
        {rest.map(r => <Goal key={r.label} row={r} color={tone(r.tone)} />)}
      </View>
      <Tap onPress={toDojo} accessibilityLabel={`Training: ${training.value}, ${training.status.toLowerCase()}. Open Dojo`} style={{ marginTop: SP.lg }}>
        <View style={{ minHeight: 48, backgroundColor: F.canvas, flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.md, paddingVertical: SP.sm }}>
          {CLEARED.includes(training.status) ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: accent }} /> : null}
          <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>TRAINING</Txt>
          <Txt size={15} w={500} numberOfLines={1} style={{ flex: 1 }}>{training.value}</Txt>
          <RoundStamp label={training.status} size="sm" tone={training.status === 'DONE' ? 'chalk' : 'outline'} />
        </View>
      </Tap>

      <SectionHeader title="REI says" meta={hero.tag} style={{ marginTop: SP.xxl }} />
      <CoachShout before={before || undefined} shout={shout} after={after || undefined} onPress={() => router.push('/talk')} style={{ marginTop: SP.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SP.xs }}>
          <Icon name="voice" size={16} color={F.arena} tint={0} strokeWidth={2} />
          <Txt face="label" w={600} size={13} ls={0.12} color={F.arena}>REPLY TO REI</Txt>
        </View>
      </CoachShout>

      <SectionHeader title="Up next" meta={dir.time} style={{ marginTop: SP.xxl }} />
      <View style={{ marginTop: SP.md, alignItems: 'flex-start' }}>
        <Txt face="display" size={36} lh={1.15} fit>{dir.title.toUpperCase()}</Txt>
        <Txt size={14} w={500} lh={1.4} color={F.smoke} style={{ marginTop: 2 }}>{dir.sub}</Txt>
      </View>
      <View style={{ marginTop: SP.md, backgroundColor: F.canvas, borderLeftWidth: 4, borderLeftColor: F.rope, paddingVertical: SP.md, paddingHorizontal: SP.md, gap: SP.xs }}>
        <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>WHY IT MATTERS</Txt>
        <Txt size={14} lh={1.45} color={C.body}>{dir.why}</Txt>
      </View>
      <CutButton label={dir.primary} meta={dir.meta} onPress={dir.onPrimary} style={{ marginTop: SP.lg }} />
      <CutButton label={dir.secondary} tone="quiet" size="md" onPress={dir.onSecondary} style={{ marginTop: SP.sm }} />

      <SectionHeader title="This week" meta="Dojo" onMeta={toDojo} style={{ marginTop: SP.xxl }} />
      <Tap onPress={toDojo} accessibilityLabel={`${integrity} percent kept. ${wk.due ? `${wk.done} of ${wk.due} sessions done` : 'No sessions due yet'}. Open Dojo`} style={{ marginTop: SP.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.lg, backgroundColor: F.canvas, borderLeftWidth: 4, borderLeftColor: wk.missed ? F.rope : accent, padding: SP.lg }}>
          <View style={{ alignItems: 'flex-start' }}>
            <Txt face="display" size={44} lh={1.1} color={wk.missed ? F.chalk : accent}>{`${integrity}%`}</Txt>
            <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>KEPT</Txt>
          </View>
          <View style={{ flex: 1, gap: SP.xs }}>
            <Txt size={16} w={600}>{wk.due ? `${wk.done} of ${wk.due} sessions done` : 'No sessions due yet'}</Txt>
            <Txt size={13} lh={1.4} color={F.smoke}>{wk.missed ? `${wk.missed} missed so far. Every session you keep pushes this up.` : 'Every planned session kept. That’s how it’s done.'}</Txt>
          </View>
        </View>
      </Tap>

      <SectionHeader title="Your goal" meta={traj.eta} style={{ marginTop: SP.xxl }} />
      <Tap onPress={() => router.navigate('/vow')} accessibilityLabel={`${traj.weight.toFixed(1)} kilograms now, goal ${traj.target.toFixed(1)}. ${traj.eta}. ${traj.note} Open Vow`} style={{ marginTop: SP.md }}>
        <View style={{ backgroundColor: F.canvas, borderLeftWidth: 4, borderLeftColor: traj.etaAlert ? F.rope : accent, padding: SP.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.md }}>
            <Txt face="display" size={40} lh={1.1}>{traj.weight.toFixed(1)}</Txt>
            <Txt face="label" w={600} size={14} ls={0.06} color={F.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{`KG NOW · GOAL ${traj.target.toFixed(1)} KG`}</Txt>
          </View>
          <TrajectoryChart history={traj.history} target={traj.target} color={accent} />
          <Txt size={14} lh={1.45} color={C.body} style={{ marginTop: SP.sm }}>{traj.note}</Txt>
        </View>
      </Tap>
    </Screen>
  );
}

/** One of the day's small meters: label, the number, its target, the bar, where it stands. */
function Goal({ row, color, onPress }: { row: ProtocolRow; color: string; onPress?: () => void }) {
  const [big, target] = row.value.split(' / ');
  const body = (
    <View style={{ gap: SP.xs, alignItems: 'flex-start' }}>
      <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{row.label.toUpperCase()}</Txt>
      <Txt face="display" size={28} lh={1.15} fit>{big}</Txt>
      <Txt face="label" size={14} color={F.smoke} numberOfLines={1}>{target ? `/ ${target}` : ' '}</Txt>
      <MeterBar pct={row.pct} height={8} />
      <Txt face="label" w={600} size={12} ls={0.12} color={color} numberOfLines={1}>{row.status}</Txt>
    </View>
  );
  const say = `${row.label} ${row.value}, ${row.status.toLowerCase()}`;
  return onPress ? (
    <Tap onPress={onPress} accessibilityLabel={`${say}. Open Fuel`} style={{ flex: 1 }}>{body}</Tap>
  ) : (
    <View accessible accessibilityLabel={say} style={{ flex: 1 }}>{body}</View>
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
      <Line x1={0} x2={320} y1={y(target)} y2={y(target)} stroke={F.rope} strokeWidth={2} strokeDasharray="6 5" />
      <Path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="miter" />
      <Path d={`M${lx} ${ly} L320 ${y(target)}`} fill="none" stroke={F.smoke} strokeWidth={1.5} strokeDasharray="4 5" />
      <Rect x={lx - 4} y={ly - 4} width={8} height={8} fill={F.chalk} />
    </Svg>
  );
}
