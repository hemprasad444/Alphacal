// The Vow: the goal you made REI hold you to, the date you set for it, your measurements and
// daily targets, your routine, and this week's plan. Everything here is editable; REI uses
// exactly what's written.
import { type Benchmark, benchmarks, DEFAULT_BESTS, isoDate, parseIsoDate, type ProfileKey, SESSIONS, trajectory, week, WEEK_PLAN, weekdayIndex } from '@rei/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, type TextInputProps, View } from 'react-native';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { CutButton, MeterBar, MoveRow, RoundStamp, SectionHeader, useWarn } from '../../components/fight';
import { BrushRule, ReiSeal } from '../../components/ink';
import { PageTitle } from '../../components/PageTitle';
import { Screen } from '../../components/Screen';
import { Tap, Txt } from '../../components/ui';
import { C, fontFamily, HIT, RADIUS, SP } from '../../lib/theme';
import { useStore } from '../../state/store';

/** Your measurements: label, field, unit, and whether it's a target (drawn in your colour). */
const BODY: [string, ProfileKey, string, boolean][] = [
  ['Weight', 'weight', 'kg', false], ['Target', 'targetWeight', 'kg', true],
  ['Body fat', 'bf', '%', false], ['Target BF', 'targetBf', '%', true],
  ['Height', 'height', 'cm', false], ['Age', 'age', 'yrs', false],
];
const TARGETS: [string, ProfileKey, string][] = [
  ['Calories', 'kcal', 'kcal'], ['Protein', 'protein', 'g'], ['Carbs', 'carbs', 'g'], ['Fat', 'fat', 'g'],
  ['Steps', 'steps', 'steps'], ['Sleep', 'sleep', 'h'], ['Sessions', 'sessions', '/ wk'],
];
const ROUTINE = [['Training', 'sessionTime', 'When you usually train'], ['Bedtime', 'bedtime', 'Quiet hours start after']] as const;
const SHIFTS = [['− 1 week', -7, 'one week earlier'], ['+ 1 week', 7, 'one week later'], ['+ 1 month', 30, 'one month later']] as const;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * How far a benchmark has moved from where you started toward its goal, 0..1. (Its own `pct` is
 * now ÷ goal, which draws a bench of 82.5 with a goal of 102.5 as 80% full on day one.)
 * Times ("27:40") count in seconds, so a faster run fills the bar too.
 */
const climbed = (b: Benchmark): number => {
  const n = (t: string) => {
    const m = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(t.trim());
    return m ? (m[3] ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2]) : parseFloat(t);
  };
  const start = n(b.start), now = n(b.now), goal = n(b.goal);
  if (![start, now, goal].every(Number.isFinite) || goal === start) return 0;
  return Math.max(0, Math.min(1, (now - start) / (goal - start)));
};

export default function Vow() {
  const s = useStore();
  const { profile, settings, accent } = s;
  const traj = trajectory(profile, week(s.history, s.sessionDone, new Date(), s.program).missed, new Date(), s.weighInsOrDemo);
  const deadline = parseIsoDate(profile.deadline) ?? new Date();
  const start = s.weighInsOrDemo?.[0]?.kg ?? traj.history[0] ?? traj.weight;
  const done = start === traj.target ? 1 : Math.max(0, Math.min(1, (start - traj.weight) / (start - traj.target)));
  // The vow reads as text, all of it; tapping it swaps in the field to edit.
  const [editingVow, setEditingVow] = useState(false);
  const [vowHeight, setVowHeight] = useState(0);
  const vowType = { fontFamily: fontFamily('voice', 500), fontSize: 20 * settings.textSize, lineHeight: 20 * 1.5 * settings.textSize, color: C.chalk };
  const warn = useWarn();

  const shift = (days: number) => {
    const d = new Date(deadline);
    d.setDate(d.getDate() + days);
    const soonest = new Date();
    soonest.setDate(soonest.getDate() + 7);
    if (d < soonest) return;
    s.setProfileField('deadline', isoDate(d));
  };

  /** A number you can type over, in mono. */
  const field = (k: ProfileKey, label: string, size: number, color: string, align: 'left' | 'right' = 'left') => (
    <ProfileInput
      k={k}
      accessibilityLabel={label}
      keyboardType="decimal-pad"
      keyboardAppearance="dark"
      selectTextOnFocus
      style={{ flex: 1, minWidth: 0, minHeight: HIT, padding: 0, textAlign: align, fontFamily: fontFamily('num'), fontSize: size * settings.textSize, color }}
    />
  );

  return (
    <Screen>
      <PageTitle icon="vow" title="The Vow" sub="Your goal · your rules" />

      {/* The date you set: the biggest number on the page. */}
      <View style={{ marginTop: SP.xl, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', columnGap: SP.md }}>
        <View accessible accessibilityLabel={`${traj.daysLeft} days to your goal date`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
          <Txt face="display" exact size={56} lh={1.1} ls={-0.02} color={accent}>{traj.daysLeft}</Txt>
          <Txt size={15} w={500} lh={1.4} color={C.smoke}>days to go</Txt>
        </View>
        <View style={{ alignItems: 'flex-end', paddingBottom: SP.sm }}>
          <Txt face="label" w={400} size={12} color={C.smoke}>Goal date</Txt>
          <Txt face="heading" size={20} lh={1.4}>{fmtDate(deadline)}</Txt>
        </View>
      </View>
      <BrushRule long style={{ marginTop: SP.xs }} />
      <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.md }}>
        {SHIFTS.map(([l, d, say]) => (
          <Tap key={l} onPress={() => shift(d)} accessibilityLabel={`Move the goal date ${say}`} style={{ flex: 1, minHeight: HIT, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.rule, borderRadius: RADIUS.sm, backgroundColor: C.canvas }}>
            <Txt face="label" size={13}>{l}</Txt>
          </Tap>
        ))}
      </View>

      <View style={{ marginTop: SP.xl, gap: SP.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
            <Txt face="num" size={22} lh={1.3}>{traj.weight.toFixed(1)}</Txt>
            <Txt face="label" w={400} size={13} color={C.smoke}>to</Txt>
            <Txt face="num" size={22} lh={1.3} color={accent}>{traj.target.toFixed(1)}</Txt>
            <Txt face="label" w={400} size={13} color={C.smoke}>kg</Txt>
          </View>
          <Txt face="mono" size={12} lh={1.35} color={traj.behind ? warn : C.smoke}>{`Need ${traj.reqPace.toFixed(2)} kg / wk`}</Txt>
        </View>
        <MeterBar pct={done} accessibilityLabel={`Weight ${traj.weight.toFixed(1)} of the way to ${traj.target.toFixed(1)} kilograms, ${Math.round(done * 100)} percent`} />
        <Txt size={14} lh={1.5} color={C.smoke}>{traj.note}</Txt>
      </View>

      <SectionHeader title="The vow" meta="Sworn to REI" style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.md, backgroundColor: C.canvas, borderWidth: 1, borderColor: C.line2, borderRadius: RADIUS.card, paddingHorizontal: SP.xl, paddingVertical: SP.lg, gap: SP.md }}>
        {editingVow ? (
          <ProfileInput
            k="goal"
            multiline
            autoFocus
            scrollEnabled={false}
            keyboardAppearance="dark"
            accessibilityLabel="Your vow"
            placeholder="What are you going to become?"
            placeholderTextColor={C.dim}
            onContentSizeChange={e => setVowHeight(e.nativeEvent.contentSize.height)}
            onDone={() => setEditingVow(false)}
            style={[vowType, { padding: 0, minHeight: Math.max(HIT, vowHeight) }]}
          />
        ) : (
          <Tap haptic={false} onPress={() => setEditingVow(true)} accessibilityLabel={profile.goal ? `Your vow: ${profile.goal}` : 'Your vow: not written yet'} accessibilityHint="Edit" style={{ minHeight: HIT, justifyContent: 'center' }}>
            <Text allowFontScaling={false} style={[vowType, profile.goal ? null : { color: C.dim }]}>{profile.goal || 'What are you going to become?'}</Text>
          </Tap>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
          <ReiSeal size={28} />
          <Txt face="label" w={400} size={12} color={C.smoke} style={{ flex: 1 }}>Tap to edit. REI holds you to exactly these words.</Txt>
        </View>
      </View>
      <CutButton size="md" tone="quiet" label="Rewrite with REI" onPress={() => router.push({ pathname: '/talk', params: { draft: 'Change my goal: ' } })} style={{ marginTop: SP.md }} />

      <SectionHeader title="Measurements" meta="Tap to edit" style={{ marginTop: SP.huge }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {BODY.map(([label, k, unit, target]) => (
          <View key={k} style={{ width: '46%', flexGrow: 1, backgroundColor: C.canvas, borderWidth: 1, borderColor: C.line2, borderRadius: RADIUS.card, paddingHorizontal: SP.lg, paddingTop: SP.md, paddingBottom: SP.xs }}>
            <Txt face="label" w={400} size={12} color={C.smoke}>{label}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
              {field(k, label, 22, target ? accent : C.chalk)}
              <Txt face="label" w={400} size={13} color={C.smoke}>{unit}</Txt>
            </View>
          </View>
        ))}
      </View>

      <SectionHeader title="Daily targets" meta="Every day" style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.xs }}>
        {TARGETS.map(([label, k, unit]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 52, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <Txt size={15} w={500} lh={1.35} style={{ flex: 1 }}>{label}</Txt>
            <View style={{ width: 104, flexDirection: 'row' }}>{field(k, label, 17, accent, 'right')}</View>
            <Txt face="label" w={400} size={12} color={C.smoke} numberOfLines={1} style={{ width: 44 }}>{unit}</Txt>
          </View>
        ))}
      </View>

      <SectionHeader title="Routine" meta="24 h clock" style={{ marginTop: SP.huge }} />
      <View style={{ flexDirection: 'row', gap: SP.sm, marginTop: SP.md }}>
        {ROUTINE.map(([label, k, hint]) => (
          <View key={k} style={{ flex: 1, backgroundColor: C.canvas, borderWidth: 1, borderColor: C.line2, borderRadius: RADIUS.card, paddingHorizontal: SP.lg, paddingVertical: SP.md }}>
            <Txt face="label" w={400} size={12} color={C.smoke}>{label}</Txt>
            <ProfileInput
              k={k}
              accessibilityLabel={`${label} time`}
              placeholder="HH:MM"
              placeholderTextColor={C.dim}
              keyboardType="numbers-and-punctuation"
              keyboardAppearance="dark"
              maxLength={5}
              selectTextOnFocus
              style={{ padding: 0, minHeight: HIT, fontFamily: fontFamily('num'), fontSize: 22 * settings.textSize, color: C.chalk }}
            />
            <Txt size={13} lh={1.4} color={C.smoke}>{hint}</Txt>
          </View>
        ))}
      </View>

      <SectionHeader title="Disciplines" style={{ marginTop: SP.huge }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {Object.keys(s.disc).map(k => {
          const on = s.disc[k];
          return (
            <Tap key={k} onPress={() => s.toggleDisc(k)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={k} style={{ minHeight: HIT, paddingHorizontal: SP.lg, justifyContent: 'center', borderWidth: 1, borderColor: on ? accent : C.rule, borderRadius: RADIUS.sm, backgroundColor: C.canvas }}>
              <Txt face={on ? 'labelItalic' : 'label'} size={14} color={on ? C.chalk : C.smoke}>{k}</Txt>
            </Tap>
          );
        })}
      </View>

      <WeekPlan />

      <SectionHeader title="Benchmarks" meta="Log a lift" onMeta={() => router.push({ pathname: '/session', params: { mode: 'free' } })} style={{ marginTop: SP.huge }} />
      <Txt size={13} lh={1.5} color={C.smoke} style={{ marginTop: SP.sm }}>Each stroke runs from where you started to your goal. Your best logged lift or run moves it; chest press counts toward bench.</Txt>
      <View style={{ marginTop: SP.md, gap: SP.sm }}>
        {benchmarks(s.sessions, s.bests ?? DEFAULT_BESTS).map(b => (
          <View key={b.id} style={{ backgroundColor: C.canvas, borderWidth: 1, borderColor: C.line2, borderRadius: RADIUS.card, padding: SP.lg, gap: SP.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
              <Txt face="heading" size={17} lh={1.4} style={{ flex: 1 }}>{b.name}</Txt>
              {b.logged ? <RoundStamp label="New best" size="sm" /> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
              <Txt face="num" raw size={20} lh={1.3} color={b.logged ? accent : C.chalk}>{b.now}</Txt>
              <Txt face="mono" raw size={12} lh={1.35} color={C.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{`start ${b.start} · goal ${b.goal}`}</Txt>
            </View>
            <MeterBar pct={climbed(b)} height={8} accessibilityLabel={`${b.name}: ${b.now}, goal ${b.goal}, ${Math.round(climbed(b) * 100)} percent of the way from your start`} />
            {b.from ? <Txt face="label" w={400} size={12} color={C.smoke}>{`From ${b.from}`}</Txt> : null}
          </View>
        ))}
      </View>
    </Screen>
  );
}

/**
 * A Vow field as it's typed: the text stays as typed, but only a valid value is saved (no empty
 * calories or "18:" times). Left half-typed, it goes back to the last saved value.
 */
function ProfileInput({ k, onDone, ...props }: { k: ProfileKey; /** Called when the field is left. */ onDone?: () => void } & Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'>) {
  const saved = useStore(s => s.profile[k]);
  const setField = useStore(s => s.setProfileField);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <TextInput
      {...props}
      value={draft ?? saved}
      onChangeText={v => {
        setDraft(v);
        setField(k, v);
      }}
      onBlur={() => {
        setDraft(null);
        onDone?.();
      }}
    />
  );
}

/** This week's sessions (REI's program, or the default split) and the rebuild button. */
function WeekPlan() {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const today = weekdayIndex(new Date());
  const days = s.program?.days.length === 7 ? s.program.days : WEEK_PLAN.map(k => (k === 'REST' ? null : SESSIONS[k]));

  const rebuild = async () => {
    setBusy(true);
    try {
      await s.rebuildProgram();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeader title="This week's plan" meta={s.program ? 'Written by REI' : 'Default split'} style={{ marginTop: SP.huge }} />
      {s.program?.note ? <Txt size={14} lh={1.5} color={C.smoke} style={{ marginTop: SP.sm }}>{s.program.note}</Txt> : null}
      <View style={{ marginTop: SP.xs }}>
        {days.map((d, i) => {
          const now = i === today;
          return (
            <MoveRow
              key={i}
              index={DAY_NAMES[i]}
              indexWidth={32}
              name={d ? d.title : 'Rest'}
              detail={d ? `${d.minutes} min` : undefined}
              done={now}
              right={now ? <RoundStamp label="Today" tone="accent" size="sm" /> : undefined}
            />
          );
        })}
      </View>
      {s.cloud ? <CutButton size="md" tone="quiet" icon="rei" label={busy ? 'REI is writing your week…' : 'Rebuild my week with REI'} disabled={busy} onPress={rebuild} style={{ marginTop: SP.md }} /> : null}
      <ConfirmSheet
        visible={failed}
        title="REI couldn’t rebuild the week"
        message="Check your connection and try again."
        confirmLabel="OK"
        cancelLabel={null}
        onConfirm={() => setFailed(false)}
        onCancel={() => setFailed(false)}
      />
    </>
  );
}
