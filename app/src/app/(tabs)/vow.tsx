// The Vow: the goal you made REI hold you to, the deadline, your body and targets, your routine,
// and this week's plan. Everything here is editable; REI uses exactly what's written.
import { benchmarks, DEFAULT_BESTS, isoDate, parseIsoDate, type ProfileKey, SESSION_ICON, SESSIONS, trajectory, week, WEEK_PLAN, weekdayIndex } from '@rei/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { Icon, type IconKey } from '../../components/icons';
import { Gauge, Heading, Panel, Stamp } from '../../components/manga';
import { PageTitle } from '../../components/PageTitle';
import { Screen } from '../../components/Screen';
import { Tap, Txt } from '../../components/ui';
import { alpha, C, fontFamily } from '../../lib/theme';
import { useStore } from '../../state/store';

const BODY: [string, ProfileKey, string, IconKey][] = [
  ['Weight', 'weight', 'kg', 'weight'], ['Target', 'targetWeight', 'kg', 'progress'],
  ['Body fat', 'bf', '%', 'fat'], ['Target BF', 'targetBf', '%', 'rank'],
  ['Height', 'height', 'cm', 'steps'], ['Age', 'age', 'yrs', 'today'],
];
const TARGETS: [string, ProfileKey, string, IconKey][] = [
  ['Calories', 'kcal', 'kcal', 'kcal'], ['Protein', 'protein', 'g', 'protein'], ['Carbs', 'carbs', 'g', 'carbs'], ['Fat', 'fat', 'g', 'fat'],
  ['Steps', 'steps', 'steps', 'steps'], ['Sleep', 'sleep', 'h', 'sleep'], ['Sessions', 'sessions', '/ wk', 'train'],
];
const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Vow() {
  const s = useStore();
  const { profile, settings, accent } = s;
  const traj = trajectory(profile, week(s.history, s.sessionDone, new Date(), s.program).missed, new Date(), s.weighInsOrDemo);
  const deadline = parseIsoDate(profile.deadline) ?? new Date();
  const start = s.weighInsOrDemo?.[0]?.kg ?? traj.history[0] ?? traj.weight;
  const done = start === traj.target ? 1 : Math.max(0, Math.min(1, (start - traj.weight) / (start - traj.target)));

  const shift = (days: number) => {
    const d = new Date(deadline);
    d.setDate(d.getDate() + days);
    const soonest = new Date();
    soonest.setDate(soonest.getDate() + 7);
    if (d < soonest) return;
    s.setProfileField('deadline', isoDate(d));
  };

  const field = (k: ProfileKey, size: number, color: string, align: 'left' | 'right' = 'left', keyboard: 'decimal-pad' | 'numbers-and-punctuation' = 'decimal-pad') => (
    <TextInput
      value={profile[k]}
      onChangeText={v => s.setProfileField(k, v)}
      keyboardType={keyboard}
      keyboardAppearance="dark"
      selectTextOnFocus
      style={{ flex: 1, padding: 0, textAlign: align, fontFamily: fontFamily(settings.font, 300), fontSize: size * settings.textSize, color }}
    />
  );

  return (
    <Screen>
      <PageTitle icon="vow" title="The Vow" sub="Your goal · your rules" />

      <Panel acc={accent} style={{ marginTop: 22 }} pad={20}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stamp text="Sworn to REI" color={accent} />
          <Tap onPress={() => router.push({ pathname: '/talk', params: { draft: 'Change my goal: ' } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="rei" size={16} color={accent} />
            <Txt size={13} color={accent}>Rewrite with REI</Txt>
          </Tap>
        </View>
        <TextInput
          value={profile.goal}
          onChangeText={v => s.setProfileField('goal', v)}
          multiline
          scrollEnabled={false}
          keyboardAppearance="dark"
          placeholder="What are you going to become?"
          placeholderTextColor={C.dim}
          style={{ marginTop: 14, padding: 0, fontFamily: fontFamily(settings.font, 500), fontSize: 24 * settings.textSize, lineHeight: 24 * 1.25 * settings.textSize, letterSpacing: -0.02 * 24, color: C.text }}
        />
        <Txt size={12} color={C.dim} style={{ marginTop: 8 }}>Tap to edit. REI holds you to exactly these words.</Txt>
      </Panel>

      <Panel acc={traj.etaAlert ? C.alert : accent} tone={0.35} style={{ marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ alignItems: 'center', width: 96 }}>
            <Txt size={52} w={300} ls={-0.04} lh={1}>{traj.daysLeft}</Txt>
            <Txt face="mono" size={10} ls={0.14} color={C.muted}>DAYS LEFT</Txt>
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Txt face="mono" size={10} ls={0.14} color={C.muted}>DEADLINE</Txt>
            <Txt size={18} w={600}>{fmtDate(deadline)}</Txt>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {([['−1 wk', -7], ['+1 wk', 7], ['+1 mo', 30]] as const).map(([l, d]) => (
                <Tap key={l} onPress={() => shift(d)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: C.line3, backgroundColor: '#14161A' }}>
                  <Txt face="mono" size={11} color={C.body}>{l}</Txt>
                </Tap>
              ))}
            </View>
          </View>
        </View>
        <View style={{ marginTop: 18, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt face="mono" size={11} color={C.body}>{`${traj.weight.toFixed(1)} → ${traj.target.toFixed(1)} KG`}</Txt>
            <Txt face="mono" size={11} color={traj.behind ? C.alert : accent}>{`NEED ${traj.reqPace.toFixed(2)} KG / WK`}</Txt>
          </View>
          <Gauge pct={done} acc={traj.behind ? C.warn : accent} />
          <Txt size={13} lh={1.4} color={C.sub}>{traj.note}</Txt>
        </View>
      </Panel>

      <Heading icon="weight" title="Body" acc={accent} style={{ marginTop: 30 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        {BODY.map(([label, k, unit, icon]) => (
          <View key={k} style={{ width: '31%', flexGrow: 1, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name={icon} size={14} color={C.muted} />
              <Txt face="mono" size={9.5} ls={0.12} color={C.muted}>{label.toUpperCase()}</Txt>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              {field(k, 24, C.text)}
              <Txt size={11} color={C.dim}>{unit}</Txt>
            </View>
          </View>
        ))}
      </View>

      <Heading icon="kcal" title="Daily targets" acc={accent} style={{ marginTop: 30 }} />
      <Panel acc={accent} tone={0.2} dots={false} style={{ marginTop: 14 }} pad={6}>
        {TARGETS.map(([label, k, unit, icon], i) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
            <Icon name={icon} size={20} color={accent} />
            <Txt size={16} style={{ flex: 1 }}>{label}</Txt>
            <View style={{ width: 96 }}>{field(k, 18, accent, 'right')}</View>
            <Txt size={12} color={C.dim} style={{ width: 40 }}>{unit}</Txt>
          </View>
        ))}
      </Panel>

      <Heading icon="timer" title="Routine" acc={accent} style={{ marginTop: 30 }} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        {([['Training', 'sessionTime', 'gym', 'When you usually train'], ['Bedtime', 'bedtime', 'sleep', 'Quiet hours start after']] as const).map(([label, k, icon, hint]) => (
          <View key={k} style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name={icon} size={16} color={accent} />
              <Txt size={14} w={600}>{label}</Txt>
            </View>
            <TextInput
              value={profile[k]}
              onChangeText={v => s.setProfileField(k, v)}
              placeholder="HH:MM"
              placeholderTextColor={C.dim}
              keyboardType="numbers-and-punctuation"
              keyboardAppearance="dark"
              maxLength={5}
              selectTextOnFocus
              style={{ padding: 0, fontFamily: fontFamily('mono', 400), fontSize: 26 * settings.textSize, color: C.text }}
            />
            <Txt size={11} color={C.dim}>{hint}</Txt>
          </View>
        ))}
      </View>

      <Heading icon="fist" title="Disciplines" acc={accent} style={{ marginTop: 30 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {Object.keys(s.disc).map(k => {
          const on = s.disc[k];
          return (
            <Tap key={k} onPress={() => s.toggleDisc(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: on ? accent : C.line3, backgroundColor: on ? '#12171B' : '#0D0F13' }}>
              {on ? <Icon name="check" size={14} color={accent} strokeWidth={2.2} /> : null}
              <Txt size={14} color={on ? C.text : C.dim}>{k}</Txt>
            </Tap>
          );
        })}
      </View>

      <WeekPlan />

      <Heading icon="strength" title="Benchmarks" acc={accent} right="LOG A LIFT ›" onRight={() => router.push({ pathname: '/session', params: { mode: 'free' } })} style={{ marginTop: 30 }} />
      <Txt size={12} color={C.dim} style={{ marginTop: 8 }}>Your best logged lift or run moves these. Chest press counts toward bench.</Txt>
      <View style={{ marginTop: 14, gap: 10 }}>
        {benchmarks(s.sessions, s.bests ?? DEFAULT_BESTS).map(b => (
          <View key={b.id} style={{ padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: b.logged ? alpha(accent, 0.5) : C.line3, backgroundColor: '#0D0F13', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name={b.icon} size={20} color={b.logged ? accent : C.body} />
              <Txt size={15} w={600} style={{ flex: 1 }}>{b.name}</Txt>
              {b.logged ? <Stamp text="New best" color={C.warn} tilt={0} size={8.5} /> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Txt size={22} w={500}>{b.now}</Txt>
              <Txt face="mono" size={11} color={C.muted}>{`GOAL ${b.goal.toUpperCase()} · START ${b.start}`}</Txt>
            </View>
            <Gauge pct={b.pct} acc={accent} segments={24} height={6} />
            {b.from ? <Txt face="mono" size={10} ls={0.08} color={C.dim}>{`FROM ${b.from.toUpperCase()}`}</Txt> : null}
          </View>
        ))}
      </View>
    </Screen>
  );
}

/** This week's sessions (REI's program, or the default split) and the rebuild button. */
function WeekPlan() {
  const s = useStore();
  const { accent } = s;
  const [busy, setBusy] = useState(false);
  const today = weekdayIndex(new Date());
  const days = s.program?.days.length === 7 ? s.program.days : WEEK_PLAN.map(k => (k === 'REST' ? null : SESSIONS[k]));

  const rebuild = async () => {
    setBusy(true);
    try {
      await s.rebuildProgram();
    } catch {
      Alert.alert('REI couldn’t rebuild the week', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Heading icon="today" title="This week" acc={accent} right={s.program ? 'WRITTEN BY REI' : 'DEFAULT SPLIT'} style={{ marginTop: 30 }} />
      {s.program?.note ? <Txt size={14} lh={1.45} color={C.sub} style={{ marginTop: 10 }}>{s.program.note}</Txt> : null}
      <View style={{ marginTop: 14, gap: 8 }}>
        {days.map((d, i) => {
          const now = i === today;
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: now ? accent : C.line3, backgroundColor: now ? '#12171B' : '#0D0F13' }}>
              <Txt face="mono" size={11} color={now ? accent : C.dim} style={{ width: 32 }}>{DAY_NAMES[i]}</Txt>
              <Icon name={d ? SESSION_ICON[d.key] : 'sleep'} size={20} color={d ? (now ? accent : C.body) : C.faint} />
              <Txt size={15} w={now ? 600 : 400} color={d ? C.text : C.dim} style={{ flex: 1 }} numberOfLines={1}>{d ? d.title : 'Rest'}</Txt>
              {d ? <Txt face="mono" size={11} color={C.muted}>{`${d.minutes} MIN`}</Txt> : null}
              {now ? <Stamp text="Today" color={accent} tilt={0} size={8.5} /> : null}
            </View>
          );
        })}
      </View>
      {s.cloud ? (
        <Tap onPress={rebuild} disabled={busy} style={{ marginTop: 12, height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: alpha(accent, 0.5), backgroundColor: '#11161A', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
          <Icon name="rei" size={18} color={accent} />
          <Txt size={15} w={500} color={accent}>{busy ? 'REI is writing your week…' : 'Rebuild my week with REI'}</Txt>
        </Tap>
      ) : null}
    </>
  );
}
