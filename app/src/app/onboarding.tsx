// First run, after the account exists: the pre-fight training camp. The fight poster, fourteen
// short rounds, the contract (hold to sign), the walk out to the ring and the cut into the app.
// Fight Night look: flat colour, the one cut angle, hard shadows, the chosen world's colour.
// Numbers, wording and the order of the rounds come from @rei/shared (onboarding.ts); this file is the stage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ARCHETYPES, type BestKey, bondLine, gaveBest, suggestedBest, CHAPTERS, CHARACTERS, characterOf, clockOf, deadlineOf, DEFAULT_INTAKE, fuel, goalOf, GOALS, greeting, hasVoice, type Intake, mmss, nameOf, pactRows, reiLine, shortDate,
  sleepHours, STEPS, suggestedTarget, TONES, toneSample, trainTime, vowSentence, weeklyRate,
} from '@rei/shared';
import { CutShape } from '../components/cut';
import { CoachShout, MeterBar, RoundStamp, VersusHeader } from '../components/fight';
import { Icon } from '../components/icons';
import { ChapterCard, EnterFx, Flash, HoldSeal, markArrival } from '../components/onboarding/fx';
import { Atmosphere, Chips, Cta, Field, FieldLabel, Nums, Picked, Rise, Scrub, Seg, tile, ToggleRow } from '../components/onboarding/kit';
import { Tap, Txt } from '../components/ui';
import { C, DEFAULT_EMBLEM, EMBLEMS, F, fontFamily, hard, HIT, SHADOW, SP, THEMES } from '../lib/theme';
import { playGreeting, prefetchGreetings } from '../lib/greetings';
import { useStore } from '../state/store';

const DRAFT_KEY = 'rei-onboarding-draft';
/** Screen side padding. */
const SIDE = SP.lg;
const idx = (id: string) => STEPS.findIndex(s => s.id === id);
const on = (o: Record<string, boolean>, k: string) => !!o[k];
const toggle = (o: Record<string, boolean>, k: string) => {
  if (k === 'None') return o.None ? {} : { None: true };
  const n = { ...o };
  delete n.None;
  n[k] = !n[k];
  return n;
};
/** Round number of a step (the poster is 0). */
const roundOf = (step: number) => STEPS.slice(1, step + 1).filter(x => x.t).length;
const two = (n: number) => String(n).padStart(2, '0');
const worldAccent = (id: string) => THEMES.find(t => t.id === id)?.acc ?? THEMES[0].acc;

export default function Onboarding() {
  const s = useStore();
  const insets = useSafeAreaInsets();

  const [d, setD] = useState<Intake>(() => ({ ...DEFAULT_INTAKE, name: s.profile.name || '' }));
  const [step, setStep] = useState(0);
  const [card, setCard] = useState<{ to: number; key: number } | null>(null);
  const [flash, setFlash] = useState(false);
  const [entering, setEntering] = useState(false);
  /** How much of REI's line is shown, for which round (a new round starts from nothing). */
  const [typed, setTyped] = useState({ key: '', n: 0 });
  const loaded = useRef(false);
  /** The step change a round card performs halfway through its wipe. */
  const pendingArrive = useRef<() => void>(() => {});

  const st = STEPS[step];
  const theme = THEMES.find(t => t.id === d.theme) ?? THEMES[0];
  const { acc, bg } = theme;
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => setD(cur => ({ ...cur, [k]: v }));
  const patch = (o: Partial<Intake>) => setD(cur => ({ ...cur, ...o }));

  // Once signed, the account counts as onboarded; keep this flow on screen until the walkout finishes.
  const { setObActive } = s;
  useEffect(() => () => setObActive(false), [setObActive]);

  // Answers in progress survive leaving the app.
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY)
      .then(raw => {
        if (raw) setD(cur => ({ ...cur, ...(JSON.parse(raw) as Partial<Intake>) }));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(d)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [d]);

  // REI types its line for each round (and again when the chosen look or corner voice changes).
  const line = reiLine(st.id, d);
  const typeKey = `${step}|${st.id === 'ideal' ? d.arch : st.id === 'partner' ? d.character : ''}`;
  useEffect(() => {
    let n = 0, timer: ReturnType<typeof setInterval> | undefined;
    const wait = setTimeout(() => {
      timer = setInterval(() => {
        n += 2;
        setTyped({ key: typeKey, n });
        if (n > 400 && timer) clearInterval(timer);
      }, 20);
    }, st.t ? 560 : 140);
    return () => {
      clearTimeout(wait);
      if (timer) clearInterval(timer);
    };
  }, [typeKey, st.t]);
  const shown = typed.key === typeKey ? Math.min(typed.n, line.length) : 0;

  const go = (i: number, instant = false) => {
    if (i < 0 || i >= STEPS.length) return;
    const to = STEPS[i];
    const arrive = () => {
      if (to.id === 'target' && !d.targetTouched) {
        const t = suggestedTarget(d);
        if (t) patch(t);
      }
      setStep(i);
    };
    if (!instant && to.t && i > step) {
      pendingArrive.current = arrive;
      setCard({ to: i, key: Date.now() });
    } else arrive();
  };

  // Past the name round, every corner voice's greeting with their name is made in the background,
  // so the corner round plays it the moment a card is tapped.
  const named = step > idx('name') ? d.name.trim() : '';
  useEffect(() => {
    if (named) void prefetchGreetings(named);
  }, [named]);

  const blocked = (st.id === 'name' && !d.name.trim()) || (st.id === 'ideal' && !d.arch);
  const next = () => {
    if (!blocked && !card) go(step + 1);
  };

  const seal = () => {
    s.setObActive(true);
    setFlash(true);
    s.completeOnboarding(d);
    setTimeout(() => go(idx('done'), true), 380);
  };

  const enter = () => setEntering(true);
  const entered = () => {
    AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    markArrival();
    s.setObActive(false);
    router.replace('/');
  };

  // The chosen world's own art behind the rounds.
  const emblem = EMBLEMS[d.theme]?.find(e => e.id === DEFAULT_EMBLEM[d.theme])?.source ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: bg, overflow: 'hidden' }}>
      <Atmosphere acc={acc} />
      {emblem && st.t ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 90 }]}>
          <Image source={emblem} style={{ width: 280, height: 280, opacity: 0.07 }} contentFit="contain" />
        </View>
      ) : null}

      {st.id === 'boot' ? <Poster acc={acc} name={d.name.trim()} email={s.account.email} onBegin={() => go(1)} onSignOut={() => void s.signOut()} insetTop={insets.top} insetBottom={insets.bottom} /> : null}

      {st.t ? (
        <Round
          step={step} acc={acc} insetTop={insets.top} insetBottom={insets.bottom}
          line={line} shown={shown} onBack={() => go(step - 1, true)}
          cta={st.cta ? <Cta label={st.cta} acc={acc} disabled={blocked} onPress={next} /> : null}
        >
          {st.id === 'name' ? <NameStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'ideal' ? <IdealStep d={d} patch={patch} acc={acc} /> : null}
          {st.id === 'vow' ? <VowStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'body' ? <BodyStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'target' ? <TargetStep d={d} patch={patch} acc={acc} /> : null}
          {st.id === 'train' ? <TrainStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'kitchen' ? <KitchenStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'partner' ? <CornerStep d={d} set={set} patch={patch} acc={acc} /> : null}
          {st.id === 'life' ? <LifeStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'fuel' ? <FuelStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'power' ? <PowerStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'weak' ? <WeakStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'tone' ? <ToneStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'pact' ? <PactStep d={d} acc={acc} onSeal={seal} /> : null}
        </Round>
      ) : null}

      {st.id === 'done' ? <Walkout d={d} acc={acc} insetTop={insets.top} insetBottom={insets.bottom} onEnter={enter} /> : null}

      {card ? (
        <ChapterCard
          key={card.key} n={roundOf(card.to)} t={STEPS[card.to].t ?? ''} total={CHAPTERS} acc={acc} bg={bg}
          onSwap={() => pendingArrive.current()} onEnd={() => setCard(null)}
        />
      ) : null}
      {flash ? <Flash onEnd={() => setFlash(false)} /> : null}
      {entering ? <EnterFx name={nameOf(d)} acc={acc} bg={bg} onEnd={entered} /> : null}
    </View>
  );
}

/** The fight poster: you against your excuses, how many rounds of camp there are, and the way in. */
function Poster({ acc, name, email, onBegin, onSignOut, insetTop, insetBottom }: { acc: string; name: string; email: string | null; onBegin: () => void; onSignOut: () => void; insetTop: number; insetBottom: number }) {
  const { height: H } = useWindowDimensions();
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insetTop + SP.md, paddingHorizontal: SIDE, paddingBottom: insetBottom + SP.md }} showsVerticalScrollIndicator={false}>
      <Rise delay={100} from={0} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md, marginBottom: SP.md }}>
        <Txt face="labelItalic" w={600} size={13} ls={0.16} color={acc}>TRAINING CAMP</Txt>
        <Txt face="label" w={600} size={12} ls={0.1} color={F.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{(email ?? 'SIGNED IN').toUpperCase()}</Txt>
      </Rise>
      <Rise delay={250} style={{ marginHorizontal: -SIDE }}>
        <VersusHeader name={name || 'You'} sub="New challenger" rivalSub="Undefeated so far" plate={{ big: String(CHAPTERS), small: 'Rounds of camp' }} height={H < 740 ? 176 : 224} accent={acc} />
      </Rise>
      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: SP.xl }}>
        <Rise delay={600} style={{ gap: SP.xs }}>
          <RoundStamp label="Pre-fight weigh-in" tone="outline" />
          <Txt face="display" size={76} lh={1.08} accessibilityLabel="REI">REI</Txt>
          <Txt face="label" w={600} size={14} ls={0.14} color={F.smoke}>YOUR CORNER COACH · ZERO EXCUSES</Txt>
        </Rise>
      </View>
      <Rise delay={900} style={{ gap: SP.xl }}>
        <CoachShout
          accent={acc}
          before="You’re in. Good. I don’t do generic."
          shout={`${CHAPTERS} short rounds`}
          after="and I’ll know exactly who you want to become, and when you’re lying to yourself about it."
        />
        <View style={{ gap: SP.xs }}>
          <Cta label="Start round 1" icon="scroll" acc={acc} onPress={onBegin} />
          <Tap onPress={onSignOut} accessibilityLabel="Not you? Sign out" style={{ minHeight: HIT, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={14} w={500} color={C.sub}>Not you? Sign out</Txt>
          </Tap>
        </View>
      </Rise>
    </ScrollView>
  );
}

/** The frame around every round: back, the round meter, the round stamp and name, REI's typed line, the answers, and the call to action. */
function Round({ step, acc, insetTop, insetBottom, line, shown, onBack, cta, children }: { step: number; acc: string; insetTop: number; insetBottom: number; line: string; shown: number; onBack: () => void; cta: ReactNode; children: ReactNode }) {
  const st = STEPS[step];
  const n = roundOf(step);
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, paddingTop: insetTop + SP.sm, paddingHorizontal: SIDE, paddingBottom: insetBottom + SP.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, height: HIT }}>
          <Tap onPress={onBack} accessibilityLabel="Back" style={{ width: HIT, height: HIT, borderWidth: 2, borderColor: F.rope, backgroundColor: F.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={20} color={F.chalk} tint={0} strokeWidth={2.2} />
          </Tap>
          <MeterBar pct={n / CHAPTERS} segments={CHAPTERS} height={12} accent={acc} accessibilityLabel={`Round ${n} of ${CHAPTERS}`} style={{ flex: 1, alignSelf: 'center' }} />
          <Txt face="label" w={600} size={15} ls={0.06} color={acc} align="right" style={{ minWidth: 40 }}>{`${two(n)}/${CHAPTERS}`}</Txt>
        </View>

        <View accessibilityRole="header" style={{ marginTop: SP.lg, gap: SP.xs }}>
          <RoundStamp label={`Round ${two(n)}`} tone="accent" accent={acc} size="sm" />
          <Txt face="display" size={36} lh={1.12} fit>{st.t ?? ''}</Txt>
        </View>

        <CoachShout accent={acc} portrait={44} style={{ marginTop: SP.md }}>
          {/* The whole line holds its room from the start, so nothing jumps while REI types. */}
          <Txt size={15} w={500} lh={1.4} color={F.arena} accessibilityLabel={line}>
            {line.slice(0, shown)}
            <Txt size={15} w={500} color="transparent">{line.slice(shown)}</Txt>
          </Txt>
        </CoachShout>

        <ScrollView style={{ flex: 1, marginTop: SP.sm, marginHorizontal: -SIDE }} contentContainerStyle={{ paddingHorizontal: SIDE, paddingTop: SP.sm, paddingBottom: SP.xxl, gap: SP.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {cta ? <View style={{ marginTop: SP.sm }}>{cta}</View> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

type SetFn = <K extends keyof Intake>(k: K, v: Intake[K]) => void;
type StepProps = { d: Intake; set: SetFn; acc: string };

function Block({ i = 0, label = '', right, acc, children }: { i?: number; label?: string; right?: string; acc: string; children: ReactNode }) {
  return (
    <Rise delay={220 + i * 80}>
      <FieldLabel label={label} right={right} acc={acc} />
      {children}
    </Rise>
  );
}

function NameStep({ d, set, acc }: StepProps) {
  const textSize = useStore(s => s.settings.textSize);
  const ok = !!d.name.trim();
  const id = ok ? `REI-${d.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6).padEnd(3, 'X')}-0001` : '— — —';
  return (
    <View style={{ gap: SP.md, paddingTop: SP.sm }}>
      <Rise delay={300}>
        <TextInput
          value={d.name}
          onChangeText={v => set('name', v)}
          placeholder="Your name"
          placeholderTextColor={C.ghost}
          accessibilityLabel="Your name"
          maxLength={20}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          keyboardAppearance="dark"
          style={{ fontFamily: fontFamily('display'), fontSize: 44 * textSize, height: 64 * textSize, color: F.chalk, padding: 0 }}
        />
        <View style={{ height: 4, backgroundColor: F.rope }}>
          <View style={{ height: 4, width: `${Math.min(100, d.name.length * 12)}%`, backgroundColor: acc }} />
        </View>
      </Rise>
      <Rise delay={420} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md }}>
        <Txt face="label" w={600} size={12} ls={0.14} color={F.smoke}>FIGHTER ID</Txt>
        <Txt face="label" w={600} size={12} ls={0.14} color={ok ? acc : F.smoke}>{id}</Txt>
      </Rise>
    </View>
  );
}

function IdealStep({ d, patch, acc }: { d: Intake; patch: (o: Partial<Intake>) => void; acc: string }) {
  const own = d.arch === 'none';
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.md, paddingRight: SHADOW }}>
      {ARCHETYPES.map((a, i) => {
        const sel = d.arch === a.id;
        return (
          <Rise key={a.id} delay={200 + i * 70} style={{ width: '46%', flexGrow: 1 }}>
            <Tap
              onPress={() => patch({ arch: a.id, goal: a.goal, targetTouched: false, disc: { Hypertrophy: a.disc.includes('Hypertrophy'), Strength: a.disc.includes('Strength'), Calisthenics: a.disc.includes('Calisthenics'), Running: a.disc.includes('Running') } })}
              accessibilityLabel={`${a.name}. ${a.ref}. ${a.spec}`} accessibilityState={{ selected: sel }}
              style={[{ minHeight: 176, padding: SP.md, justifyContent: 'space-between', overflow: 'hidden' }, tile(sel, acc)]}
            >
              <View pointerEvents="none" style={{ position: 'absolute', right: -12, top: 30, opacity: sel ? 0.4 : 0.1 }}>
                <Icon name={a.icon} size={88} color={sel ? acc : F.chalk} tint={0} strokeWidth={1.3} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt face="label" w={600} size={12} ls={0.14} color={F.smoke}>{`TYPE ${two(i + 1)}`}</Txt>
                <Picked on={sel} acc={acc} />
              </View>
              <View>
                <Txt face="display" size={22} lh={1.2} fit>{a.name.toUpperCase()}</Txt>
                <Txt size={13} w={500} color={C.sub}>{a.ref}</Txt>
                <View style={{ gap: SP.xs, marginTop: SP.sm }}>
                  {(['POW', 'SPD', 'SIZ'] as const).map((l, j) => (
                    <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Txt face="label" w={600} size={12} ls={0.1} color={F.smoke} style={{ width: 28 }}>{l}</Txt>
                      <View style={{ flex: 1, height: 6, backgroundColor: F.rope }}>
                        <View style={{ height: 6, width: `${a.bars[j]}%`, backgroundColor: sel ? acc : F.smoke }} />
                      </View>
                    </View>
                  ))}
                </View>
                <Txt face="label" w={600} size={12} ls={0.08} color={F.smoke} numberOfLines={1} style={{ marginTop: SP.sm }}>{a.spec}</Txt>
              </View>
            </Tap>
          </Rise>
        );
      })}
      <Rise delay={750} style={{ width: '100%' }}>
        <Tap
          onPress={() => !own && patch({ arch: 'none', targetTouched: false })}
          accessibilityLabel="None. My own vision. Describe it in your goal." accessibilityState={{ selected: own }}
          style={[{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 64, paddingVertical: SP.md, paddingHorizontal: SP.md }, tile(own, acc)]}
        >
          <Icon name="profile" size={26} color={own ? acc : F.smoke} tint={0} strokeWidth={2} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt size={15.5} w={600}>None. My own vision.</Txt>
            <Txt size={13} color={C.sub} lh={1.35}>Describe it in your goal. I’ll build the plan around it.</Txt>
          </View>
          <Picked on={own} acc={acc} />
        </Tap>
      </Rise>
    </View>
  );
}

function VowStep({ d, set, acc }: StepProps) {
  return (
    <>
      <Block i={0} label="Mission" acc={acc}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.md, paddingRight: SHADOW, paddingBottom: SHADOW }}>
          {GOALS.map(g => {
            const sel = d.goal === g.id;
            return (
              <Tap
                key={g.id} onPress={() => set('goal', g.id)}
                accessibilityLabel={`${g.label}. ${g.sub}`} accessibilityState={{ selected: sel }}
                style={[{ width: '46%', flexGrow: 1, minHeight: 96, padding: SP.md, justifyContent: 'space-between', gap: SP.sm }, tile(sel, acc)]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt face="label" w={600} size={13} ls={0.14} color={sel ? acc : F.smoke}>{g.tag}</Txt>
                  <Picked on={sel} acc={acc} />
                </View>
                <View>
                  <Txt face="display" size={22} lh={1.2} fit>{g.label.toUpperCase()}</Txt>
                  <Txt size={13} color={C.sub} lh={1.3}>{g.sub}</Txt>
                </View>
              </Tap>
            );
          })}
        </View>
      </Block>
      <Block i={1} label="Deadline" right={shortDate(deadlineOf(d, new Date()), true)} acc={acc}>
        <Seg value={d.weeks} opts={[12, 16, 22, 30, 40].map(w => [w, `${w} wk`] as [number, string])} onPick={v => set('weeks', v)} acc={acc} />
      </Block>
      <Block i={2} label="Why it matters" right="I’ll quote this back" acc={acc}>
        <Field value={d.why} onChange={v => set('why', v)} placeholder="I’m tired of starting over every January." accessibilityLabel="Why it matters" acc={acc} />
      </Block>
    </>
  );
}

const SCRUB = {
  height: { label: 'HEIGHT', unit: 'cm', min: 140, max: 215, step: 1, dp: 0 },
  weight: { label: 'WEIGHT', unit: 'kg', min: 40, max: 160, step: 0.1, dp: 1 },
  bf: { label: 'BODY FAT · A GUESS', unit: '%', min: 5, max: 40, step: 0.5, dp: 1 },
  targetWeight: { label: 'TARGET WEIGHT', unit: 'kg', min: 40, max: 160, step: 0.1, dp: 1 },
  targetBf: { label: 'TARGET BODY FAT', unit: '%', min: 5, max: 40, step: 0.5, dp: 1 },
} as const;

function ScrubOf({ k, d, onChange, acc }: { k: keyof typeof SCRUB; d: Intake; onChange: (v: number) => void; acc: string }) {
  const c = SCRUB[k];
  return <Scrub label={c.label} unit={c.unit} value={d[k]} step={c.step} min={c.min} max={c.max} dp={c.dp} onChange={onChange} acc={acc} />;
}

const stepper = (d: Intake, set: SetFn, k: 'age' | 'wake' | 'bed' | 'steps', label: string, unit: string, step: number, min: number, max: number, show?: (v: number) => string) => {
  const v = d[k], clamp = (x: number) => Math.min(max, Math.max(min, +x.toFixed(2)));
  return { label, unit, value: show ? show(v) : String(v), minus: () => set(k, clamp(v - step)), plus: () => set(k, clamp(v + step)) };
};

/** A best from the fight record: "—" until they set it; the first tap starts from what's typical for them. */
const best = (d: Intake, set: SetFn, k: BestKey, label: string, unit: string, step: number, min: number, max: number, show?: (v: number) => string) => {
  const given = gaveBest(d, k), v = d[k];
  const clamp = (x: number) => Math.min(max, Math.max(min, +x.toFixed(2)));
  const go = (dv: number) => {
    if (!given) {
      set(k, suggestedBest(k, d));
      set('tested', { ...d.tested, [k]: true });
    } else set(k, clamp(v + dv));
  };
  return { label, unit, value: given ? (show ? show(v) : String(v)) : '—', minus: () => go(-step), plus: () => go(step) };
};

function BodyStep({ d, set, acc }: StepProps) {
  return (
    <>
      <Block i={0} label="Biology" right="For the math" acc={acc}><Seg value={d.sex} opts={[['Male', 'Male'], ['Female', 'Female']]} onPick={v => set('sex', v)} acc={acc} /></Block>
      <Block i={1} acc={acc}><ScrubOf k="weight" d={d} onChange={v => set('weight', v)} acc={acc} /></Block>
      <Block i={2} acc={acc}><ScrubOf k="height" d={d} onChange={v => set('height', v)} acc={acc} /></Block>
      <Block i={3} acc={acc}><ScrubOf k="bf" d={d} onChange={v => set('bf', v)} acc={acc} /></Block>
      <Block i={4} acc={acc}><Nums items={[stepper(d, set, 'age', 'AGE', 'yrs', 1, 14, 80)]} /></Block>
    </>
  );
}

function TargetStep({ d, patch, acc }: { d: Intake; patch: (o: Partial<Intake>) => void; acc: string }) {
  const r = weeklyRate(d), total = r * d.weeks, fast = (Math.abs(r) / d.weight) * 100 > 1;
  const stats: [string, string, string][] = [
    ['CHANGE · KG', `${total > 0 ? '+' : ''}${total.toFixed(1)}`, F.chalk],
    ['PER WEEK · KG', `${r > 0 ? '+' : ''}${r.toFixed(2)}`, fast ? C.warn : acc],
    ['LEAN MASS · KG', (d.targetWeight * (1 - d.targetBf / 100)).toFixed(1), F.chalk],
  ];
  return (
    <>
      <Rise delay={250} style={{ flexDirection: 'row', gap: 2 }}>
        {stats.map(([l, v, c]) => (
          <View key={l} accessible accessibilityLabel={`${l.replace(' · KG', '')} ${v} kilograms`} style={{ flex: 1, backgroundColor: F.canvas, paddingVertical: SP.md, paddingHorizontal: SP.md }}>
            <Txt face="display" lean={false} size={28} lh={1.2} color={c} fit>{v}</Txt>
            <Txt face="label" w={600} size={12} ls={0.1} color={F.smoke} numberOfLines={1}>{l}</Txt>
          </View>
        ))}
      </Rise>
      <Block i={1} acc={acc}><ScrubOf k="targetWeight" d={d} onChange={v => patch({ targetWeight: v, targetTouched: true })} acc={acc} /></Block>
      <Block i={2} acc={acc}><ScrubOf k="targetBf" d={d} onChange={v => patch({ targetBf: v, targetTouched: true })} acc={acc} /></Block>
      <Rise delay={550}>
        <FieldLabel label="The road" right={`${d.weeks} weeks`} acc={acc} />
        <View accessible accessibilityLabel={`From ${d.weight} kilograms at ${d.bf} percent now to ${d.targetWeight} kilograms at ${d.targetBf} percent by ${shortDate(deadlineOf(d, new Date()))}`} style={{ backgroundColor: F.canvas, padding: SP.md, gap: SP.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <CutShape width={18} height={14} fill={acc} />
            <View style={{ flex: 1, height: 4, backgroundColor: acc }} />
            <CutShape width={22} height={16} fill={F.arena} stroke={F.chalk} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md }}>
            <Txt face="label" w={600} size={13} ls={0.08} color={F.smoke}>{`NOW · ${d.weight} KG · ${d.bf}%`}</Txt>
            <Txt face="label" w={600} size={13} ls={0.08} color={F.chalk} align="right">{`${shortDate(deadlineOf(d, new Date()))} · ${d.targetWeight} KG · ${d.targetBf}%`}</Txt>
          </View>
        </View>
      </Rise>
    </>
  );
}

function TrainStep({ d, set, acc }: StepProps) {
  const rest = 7 - d.sessions;
  return (
    <>
      <Block i={0} label="Sessions a week" right={`${rest} rest day${rest === 1 ? '' : 's'}`} acc={acc}><Seg value={d.sessions} opts={[2, 3, 4, 5, 6, 7].map(n => [n, String(n)] as [number, string])} onPick={v => set('sessions', v)} acc={acc} /></Block>
      <Block i={1} label="Session length" right="Minutes" acc={acc}><Seg value={d.length} opts={[30, 45, 60, 75, 90].map(n => [n, String(n)] as [number, string])} onPick={v => set('length', v)} acc={acc} /></Block>
      <Block i={2} label="When I expect you" acc={acc}><Seg value={d.time} opts={[['Morning', 'Morning', '06:30'], ['Midday', 'Midday', '12:30'], ['Evening', 'Evening', '18:30'], ['Night', 'Night', '21:00']]} onPick={v => set('time', v)} acc={acc} /></Block>
      <Block i={3} label="Training age" acc={acc}><Seg value={d.exp} opts={[['New', 'New'], ['1–3 yrs', '1–3 yrs'], ['3+ yrs', '3+ yrs']]} onPick={v => set('exp', v)} acc={acc} /></Block>
      <Block i={4} label="Equipment" acc={acc}><Chips opts={['Full gym', 'Home dumbbells', 'Barbell + rack', 'Pull-up bar', 'Bands', 'Bodyweight only']} isOn={o => on(d.equip, o)} onPick={o => set('equip', toggle(d.equip, o))} acc={acc} /></Block>
      <Block i={5} label="Disciplines" acc={acc}><Chips opts={['Hypertrophy', 'Strength', 'Calisthenics', 'Running']} isOn={o => on(d.disc, o)} onPick={o => set('disc', toggle(d.disc, o))} acc={acc} /></Block>
    </>
  );
}

function LifeStep({ d, set, acc }: StepProps) {
  return (
    <>
      <Block i={0} label="Work" acc={acc}><Seg value={d.job} opts={[['Desk', 'Desk'], ['On my feet', 'On my feet'], ['Physical', 'Physical']]} onPick={v => set('job', v)} acc={acc} /></Block>
      <Block i={1} label="Sleep" right={`${sleepHours(d).toFixed(1)} h`} acc={acc}><Nums items={[stepper(d, set, 'wake', 'WAKE', '', 15, 0, 1425, clockOf), stepper(d, set, 'bed', 'BED', '', 15, 0, 1425, clockOf)]} /></Block>
      <Block i={2} label="Stress level" acc={acc}><Seg value={d.stress} opts={[[1, '1', 'calm'], [2, '2'], [3, '3'], [4, '4'], [5, '5', 'max']]} onPick={v => set('stress', v)} acc={acc} /></Block>
      <Block i={3} acc={acc}><Nums items={[stepper(d, set, 'steps', 'DAILY STEPS', '', 1000, 2000, 25000, v => v.toLocaleString('en-US'))]} /></Block>
    </>
  );
}

function KitchenStep({ d, set, acc }: StepProps) {
  return (
    <>
      <Block i={0} label="Diet" acc={acc}><Chips opts={['Non-veg', 'Eggetarian', 'Vegetarian', 'Vegan', 'Jain', 'Pescatarian']} isOn={o => d.diet === o} onPick={o => set('diet', o)} acc={acc} /></Block>
      <Block i={1} label="What you usually eat" acc={acc}><Chips opts={['Indian', 'Western', 'East Asian', 'Mediterranean', 'Mixed']} isOn={o => on(d.cuisine, o)} onPick={o => set('cuisine', toggle(d.cuisine, o))} acc={acc} /></Block>
      <Block i={2} label="Meals a day" acc={acc}><Seg value={d.meals} opts={[2, 3, 4, 5, 6].map(n => [n, String(n)] as [number, string])} onPick={v => set('meals', v)} acc={acc} /></Block>
      <Block i={3} label="Cooking" acc={acc}><Seg value={d.cook} opts={[['I cook', 'I cook'], ['Sometimes', 'Sometimes'], ['Never', 'Never']]} onPick={v => set('cook', v)} acc={acc} /></Block>
      <Block i={4} label="Alcohol" acc={acc}><Seg value={d.alcohol} opts={[['None', 'None'], ['Weekends', 'Weekends'], ['Often', 'Often']]} onPick={v => set('alcohol', v)} acc={acc} /></Block>
    </>
  );
}

function FuelStep({ d, set, acc }: StepProps) {
  const c = fuel(d), g = goalOf(d);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const v = new Animated.Value(0);
    const id = v.addListener(({ value }) => setCount(value));
    Animated.timing(v, { toValue: 1, duration: 1300, delay: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, []);
  const veg = ['Vegetarian', 'Vegan', 'Jain'].includes(d.diet);
  const macros: [string, number, string, string, number][] = [
    ['Protein', c.p, acc, `${(c.p / d.weight).toFixed(1)} g per kg. ${veg ? 'Paneer, dal, tofu, whey. Every meal.' : 'Non-negotiable. This keeps the muscle.'}`, 4],
    ['Carbs', c.c, C.carbs, `Around training. ${d.time === 'Morning' ? 'Breakfast after the session.' : `Bigger meal before ${trainTime(d)}.`}`, 4],
    ['Fat', c.f, C.fat, d.alcohol === 'None' ? 'Hormones need it. Do not go lower.' : `Alcohol comes out of this budget. ${d.alcohol} is noted.`, 9],
  ];
  const adj = `${c.adj > 0 ? '+' : ''}${Math.round(c.adj * 100)}% · ${g.tag}`;
  const math = `BMR ${c.bmr.toLocaleString('en-US')} × ${c.af.toFixed(2)} ACTIVITY ${c.adj > 0 ? '+' : '−'}${Math.abs(Math.round(c.adj * 100))}%${d.kcalAdj ? ` ${d.kcalAdj > 0 ? '+' : '−'}${Math.abs(d.kcalAdj)} YOU` : ''}`;
  const nudge = (dv: number) => set('kcalAdj', Math.max(-600, Math.min(600, d.kcalAdj + dv)));
  return (
    <View style={{ gap: SP.lg }}>
      <Rise delay={250}>
        <FieldLabel label="Daily fuel" right={adj} acc={acc} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SP.md }}>
          <View accessible accessibilityLabel={`${c.kcal} calories a day`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm, flexShrink: 1 }}>
            <Txt face="display" size={72} lh={1.08} color={acc}>{Math.round(c.kcal * count).toLocaleString('en-US')}</Txt>
            <Txt face="label" w={600} size={18} ls={0.03} color={F.smoke}>KCAL</Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: SP.sm, paddingBottom: SP.sm }}>
            {([['−', -50, 'Lower by 50 calories'], ['+', 50, 'Raise by 50 calories']] as const).map(([l, dv, say]) => (
              <Tap key={l} onPress={() => nudge(dv)} accessibilityLabel={say} style={{ width: HIT, height: HIT, borderWidth: 2, borderColor: F.rope, backgroundColor: F.canvas, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={22} w={600} lh={1.15}>{l}</Txt>
              </Tap>
            ))}
          </View>
        </View>
        <Txt face="label" w={600} size={12} ls={0.08} color={F.smoke} style={{ marginTop: SP.xs }}>{math}</Txt>
      </Rise>
      <View style={{ gap: SP.sm }}>
        {macros.map(([label, grams, color, note, perG], i) => (
          <Rise key={label} delay={400 + i * 100} style={{ padding: SP.md, gap: SP.sm, backgroundColor: F.canvas }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.md }}>
              <Txt face="labelItalic" w={600} size={15} ls={0.12}>{label.toUpperCase()}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                <Txt face="display" lean={false} size={28} lh={1.15}>{Math.round(grams * count)}</Txt>
                <Txt face="label" w={600} size={14} color={F.smoke}>G</Txt>
              </View>
            </View>
            <MeterBar pct={(grams * perG) / Math.max(1, c.kcal)} height={8} accent={color} accessibilityLabel={`${label} ${grams} grams, ${Math.round(((grams * perG) / Math.max(1, c.kcal)) * 100)} percent of calories`} />
            <Txt size={13} color={C.sub} lh={1.4}>{note}</Txt>
          </Rise>
        ))}
      </View>
    </View>
  );
}

function PowerStep({ d, set, acc }: StepProps) {
  return (
    <Block i={0} label="Current bests" right="Tap + to set · skip the rest" acc={acc}>
      <Nums items={[
        best(d, set, 'bench', 'BENCH', 'kg', 2.5, 0, 300), best(d, set, 'squat', 'SQUAT', 'kg', 2.5, 0, 400),
        best(d, set, 'dead', 'DEADLIFT', 'kg', 2.5, 0, 450), best(d, set, 'pullups', 'PULL-UPS', 'reps', 1, 0, 60),
        best(d, set, 'run5k', '5K RUN', '', 15, 900, 3600, mmss),
      ]} />
    </Block>
  );
}

function WeakStep({ d, set, acc }: StepProps) {
  return (
    <>
      <Block i={0} label="What usually makes you quit" acc={acc}><Chips opts={['Work gets busy', 'Weekends', 'Late-night snacking', 'Low motivation', 'Travel', 'Social eating', 'Boredom', 'Bad sleep']} isOn={o => on(d.quit, o)} onPick={o => set('quit', toggle(d.quit, o))} acc={acc} /></Block>
      <Block i={1} label="Injuries" right="I plan around them" acc={acc}><Chips opts={['None', 'Lower back', 'Knee', 'Shoulder', 'Wrist', 'Elbow', 'Ankle']} isOn={o => on(d.injuries, o)} onPick={o => set('injuries', toggle(d.injuries, o))} acc={acc} /></Block>
      <Block i={2} label="Never forget" acc={acc}><Field value={d.note} onChange={v => set('note', v)} placeholder="Night shifts on Thursdays" accessibilityLabel="Anything else I should never forget" acc={acc} /></Block>
    </>
  );
}

/** How REI talks between rounds, and whether it may message and speak. */
function ToneStep({ d, set, acc }: StepProps) {
  return (
    <>
      <View style={{ gap: SP.md, paddingRight: SHADOW }}>
        {TONES.map((o, i) => {
          const sel = d.tone === o.id;
          return (
            <Rise key={o.id} delay={200 + i * 80}>
              <Tap
                onPress={() => set('tone', o.id)} accessibilityLabel={`${o.id}. ${o.sub}`} accessibilityState={{ selected: sel }}
                style={[{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 64, paddingVertical: SP.md, paddingHorizontal: SP.md }, tile(sel, acc)]}
              >
                <Icon name={o.icon} size={26} color={sel ? acc : F.smoke} tint={0} strokeWidth={2} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt face="display" size={20} lh={1.2}>{o.id.toUpperCase()}</Txt>
                  <Txt size={13} color={C.sub} lh={1.35}>{o.sub}</Txt>
                </View>
                <Picked on={sel} acc={acc} />
              </Tap>
            </Rise>
          );
        })}
      </View>
      <Rise delay={500}>
        <FieldLabel label="How that sounds" right="2 sessions missed" acc={acc} />
        <View style={{ backgroundColor: F.canvas, borderLeftWidth: 4, borderLeftColor: acc, paddingVertical: SP.md, paddingHorizontal: SP.lg }}>
          <Txt size={15.5} w={500} lh={1.45} color={C.textSoft}>{toneSample(d.tone, d)}</Txt>
        </View>
      </Rise>
      <Rise delay={600}>
        <FieldLabel label="Between rounds" acc={acc} />
        <View style={{ gap: 2 }}>
          <ToggleRow icon="bell" label="Check-ins" sub="I message you when you slip. Late session, low protein, bedtime." on={d.nudge} onPress={() => set('nudge', !d.nudge)} acc={acc} />
          <ToggleRow icon="voice" label="Voice replies" sub="I speak replies out loud in voice mode." on={d.speak} onPress={() => set('speak', !d.speak)} acc={acc} />
        </View>
      </Rise>
    </>
  );
}

/**
 * Who's in their corner, and which world it wears. Tapping a voice picks them, repaints the rounds
 * in their world and plays their hello in their own voice; the world can then be changed on its own.
 * Voices that haven't arrived show the line instead.
 */
function CornerStep({ d, set, patch, acc }: { d: Intake; set: SetFn; patch: (o: Partial<Intake>) => void; acc: string }) {
  const voice = useStore(s => s.settings.voice);
  const [playing, setPlaying] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const speaker = useRef<{ stop: () => void } | null>(null);
  /** Each tap gets a number; a clip that finishes loading after a newer tap is dropped. */
  const seq = useRef(0);
  useEffect(() => () => {
    seq.current++;
    speaker.current?.stop();
  }, []);
  const cur = characterOf(d.character);
  useEffect(() => {
    if (d.name.trim()) void prefetchGreetings(d.name.trim());
  }, [d.name]);

  const stop = () => {
    seq.current++;
    speaker.current?.stop();
    speaker.current = null;
    setPlaying(null);
  };

  const choose = async (id: string) => {
    if (playing === id) return stop();
    stop();
    const c = characterOf(id);
    patch({ character: id, theme: c.theme });
    if (!hasVoice(c)) {
      setNote(`${c.name}’s voice is on its way. Until then I speak for them in my own voice.`);
      return;
    }
    setNote('');
    const mine = seq.current;
    setPlaying(id);
    try {
      const sp = await playGreeting(id, d.name, voice, () => mine === seq.current && setPlaying(null));
      if (mine !== seq.current) {
        sp.stop();
        return;
      }
      speaker.current = sp;
      if (!sp.premium) setNote('Premium voices are off right now, so this used the iPhone’s voice.');
    } catch {
      if (mine === seq.current) setPlaying(null);
    }
  };

  return (
    <>
      <Block i={0} label="Corner voice" right={playing ? 'Playing' : 'Tap to hear'} acc={acc}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, paddingRight: SHADOW, paddingBottom: SHADOW }}>
          {CHARACTERS.map((c, i) => {
            const sel = (d.character || 'rei') === c.id, voiced = hasVoice(c), talking = playing === c.id;
            // Unpicked cards hint at the world they bring; the picked one wears the world on screen.
            const col = sel ? acc : worldAccent(c.theme);
            return (
              <Rise key={c.id} delay={200 + i * 50} style={{ width: '30%', flexGrow: 1 }}>
                <Tap
                  onPress={() => void choose(c.id)}
                  accessibilityLabel={`${c.name}, ${c.series}. ${voiced ? (talking ? 'Playing. Tap to stop.' : 'Tap to hear.') : 'Voice coming soon.'}`} accessibilityState={{ selected: sel }}
                  style={[{ minHeight: 108, padding: SP.sm, justifyContent: 'space-between', gap: SP.sm }, tile(sel, acc)]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Icon name={talking ? 'voice' : c.icon} size={24} color={col} tint={0} strokeWidth={2} />
                    <Picked on={sel} acc={acc} />
                  </View>
                  <View>
                    <Txt face="display" size={21} lh={1.2} fit>{c.name.toUpperCase()}</Txt>
                    <Txt face="label" w={600} size={12} ls={0.06} color={talking ? col : F.smoke} numberOfLines={1}>{talking ? 'PLAYING' : voiced ? c.series.toUpperCase() : 'VOICE SOON'}</Txt>
                  </View>
                </Tap>
              </Rise>
            );
          })}
        </View>
      </Block>
      <Rise delay={650}>
        <FieldLabel label={`${cur.name} says`} acc={acc} />
        <View style={{ backgroundColor: F.canvas, borderLeftWidth: 4, borderLeftColor: acc, paddingVertical: SP.md, paddingHorizontal: SP.lg }}>
          <Txt size={15} w={500} lh={1.45} color={C.textSoft}>{`“${greeting(cur, d.name).replace(/\s*\[[^\]]*\]/g, '')}”`}</Txt>
        </View>
        <Txt size={13} color={note ? C.warn : C.sub} lh={1.4} style={{ marginTop: SP.sm }}>{note || 'Tap a card to hear them; tap again to stop. You can change your corner any time in Settings.'}</Txt>
      </Rise>
      <Block i={6} label="World" right={THEMES.find(t => t.id === d.theme)?.vibe} acc={acc}>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, paddingRight: SHADOW, paddingBottom: SHADOW }}>
          {THEMES.map(t => {
            const sel = d.theme === t.id;
            return (
              <Tap
                key={t.id} onPress={() => set('theme', t.id)}
                accessibilityRole="radio" accessibilityState={{ selected: sel, checked: sel }} accessibilityLabel={`${t.name}. ${t.vibe}`}
                style={[{ width: '30%', flexGrow: 1, minHeight: HIT + SP.xs, paddingHorizontal: SP.sm, flexDirection: 'row', alignItems: 'center', gap: SP.sm }, tile(sel, t.acc)]}
              >
                <CutShape width={20} height={14} fill={t.acc} />
                <Txt face="display" lean={false} size={17} lh={1.2} color={sel ? t.acc : F.chalk} fit style={{ flexShrink: 1 }}>{t.name.toUpperCase()}</Txt>
              </Tap>
            );
          })}
        </View>
      </Block>
    </>
  );
}

/** The fight contract: the vow, its terms, who witnessed it, and the slab you hold to sign. */
function PactStep({ d, acc, onSeal }: { d: Intake; acc: string; onSeal: () => void }) {
  const partner = characterOf(d.character);
  return (
    <View style={{ gap: SP.xl, paddingRight: SHADOW }}>
      <Rise delay={250} style={[{ backgroundColor: F.canvas, borderWidth: 2, borderColor: F.chalk, padding: SP.lg }, hard(acc)]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SP.md }}>
          <RoundStamp label="Fight contract" tone="accent" accent={acc} size="sm" />
          <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{`NO. 0001 · ${shortDate(new Date(), true)}`}</Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm, marginTop: SP.md }}>
          <Txt face="display" size={26} lh={1.2} color={acc} fit style={{ flexShrink: 1 }}>{nameOf(d).toUpperCase()}</Txt>
          <Txt face="labelItalic" w={600} size={14} ls={0.12} color={F.smoke}>VS</Txt>
          <Txt face="display" size={26} lh={1.2} color={F.rival}>EXCUSES</Txt>
        </View>
        <Txt size={14} w={500} color={C.sub} style={{ marginTop: SP.md }}>I, <Txt size={14} w={600}>{nameOf(d)}</Txt>, will</Txt>
        <Txt size={20} w={600} lh={1.3} style={{ marginTop: 2 }}>{vowSentence(d, new Date())}</Txt>
        <View style={{ marginTop: SP.md, borderTopWidth: 2, borderTopColor: F.rope }}>
          {pactRows(d).map(([k, v]) => (
            <View key={k} accessible accessibilityLabel={`${k}: ${v}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: SP.md, paddingVertical: SP.sm, borderBottomWidth: 2, borderBottomColor: C.line2 }}>
              <Txt face="label" w={600} size={12} ls={0.14} color={F.smoke}>{k}</Txt>
              <Txt size={14} w={500} color={C.textSoft} align="right" style={{ flex: 1 }}>{v}</Txt>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginTop: SP.md }}>
          <Icon name={partner.icon} size={18} color={acc} tint={0} strokeWidth={2} />
          <Txt size={13} w={500} color={C.sub}>{`Witnessed by ${partner.name}, your corner`}</Txt>
        </View>
      </Rise>
      <Rise delay={500}><HoldSeal acc={acc} onSeal={onSeal} /></Rise>
    </View>
  );
}

/** Signed. The walk out to the ring: the card for tonight, the tale of the tape, REI's last word, and the way in. */
function Walkout({ d, acc, insetTop, insetBottom, onEnter }: { d: Intake; acc: string; insetTop: number; insetBottom: number; onEnter: () => void }) {
  const { height: H } = useWindowDimensions();
  const c = fuel(d);
  const partner = characterOf(d.character);
  const [stamp] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(stamp, { toValue: 1, duration: 700, delay: 150, easing: Easing.bezier(0.2, 0.9, 0.3, 1), useNativeDriver: true }).start();
  }, [stamp]);
  const tape: [string, string][] = [['KCAL A DAY', c.kcal.toLocaleString('en-US')], ['G PROTEIN', String(c.p)], ['WEEKS', String(d.weeks)]];
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insetTop + SP.md, paddingHorizontal: SIDE, paddingBottom: insetBottom + SP.md }} showsVerticalScrollIndicator={false}>
      <Animated.View
        style={{
          alignSelf: 'flex-start', marginBottom: SP.md,
          opacity: stamp.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: stamp.interpolate({ inputRange: [0, 0.55, 0.75, 1], outputRange: [2.4, 0.94, 1.04, 1] }) }],
        }}
      >
        <RoundStamp label="Contract signed" />
      </Animated.View>
      <Rise delay={500} style={{ marginHorizontal: -SIDE }}>
        <VersusHeader
          name={nameOf(d)} sub={`${partner.name} in your corner`} rivalSub="Nothing taken yet"
          plate={{ big: 'DAY 1', small: `First bell ${trainTime(d)}` }} height={H < 740 ? 176 : 224} accent={acc}
        />
      </Rise>
      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: SP.xl, gap: SP.lg }}>
        <Rise delay={800}>
          <Txt face="display" size={40} lh={1.12}>THE RING IS YOURS.</Txt>
        </Rise>
        <Rise delay={950} style={{ flexDirection: 'row', gap: 2 }}>
          {tape.map(([k, v]) => (
            <View key={k} accessible accessibilityLabel={`${v} ${k.toLowerCase()}`} style={{ flex: 1, backgroundColor: F.canvas, paddingVertical: SP.md, paddingHorizontal: SP.md }}>
              <Txt face="display" lean={false} size={30} lh={1.2} color={acc} fit>{v}</Txt>
              <Txt face="label" w={600} size={12} ls={0.1} color={F.smoke} numberOfLines={1}>{k}</Txt>
            </View>
          ))}
        </Rise>
      </View>
      <Rise delay={1200} style={{ gap: SP.xl }}>
        <CoachShout accent={acc}>
          <Txt size={15} w={500} lh={1.4} color={F.arena}>{bondLine(d)}</Txt>
        </CoachShout>
        <Cta label="Walk out" icon="door" acc={acc} onPress={onEnter} />
      </Rise>
    </ScrollView>
  );
}
