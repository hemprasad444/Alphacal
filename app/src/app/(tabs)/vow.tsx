import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, TextInput, View } from 'react-native';
import { Core } from '../../components/Core';
import { Screen } from '../../components/Screen';
import { Bar, Card, Label, Tap, Txt } from '../../components/ui';
import { BENCHMARKS, isoDate, parseIsoDate, type ProfileKey, SESSIONS, trajectory, week, WEEK_PLAN, weekdayIndex } from '@rei/shared';
import { alpha, C, fontFamily } from '../../lib/theme';
import { useStore } from '../../state/store';

const BODY: [string, ProfileKey, string][] = [['WEIGHT', 'weight', 'kg'], ['TARGET', 'targetWeight', 'kg'], ['BODY FAT', 'bf', '%'], ['TARGET BF', 'targetBf', '%'], ['HEIGHT', 'height', 'cm'], ['AGE', 'age', 'yrs']];
const TARGETS: [string, ProfileKey, string][] = [['Calories', 'kcal', 'kcal'], ['Protein', 'protein', 'g'], ['Carbs', 'carbs', 'g'], ['Fat', 'fat', 'g'], ['Steps', 'steps', 'steps'], ['Sleep', 'sleep', 'h'], ['Sessions', 'sessions', '/ wk']];

export default function Vow() {
  const s = useStore();
  const { profile, settings, accent } = s;
  const tough = settings.tone !== 'Coach';
  const traj = trajectory(profile, week(s.history, s.sessionDone, new Date(), s.program).missed, new Date(), s.weighInsOrDemo);
  const strong = settings.scenario === 'Strong week';
  const deadline = parseIsoDate(profile.deadline) ?? new Date();

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
        <Label color={C.muted}>{settings.hud ? 'THE VOW · 誓' : 'THE VOW'}</Label>
        <Tap onPress={() => router.push({ pathname: '/talk', params: { draft: 'Change my goal: ' } })}>
          <Txt size={14} color={accent}>Rewrite with REI</Txt>
        </Tap>
      </View>

      <Label color={C.dim} style={{ marginTop: 30 }}>IN YOUR WORDS</Label>
      <TextInput
        value={profile.goal}
        onChangeText={v => s.setProfileField('goal', v)}
        multiline
        scrollEnabled={false}
        keyboardAppearance="dark"
        style={{ marginTop: 10, padding: 0, fontFamily: fontFamily(settings.font, 400), fontSize: 27 * settings.textSize, lineHeight: 27 * 1.2 * settings.textSize, letterSpacing: -0.025 * 27, color: C.text }}
      />
      <Txt size={13} color={C.dim} style={{ marginTop: 6 }}>{"Tap to edit. REI holds you to exactly what's written here."}</Txt>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginTop: 26, paddingVertical: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line2 }}>
        <View style={{ gap: 8, alignItems: 'flex-start' }}>
          <Label>DEADLINE</Label>
          <DateTimePicker
            value={deadline}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            themeVariant="dark"
            accentColor={accent}
            minimumDate={new Date()}
            onChange={(_, d) => d && s.setProfileField('deadline', isoDate(d))}
            style={{ marginLeft: -10 }}
          />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt size={44} w={300} ls={-0.04}>{traj.daysLeft}</Txt>
          <Label size={10} style={{ marginTop: 4 }}>DAYS LEFT</Label>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
        <Label>BODY</Label>
        <Label ls={0.12} color={traj.behind && !strong ? C.alert : accent}>{`NEED ${traj.reqPace.toFixed(2)} KG / WK`}</Label>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {BODY.map(([label, k, unit]) => (
          <Card key={k} style={{ width: '48.5%', flexGrow: 1, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18 }}>
            <Label size={10} ls={0.14}>{label}</Label>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
              <TextInput
                value={profile[k]}
                onChangeText={v => s.setProfileField(k, v)}
                keyboardType="decimal-pad"
                keyboardAppearance="dark"
                style={{ flex: 1, padding: 0, fontFamily: fontFamily(settings.font, 300), fontSize: 28 * settings.textSize, letterSpacing: -0.03 * 28, color: C.text }}
              />
              <Txt size={13} color={C.dim}>{unit}</Txt>
            </View>
          </Card>
        ))}
      </View>

      <Label style={{ marginTop: 30 }}>DAILY TARGETS</Label>
      <View style={{ marginTop: 8 }}>
        {TARGETS.map(([label, k, unit]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.line }}>
            <Txt size={16}>{label}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <TextInput
                value={profile[k]}
                onChangeText={v => s.setProfileField(k, v)}
                keyboardType="decimal-pad"
                keyboardAppearance="dark"
                style={{ width: 90, padding: 0, textAlign: 'right', fontFamily: fontFamily('mono', 400), fontSize: 16 * settings.textSize, color: accent }}
              />
              <Txt size={13} color={C.dim} style={{ width: 42 }}>{unit}</Txt>
            </View>
          </View>
        ))}
      </View>

      <Label style={{ marginTop: 30 }}>DISCIPLINES</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {Object.keys(s.disc).map(k => {
          const on = s.disc[k];
          return (
            <Tap key={k} onPress={() => s.toggleDisc(k)} style={{ height: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center', backgroundColor: on ? alpha(accent, 0.14) : 'transparent', borderWidth: 1, borderColor: on ? alpha(accent, 0.45) : 'rgba(255,255,255,0.1)' }}>
              <Txt size={14} color={on ? C.text : C.dim}>{k}</Txt>
            </Tap>
          );
        })}
      </View>

      <WeekPlan />

      <Label style={{ marginTop: 30 }}>BENCHMARKS</Label>
      <View style={{ marginTop: 8 }}>
        {BENCHMARKS.map(([name, now, goal, f]) => (
          <View key={name} style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <Txt size={16}>{name}</Txt>
              <Txt face="mono" size={13} color={C.value}>{now} <Txt face="mono" size={13} color={C.faint}>→</Txt> {goal}</Txt>
            </View>
            <View style={{ marginTop: 10 }}>
              <Bar pct={f} color={accent} />
            </View>
          </View>
        ))}
      </View>

      <Tap onPress={() => router.push('/settings')} style={{ marginTop: 30, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card2, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Core size={40} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt size={15} w={500}>{`REI intensity · ${tough ? 'Tough love, 10 / 10' : 'Coach, 6 / 10'}`}</Txt>
          <Txt size={13} lh={1.4} color={C.muted}>{tough ? 'Calls out every excuse. Never cruel. Change it any time in Settings.' : 'Firm, warmer framing. Still won’t let you skip.'}</Txt>
        </View>
      </Tap>
    </Screen>
  );
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
      Alert.alert('REI couldn\u2019t rebuild the week', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30 }}>
        <Label>THIS WEEK</Label>
        <Label ls={0.12} color={s.program ? accent : C.dim}>{s.program ? 'WRITTEN BY REI' : 'DEFAULT SPLIT'}</Label>
      </View>
      {s.program?.note ? <Txt size={14} lh={1.45} color={C.sub} style={{ marginTop: 10 }}>{s.program.note}</Txt> : null}
      <View style={{ marginTop: 8 }}>
        {days.map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line }}>
            <Txt face="mono" size={12} color={i === today ? accent : C.dim} style={{ width: 34 }}>{DAY_NAMES[i].toUpperCase()}</Txt>
            <Txt size={16} w={i === today ? 500 : 400} color={d ? C.text : C.dim} style={{ flex: 1 }} numberOfLines={1}>{d ? d.title : 'Rest'}</Txt>
            {d ? <Txt face="mono" size={12} color={C.value}>{`${d.minutes} MIN · ${d.key}`}</Txt> : null}
          </View>
        ))}
      </View>
      {s.cloud ? (
        <Tap onPress={rebuild} disabled={busy} style={{ marginTop: 12, height: 48, borderRadius: 24, borderWidth: 1, borderColor: alpha(accent, 0.45), backgroundColor: alpha(accent, 0.08), alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={15} color={accent}>{busy ? 'REI is writing your week\u2026' : 'Rebuild my week with REI'}</Txt>
        </Tap>
      ) : null}
    </>
  );
}
