import { router } from 'expo-router';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Core } from '../../components/Core';
import { useNow } from '../../components/hooks';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/icons';
import { Gauge, Heading, Panel, Stamp } from '../../components/manga';
import { Tap, Txt } from '../../components/ui';
import { CLEARED, dayStamp, minutesUntil, hero as calcHero, integrity as calcIntegrity, nutrition, programWeek, protocol, sessionCountdown, todaysPlan, trajectory, week as calcWeek } from '@rei/shared';
import { alpha, C } from '../../lib/theme';
import { useGame } from '../../state/game';
import { useStore } from '../../state/store';

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
  const protT = parseFloat(profile.protein) || 0;
  const protLeft = Math.max(0, protT - nu.protein);
  const slipping = !!plan && !sessionDone && wk.missed > 0;
  const hero = calcHero(wk, plan, sessionDone, tough, protLeft, parseFloat(profile.steps) || 0, { session: profile.sessionTime, bed: profile.bedtime, lateMin: plan && !sessionDone ? -minutesUntil(profile.sessionTime || '18:30', now) : 0 });
  const integrity = calcIntegrity(wk);
  const rows = protocol(plan, nu, profile, sessionDone, s.loggedMin, strong);
  const traj = trajectory(profile, wk.missed, now, s.weighInsOrDemo);
  const tone = (t: 'acc' | 'warn' | 'alert') => (t === 'alert' ? C.alert : t === 'warn' ? C.warn : accent);
  const heroColor = hero.tone === 'alert' ? C.alert : accent;

  const ask = (text: string) => {
    router.push('/talk');
    s.send(text);
  };
  const dir = !plan
    ? {
        time: 'ALL DAY', title: 'Recover', sub: `Walk · mobility · sleep · ${(parseFloat(profile.steps) || 0).toLocaleString('en-US')} steps`,
        why: `Muscle is built between sessions. Hit protein and be in bed by ${profile.bedtime || '23:00'} so tomorrow counts.`,
        primary: 'Log a meal', onPrimary: () => router.navigate('/fuel'),
        secondary: 'Ask REI', onSecondary: () => ask("What's left today?"),
      }
    : sessionDone && protLeft === 0
      ? {
          time: `BY ${profile.bedtime || '23:00'}`, title: 'Wind down', sub: 'Training done · protein hit',
          why: `Sleep is where today\u2019s session turns into muscle. Screens off half an hour before ${profile.bedtime || '23:00'}.`,
          primary: 'Log a meal', onPrimary: () => router.navigate('/fuel'),
          secondary: 'Ask REI', onSecondary: () => ask("What's left today?"),
        }
    : sessionDone
      ? {
          time: 'BY 20:30', title: 'Close protein', sub: `${protLeft} g left · one real meal`,
          why: 'Recovery is decided at dinner. 200 g chicken and 250 g Greek yogurt and today is closed.',
          primary: 'Log a meal', onPrimary: () => router.navigate('/fuel'),
          secondary: 'Ask REI', onSecondary: () => ask("What's left today?"),
        }
      : {
          time: sessionCountdown(now, profile.sessionTime), title: plan.title, sub: plan.sub,
          why: strong ? plan.why.strong : plan.why.slipping,
          primary: 'Begin session', onPrimary: () => router.push('/session'),
          secondary: 'Reschedule', onSecondary: () => ask("Can I move tonight's workout to tomorrow?"),
        };

  const hour = now.getHours();
  const hello = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const cleared = rows.filter(r => CLEARED.includes(r.status)).length;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 6 }}>
        <Core size={54} alert={slipping} />
        <View style={{ flex: 1 }}>
          <Txt size={26} w={600} ls={-0.02} lh={1.1}>{`${hello}${profile.name ? `, ${profile.name}` : ''}`}</Txt>
          <Txt face="mono" size={10} ls={0.14} color={C.muted}>{`${dayStamp(now)} · WEEK ${programWeek(s.startedOn, now)}${s.cloud ? '' : ' · DEMO'}`}</Txt>
        </View>
        <Tap onPress={() => router.push('/settings')} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: alpha(accent, 0.4), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)' }}>
          {profile.name ? <Txt size={15} w={600} color={accent}>{profile.name.trim().charAt(0).toUpperCase()}</Txt> : <Icon name="profile" size={20} color={accent} />}
        </Tap>
      </View>
      <Tap onPress={() => router.navigate('/dojo')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="streak" size={16} color={g.stats.streak >= 3 ? C.warn : C.muted} />
          <Txt size={13} color={C.body}>{`${g.stats.streak}-day streak`}</Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="rank" size={16} color={accent} />
          <Txt size={13} color={C.body}>{`${g.rank.name} · ${g.xp.toLocaleString('en-US')} XP`}</Txt>
        </View>
      </Tap>

      <Heading icon="rei" title="REI says" acc={heroColor} style={{ marginTop: 26 }} />
      <Panel acc={heroColor} style={{ marginTop: 12 }} onPress={() => router.push('/talk')}>
        <Stamp text={hero.tag} color={heroColor} />
        <Txt size={21} ls={-0.02} lh={1.3} style={{ marginTop: 12 }}>
          {hero.parts.map((p, i) => <Txt key={i} size={21} ls={-0.02} color={p.hl ? heroColor : C.text}>{p.t}</Txt>)}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
          <Icon name="voice" size={16} color={accent} />
          <Txt size={14} w={500} color={accent}>Reply to REI</Txt>
        </View>
      </Panel>

      <Heading icon="gym" title="Up next" acc={accent} right={dir.time} style={{ marginTop: 28 }} />
      <Panel acc={accent} tone={0.35} style={{ marginTop: 12 }}>
        <Txt size={28} w={600} ls={-0.03}>{dir.title}</Txt>
        <Txt size={14} color={C.sub} style={{ marginTop: 4 }}>{dir.sub}</Txt>
        <View style={{ marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: '#14161A' }}>
          <Txt face="mono" size={9.5} ls={0.14} color={C.muted}>WHY IT MATTERS</Txt>
          <Txt size={14} lh={1.45} color={C.body} style={{ marginTop: 4 }}>{dir.why}</Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Tap onPress={dir.onPrimary} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={16} w={600} color={C.ink}>{dir.primary}</Txt>
          </Tap>
          <Tap onPress={dir.onSecondary} style={{ height: 50, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1.5, borderColor: C.line3, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={15} color={C.body}>{dir.secondary}</Txt>
          </Tap>
        </View>
      </Panel>

      <Heading icon="check" title="Today's goals" acc={accent} right={`${cleared} OF ${rows.length} DONE`} style={{ marginTop: 28 }} />
      <View style={{ marginTop: 12, gap: 8 }}>
        {rows.map(r => (
          <Tap key={r.label} onPress={r.fuel ? () => router.navigate('/fuel') : r.icon === 'train' ? () => router.navigate('/dojo') : undefined}>
            <View style={{ padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13', gap: 9 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name={r.icon} size={20} color={tone(r.tone)} />
                <Txt size={15} w={600} style={{ flex: 1 }}>{r.label}</Txt>
                <Txt face="mono" size={12} color={C.value}>{r.value}</Txt>
                <Stamp text={r.status} color={tone(r.tone)} tilt={0} size={8.5} />
              </View>
              <Gauge pct={r.pct} acc={tone(r.tone)} segments={24} height={5} />
            </View>
          </Tap>
        ))}
      </View>

      <Heading icon="streak" title="This week" acc={accent} style={{ marginTop: 28 }} />
      <Panel acc={wk.missed ? C.warn : accent} tone={0.25} style={{ marginTop: 12 }} onPress={() => router.navigate('/dojo')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ alignItems: 'center' }}>
            <Txt size={44} w={300} ls={-0.04} lh={1}>{`${integrity}%`}</Txt>
            <Txt face="mono" size={9.5} ls={0.14} color={C.muted}>KEPT</Txt>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt size={16} w={600}>{wk.due ? `${wk.done} of ${wk.due} sessions done` : 'No sessions due yet'}</Txt>
            <Txt size={13} lh={1.4} color={C.sub}>{wk.missed ? `${wk.missed} missed so far. Every session you keep pushes this up.` : 'Every planned session kept. That’s how it’s done.'}</Txt>
          </View>
        </View>
      </Panel>

      <Heading icon="progress" title="Your goal" acc={accent} right={traj.eta} style={{ marginTop: 28 }} />
      <Panel acc={traj.etaAlert ? C.alert : accent} tone={0.25} style={{ marginTop: 12 }} onPress={() => router.navigate('/vow')}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Txt size={34} w={300} ls={-0.04}>{traj.weight.toFixed(1)}</Txt>
          <Txt size={15} color={C.muted}>{`kg now → ${traj.target.toFixed(1)} kg goal`}</Txt>
        </View>
        <TrajectoryChart history={traj.history} target={traj.target} color={accent} />
        <Txt size={14} lh={1.45} color={C.sub} style={{ marginTop: 8 }}>{traj.note}</Txt>
      </Panel>
    </Screen>
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
    <Svg viewBox="0 0 320 70" width="100%" height={64} style={{ marginTop: 6, overflow: 'visible' }}>
      <Line x1={0} x2={320} y1={y(target)} y2={y(target)} stroke="rgba(255,255,255,0.14)" strokeDasharray="2 4" />
      <Path d={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d={`M${lx} ${ly} L320 ${y(target)}`} fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={1.2} strokeDasharray="3 4" />
      <Circle cx={lx} cy={ly} r={3.5} fill={color} />
    </Svg>
  );
}
