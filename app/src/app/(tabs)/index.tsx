import { router } from 'expo-router';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Core } from '../../components/Core';
import { useNow } from '../../components/hooks';
import { Screen } from '../../components/Screen';
import { Bar, Blink, Card, Corners, Jp, Label, Tap, Txt } from '../../components/ui';
import { CLEARED, dayStamp, hero as calcHero, hhmm, integrity as calcIntegrity, nutrition, programWeek, protocol, sessionCountdown, todaysPlan, trajectory, week as calcWeek, weekdayIndex, weekNote } from '@rei/shared';
import { alpha, C } from '../../lib/theme';
import { useStore } from '../../state/store';

export default function Today() {
  const s = useStore();
  const now = useNow();
  const { settings, profile, sessionDone, accent } = s;
  const strong = settings.scenario === 'Strong week';
  const tough = settings.tone === 'Tough love';
  const plan = todaysPlan(now, s.program);
  const nu = nutrition(s.meals, s.activity);
  const wk = calcWeek(s.history, sessionDone, now, s.program);
  const protT = parseFloat(profile.protein) || 0;
  const protLeft = Math.max(0, protT - nu.protein);
  const slipping = !!plan && !sessionDone && wk.missed > 0;
  const hero = calcHero(wk, plan, sessionDone, tough, protLeft, parseFloat(profile.steps) || 0);
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
        why: 'Muscle is built between sessions. Hit protein and get to bed by 23:30 so tomorrow counts.',
        primary: 'Log a meal', onPrimary: () => router.navigate('/fuel'),
        secondary: 'Ask REI', onSecondary: () => ask("What's left today?"),
      }
    : sessionDone && protLeft === 0
      ? {
          time: 'BY 23:30', title: 'Wind down', sub: 'Training done · protein hit',
          why: 'Sleep is where today\u2019s session turns into muscle. Screens off at 23:00, lights out by 23:30.',
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
          time: sessionCountdown(now), title: plan.title, sub: plan.sub,
          why: strong ? plan.why.strong : plan.why.slipping,
          primary: 'Begin session', onPrimary: () => router.push('/session'),
          secondary: 'Reschedule', onSecondary: () => ask("Can I move tonight's workout to tomorrow?"),
        };

  return (
    <Screen>
      {settings.hud ? (
        <View pointerEvents="none" style={{ position: 'absolute', right: -92, top: 260, transform: [{ rotate: '90deg' }] }}>
          <Txt face="jp" size={10} ls={0.5} color="rgba(255,255,255,0.16)">{s.theme.motto}</Txt>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Blink color={s.cloud ? accent : C.warn} />
          <Label color={C.muted}>{s.cloud ? 'REI · ONLINE · SYNCED' : 'REI · DEMO · ON DEVICE'}</Label>
        </View>
        <Tap onPress={() => router.push('/settings')} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)' }}>
          <Txt size={14} w={500}>H</Txt>
        </Tap>
      </View>
      <Label color={C.dim} style={{ marginTop: 6 }}>{`${dayStamp(now)} · WEEK ${programWeek(s.startedOn, now)} · DAY ${weekdayIndex(now) + 1}`}</Label>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 26 }}>
        <View style={{ width: 116, height: 116, alignItems: 'center', justifyContent: 'center' }}>
          <Core size={104} alert={slipping} />
        </View>
        <View style={{ gap: 6 }}>
          <Label>INTEGRITY · 7 DAYS</Label>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
            <Txt size={60} w={300} ls={-0.05}>{integrity}</Txt>
            <Txt size={20} w={300} color={C.dim}>%</Txt>
          </View>
          <Txt size={13} color={C.muted}>{wk.due ? `${wk.done} of ${wk.due} sessions kept` : 'No sessions due yet'}</Txt>
        </View>
      </View>

      <View style={{ marginTop: 30 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Label>{`REI · ${hhmm(now)}`}</Label>
          <View style={{ paddingVertical: 3, paddingHorizontal: 7, borderRadius: 5, borderWidth: 1, borderColor: heroColor }}>
            <Label size={10} ls={0.14} color={heroColor}>{hero.tag}</Label>
          </View>
        </View>
        <Txt size={25} ls={-0.025} lh={1.2} style={{ marginTop: 12 }}>
          {hero.parts.map((p, i) => <Txt key={i} size={25} ls={-0.025} color={p.hl ? heroColor : C.text}>{p.t}</Txt>)}
        </Txt>
        <Tap onPress={() => router.push('/talk')} style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
          <Txt size={14} color={accent}>Answer REI</Txt>
          <Txt face="mono" size={14} color={accent}>→</Txt>
        </Tap>
      </View>

      <View style={{ marginTop: 26, padding: 20, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: C.line3 }}>
        <Corners color={accent} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <Label>NEXT DIRECTIVE</Label>
          <Label ls={0.12} color={accent}>{dir.time}</Label>
        </View>
        <Txt size={34} w={500} ls={-0.035} style={{ marginTop: 14 }}>{dir.title}</Txt>
        <Txt size={14} color={C.sub} style={{ marginTop: 8 }}>{dir.sub}</Txt>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line2 }}>
          <Label ls={0.14} color={C.dim} style={{ paddingTop: 2 }}>WHY</Label>
          <Txt size={14} lh={1.45} color={C.body} style={{ flex: 1 }}>{dir.why}</Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Tap onPress={dir.onPrimary} style={{ flex: 1, height: 52, borderRadius: 26, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', shadowColor: accent, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } }}>
            <Txt size={16} w={600} color={C.ink} ls={-0.01}>{dir.primary}</Txt>
          </Tap>
          <Tap onPress={dir.onSecondary} style={{ height: 52, paddingHorizontal: 20, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={15} color={C.body}>{dir.secondary}</Txt>
          </Tap>
        </View>
      </View>

      <View style={{ marginTop: 34 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label>{"TODAY'S PROTOCOL"}</Label>
          <Label ls={0.14} color={C.muted}>{`${rows.filter(r => CLEARED.includes(r.status)).length} / ${rows.length} CLEARED`}</Label>
        </View>
        <View style={{ marginTop: 10 }}>
          {rows.map(r => (
            <Tap key={r.label} onPress={r.fuel ? () => router.navigate('/fuel') : undefined} style={{ paddingTop: 15, paddingBottom: 14, borderTopWidth: 1, borderTopColor: C.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                  <Txt size={16} w={500} ls={-0.01}>{r.label}</Txt>
                  <Jp>{r.jp}</Jp>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
                  <Txt face="mono" size={13} color={C.value}>{r.value}</Txt>
                  <Label size={10} ls={0.14} color={tone(r.tone)} style={{ minWidth: 62, textAlign: 'right' }}>{r.status}</Label>
                </View>
              </View>
              <View style={{ marginTop: 11 }}>
                <Bar pct={r.pct} color={tone(r.tone)} glow />
              </View>
            </Tap>
          ))}
        </View>
      </View>

      <Card style={{ marginTop: 24, padding: 18, borderRadius: 22, backgroundColor: C.card2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label>{`WEEK ${programWeek(s.startedOn, now)}`}</Label>
          <Label ls={0.12} color={wk.missed ? C.alert : accent}>{`${wk.done} DONE · ${wk.missed} MISSED`}</Label>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
          {wk.days.map((d, i) => {
            const look = {
              done: { mark: '✓', bg: alpha(accent, 0.18), border: alpha(accent, 0.5), fg: accent, label: C.sub },
              missed: { mark: '✕', bg: 'rgba(255,90,60,0.1)', border: 'rgba(255,90,60,0.55)', fg: C.alert, label: C.alert },
              rest: { mark: '·', bg: 'transparent', border: C.line, fg: C.faint, label: C.faint },
              today: { mark: '', bg: 'transparent', border: accent, fg: accent, label: accent },
              future: { mark: '', bg: C.card2, border: C.line3, fg: C.muted, label: C.faint },
              none: { mark: '\u2013', bg: 'transparent', border: C.line, fg: C.ghost, label: C.ghost },
            }[d.status];
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                <Txt face="mono" size={10} color={C.dim}>{d.day}</Txt>
                <View style={{ width: '100%', maxWidth: 40, aspectRatio: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: look.bg, borderWidth: 1, borderColor: look.border, ...(d.status === 'today' ? { shadowColor: accent, shadowOpacity: 0.35, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } } : null) }}>
                  <Txt size={13} w={600} color={look.fg}>{look.mark}</Txt>
                </View>
                <Txt face="mono" size={8.5} ls={0.08} color={look.label}>{d.type}</Txt>
              </View>
            );
          })}
        </View>
        <Txt size={14} lh={1.45} color={C.sub} style={{ marginTop: 16 }}>{weekNote(wk, sessionDone)}</Txt>
      </Card>

      <Tap onPress={() => router.navigate('/vow')} style={{ marginTop: 12, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label>TRAJECTORY</Label>
          <Label ls={0.12} color={traj.etaAlert ? C.alert : accent}>{traj.eta}</Label>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
          <Txt size={34} w={300} ls={-0.04}>{traj.weight.toFixed(1)}</Txt>
          <Txt size={15} color={C.muted}>{`→ ${traj.target.toFixed(1)} kg`}</Txt>
        </View>
        <TrajectoryChart history={traj.history} target={traj.target} color={accent} />
        <Txt size={14} lh={1.45} color={C.sub} style={{ marginTop: 8 }}>{traj.note}</Txt>
      </Tap>
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
