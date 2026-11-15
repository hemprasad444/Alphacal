// The Vow: your title fight. The goal you made REI hold you to, the fight date (your deadline),
// the tale of the tape (body and targets), your routine, and this week's card. Everything here is
// editable; REI uses exactly what's written.
import { type Benchmark, benchmarks, DEFAULT_BESTS, isoDate, parseIsoDate, type ProfileKey, SESSIONS, trajectory, week, WEEK_PLAN, weekdayIndex } from '@rei/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, type TextInputProps, View } from 'react-native';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { CutButton, MeterBar, MoveRow, RoundStamp, SectionHeader } from '../../components/fight';
import { PageTitle } from '../../components/PageTitle';
import { Screen } from '../../components/Screen';
import { Tap, Txt } from '../../components/ui';
import { C, fontFamily, HIT, onColor, SP } from '../../lib/theme';
import { useStore } from '../../state/store';

/** The tale of the tape: label, field, unit, and whether it's a target (drawn in your colour). */
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
const SHIFTS = [['− 1 WK', -7, 'one week earlier'], ['+ 1 WK', 7, 'one week later'], ['+ 1 MO', 30, 'one month later']] as const;
const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
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
  const vowType = { fontFamily: fontFamily('body', 600), fontSize: 22 * settings.textSize, lineHeight: 22 * 1.3 * settings.textSize, color: C.chalk };

  const shift = (days: number) => {
    const d = new Date(deadline);
    d.setDate(d.getDate() + days);
    const soonest = new Date();
    soonest.setDate(soonest.getDate() + 7);
    if (d < soonest) return;
    s.setProfileField('deadline', isoDate(d));
  };

  /** A number you can type over, in display type. */
  const field = (k: ProfileKey, label: string, size: number, color: string, align: 'left' | 'right' = 'left') => (
    <ProfileInput
      k={k}
      accessibilityLabel={label}
      keyboardType="decimal-pad"
      keyboardAppearance="dark"
      selectTextOnFocus
      style={{ flex: 1, minWidth: 0, minHeight: HIT, padding: 0, textAlign: align, fontFamily: fontFamily('display'), fontSize: size * settings.textSize, color }}
    />
  );

  return (
    <Screen>
      <PageTitle icon="vow" title="The Vow" sub="Title fight · your rules" />

      {/* The fight date: the biggest number on the page. */}
      <View style={{ marginTop: SP.xl, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', columnGap: SP.md }}>
        <View accessible accessibilityLabel={`${traj.daysLeft} days to fight night`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: SP.md }}>
          <Txt face="display" size={72} lh={1.08} color={accent}>{traj.daysLeft}</Txt>
          <View style={{ paddingBottom: SP.md }}>
            <Txt face="labelItalic" w={600} size={14} ls={0.12} lh={1.15}>DAYS TO</Txt>
            <Txt face="labelItalic" w={600} size={14} ls={0.12} lh={1.15}>FIGHT NIGHT</Txt>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', paddingBottom: SP.md }}>
          <Txt face="label" w={600} size={12} ls={0.12} color={C.smoke}>FIGHT DATE</Txt>
          <Txt face="display" lean={false} size={22} lh={1.2}>{fmtDate(deadline).toUpperCase()}</Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: SP.sm }}>
        {SHIFTS.map(([l, d, say]) => (
          <Tap key={l} onPress={() => shift(d)} accessibilityLabel={`Move the fight date ${say}`} style={{ flex: 1, minHeight: HIT, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.rope, backgroundColor: C.canvas }}>
            <Txt face="label" w={600} size={14} ls={0.1}>{l}</Txt>
          </Tap>
        ))}
      </View>

      <View style={{ marginTop: SP.lg, gap: SP.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SP.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
            <Txt face="display" size={28} lh={1.15}>{traj.weight.toFixed(1)}</Txt>
            <Txt face="label" w={600} size={14} ls={0.08} color={C.smoke}>TO</Txt>
            <Txt face="display" size={28} lh={1.15} color={accent}>{traj.target.toFixed(1)}</Txt>
            <Txt face="label" w={600} size={14} ls={0.08} color={C.smoke}>KG</Txt>
          </View>
          {traj.behind ? <RoundStamp label={`Need ${traj.reqPace.toFixed(2)} kg / wk`} tone="rival" size="sm" style={{ marginBottom: SP.xs }} /> : <Txt face="label" w={600} size={12} ls={0.12} color={C.smoke} style={{ paddingBottom: SP.xs }}>{`NEED ${traj.reqPace.toFixed(2)} KG / WK`}</Txt>}
        </View>
        <MeterBar pct={done} accessibilityLabel={`Weight ${traj.weight.toFixed(1)} of the way to ${traj.target.toFixed(1)} kilograms, ${Math.round(done * 100)} percent`} />
        <Txt size={14} w={500} lh={1.4} color={C.smoke}>{traj.note}</Txt>
      </View>

      <SectionHeader title="The vow" meta="Sworn to REI" style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.md, backgroundColor: C.canvas, borderLeftWidth: 4, borderLeftColor: accent, padding: SP.lg, gap: SP.sm }}>
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
        <Txt face="label" w={600} size={12} ls={0.1} color={C.smoke}>TAP TO EDIT. REI HOLDS YOU TO EXACTLY THESE WORDS.</Txt>
      </View>
      <CutButton size="md" label="Rewrite with REI" onPress={() => router.push({ pathname: '/talk', params: { draft: 'Change my goal: ' } })} style={{ marginTop: SP.md }} />

      <SectionHeader title="Tale of the tape" meta="Tap a number to edit" style={{ marginTop: SP.huge }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.xs, marginTop: SP.md }}>
        {BODY.map(([label, k, unit, target]) => (
          <View key={k} style={{ width: '48%', flexGrow: 1, backgroundColor: C.canvas, paddingHorizontal: SP.md, paddingTop: SP.sm, paddingBottom: SP.xs }}>
            <Txt face="label" w={600} size={12} ls={0.12} color={C.smoke}>{label.toUpperCase()}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
              {field(k, label, 28, target ? accent : C.chalk)}
              <Txt face="label" w={600} size={14} ls={0.08} color={C.smoke}>{unit.toUpperCase()}</Txt>
            </View>
          </View>
        ))}
      </View>

      <SectionHeader title="Round targets" meta="Every day" style={{ marginTop: SP.huge }} />
      <View style={{ marginTop: SP.md, gap: SP.xs }}>
        {TARGETS.map(([label, k, unit]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 48, paddingHorizontal: SP.md, backgroundColor: C.canvas }}>
            <Txt size={15} w={500} style={{ flex: 1 }}>{label}</Txt>
            <View style={{ width: 104, flexDirection: 'row' }}>{field(k, label, 22, accent, 'right')}</View>
            <Txt face="label" w={600} size={14} ls={0.08} color={C.smoke} style={{ width: 44 }}>{unit.toUpperCase()}</Txt>
          </View>
        ))}
      </View>

      <SectionHeader title="Routine" meta="24 h clock" style={{ marginTop: SP.huge }} />
      <View style={{ flexDirection: 'row', gap: SP.xs, marginTop: SP.md }}>
        {ROUTINE.map(([label, k, hint]) => (
          <View key={k} style={{ flex: 1, backgroundColor: C.canvas, paddingHorizontal: SP.md, paddingVertical: SP.sm }}>
            <Txt face="label" w={600} size={12} ls={0.12} color={C.smoke}>{label.toUpperCase()}</Txt>
            <ProfileInput
              k={k}
              accessibilityLabel={`${label} time`}
              placeholder="HH:MM"
              placeholderTextColor={C.dim}
              keyboardType="numbers-and-punctuation"
              keyboardAppearance="dark"
              maxLength={5}
              selectTextOnFocus
              style={{ padding: 0, minHeight: HIT, fontFamily: fontFamily('display'), fontSize: 28 * settings.textSize, color: C.chalk }}
            />
            <Txt size={13} w={500} color={C.smoke}>{hint}</Txt>
          </View>
        ))}
      </View>

      <SectionHeader title="Disciplines" style={{ marginTop: SP.huge }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, marginTop: SP.md }}>
        {Object.keys(s.disc).map(k => {
          const on = s.disc[k];
          return (
            <Tap key={k} onPress={() => s.toggleDisc(k)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={k} style={{ minHeight: HIT, paddingHorizontal: SP.md, justifyContent: 'center', borderWidth: 2, borderColor: on ? accent : C.rope, backgroundColor: on ? accent : C.canvas }}>
              <Txt face="label" w={600} size={15} ls={0.08} color={on ? onColor(accent) : C.smoke}>{k.toUpperCase()}</Txt>
            </Tap>
          );
        })}
      </View>

      <WeekPlan />

      <SectionHeader title="Benchmarks" meta="Log a lift ›" onMeta={() => router.push({ pathname: '/session', params: { mode: 'free' } })} style={{ marginTop: SP.huge }} />
      <Txt size={13} w={500} lh={1.4} color={C.smoke} style={{ marginTop: SP.sm }}>Each bar runs from where you started to your goal. Your best logged lift or run moves it; chest press counts toward bench.</Txt>
      <View style={{ marginTop: SP.md, gap: SP.xs }}>
        {benchmarks(s.sessions, s.bests ?? DEFAULT_BESTS).map(b => (
          <View key={b.id} style={{ backgroundColor: C.canvas, padding: SP.md, gap: SP.sm }}>
            {b.logged ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: accent }} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
              <Txt size={15} w={600} style={{ flex: 1 }}>{b.name}</Txt>
              {b.logged ? <RoundStamp label="New best" size="sm" /> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm }}>
              <Txt face="display" size={28} lh={1.15} color={b.logged ? accent : C.chalk}>{b.now}</Txt>
              <Txt face="label" w={600} size={12} ls={0.1} color={C.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{`START ${b.start} · GOAL ${b.goal.toUpperCase()}`}</Txt>
            </View>
            <MeterBar pct={climbed(b)} height={8} accessibilityLabel={`${b.name}: ${b.now}, goal ${b.goal}, ${Math.round(climbed(b) * 100)} percent of the way from your start`} />
            {b.from ? <Txt face="label" w={600} size={12} ls={0.08} color={C.smoke}>{`FROM ${b.from.toUpperCase()}`}</Txt> : null}
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
      <SectionHeader title="This week's card" meta={s.program ? 'Written by REI' : 'Default split'} style={{ marginTop: SP.huge }} />
      {s.program?.note ? <Txt size={14} w={500} lh={1.45} color={C.smoke} style={{ marginTop: SP.sm }}>{s.program.note}</Txt> : null}
      <View style={{ marginTop: SP.md, gap: SP.xs }}>
        {days.map((d, i) => {
          const now = i === today;
          return (
            <MoveRow
              key={i}
              index={DAY_NAMES[i]}
              indexWidth={36}
              name={d ? d.title : 'Rest'}
              detail={d ? `${d.minutes} MIN` : undefined}
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
