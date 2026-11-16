// First run, after the account exists: setting up with REI. A quiet cover, fourteen short parts,
// the vow (hold to seal it), the first-day page and the welcome into the app.
// Sumi & Hanko look: night washi, sumi cards in a quiet line, REI's red seal, the chosen world's colour for data.
// Numbers, wording and the order of the parts come from @rei/shared (onboarding.ts); this file is the page.
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
import { CoachShout, MeterBar, RoundStamp, VersusHeader } from '../components/fight';
import { Icon } from '../components/icons';
import { BrushRule, ReiSeal } from '../components/ink';
import { ChapterCard, EnterFx, Flash, HoldSeal, markArrival } from '../components/onboarding/fx';
import { Atmosphere, Chips, Cta, Field, FieldLabel, Nums, Picked, Rise, Scrub, Seg, tile, ToggleRow } from '../components/onboarding/kit';
import { Tap, Txt } from '../components/ui';
import { C, DEFAULT_EMBLEM, EMBLEMS, F, fontFamily, HIT, RADIUS, SP, THEMES, warnColor } from '../lib/theme';
import { playGreeting, prefetchGreetings } from '../lib/greetings';
import { useStore } from '../state/store';

const DRAFT_KEY = 'rei-onboarding-draft';
/** Screen side padding (the page gutter). */
const SIDE = SP.xxl;
const idx = (id: string) => STEPS.findIndex(s => s.id === id);
const on = (o: Record<string, boolean>, k: string) => !!o[k];
const toggle = (o: Record<string, boolean>, k: string) => {
  if (k === 'None') return o.None ? {} : { None: true };
  const n = { ...o };
  delete n.None;
  n[k] = !n[k];
  return n;
};
/** Part number of a step (the cover is 0). */
const partOf = (step: number) => STEPS.slice(1, step + 1).filter(x => x.t).length;
const two = (n: number) => String(n).padStart(2, '0');
/** "06 MAR 2027" from the shared helpers, in sentence case: "06 Mar 2027". */
const calmDate = (text: string) => text.replace(/\b([A-Z])([A-Z]{2})\b/g, (_, a: string, b: string) => a + b.toLowerCase());
/** A card: sumi fill in a quiet line. */
const CARD = { backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card } as const;
const worldAccent = (id: string) => THEMES.find(t => t.id === id)?.acc ?? THEMES[0].acc;

export default function Onboarding() {
  const s = useStore();
  const insets = useSafeAreaInsets();

  const [d, setD] = useState<Intake>(() => ({ ...DEFAULT_INTAKE, name: s.profile.name || '' }));
  const [step, setStep] = useState(0);
  const [card, setCard] = useState<{ to: number; key: number } | null>(null);
  const [flash, setFlash] = useState(false);
  const [entering, setEntering] = useState(false);
  /** How much of REI's line is shown, for which part (a new part starts from nothing). */
  const [typed, setTyped] = useState({ key: '', n: 0 });
  const loaded = useRef(false);
  /** The step change a title card performs while it covers the page. */
  const pendingArrive = useRef<() => void>(() => {});

  const st = STEPS[step];
  const theme = THEMES.find(t => t.id === d.theme) ?? THEMES[0];
  const { acc, bg } = theme;
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => setD(cur => ({ ...cur, [k]: v }));
  const patch = (o: Partial<Intake>) => setD(cur => ({ ...cur, ...o }));

  // Once sealed, the account counts as onboarded; keep this flow on screen until the welcome finishes.
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

  // REI types its line for each part (and again when the chosen look or voice changes).
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

  // Past the name part, every voice's greeting with their name is made in the background,
  // so the voice part plays it the moment a card is tapped.
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

  // The chosen world's own art behind the parts, barely there.
  const emblem = EMBLEMS[d.theme]?.find(e => e.id === DEFAULT_EMBLEM[d.theme])?.source ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: bg, overflow: 'hidden' }}>
      <Atmosphere acc={acc} />
      {emblem && st.t ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 90 }]}>
          <Image source={emblem} style={{ width: 280, height: 280, opacity: 0.05 }} contentFit="contain" />
        </View>
      ) : null}

      {st.id === 'boot' ? <Cover acc={acc} name={d.name.trim()} email={s.account.email} onBegin={() => go(1)} onSignOut={() => void s.signOut()} insetTop={insets.top} insetBottom={insets.bottom} /> : null}

      {st.t ? (
        <Part
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
          {st.id === 'partner' ? <VoiceStep d={d} set={set} patch={patch} acc={acc} /> : null}
          {st.id === 'life' ? <LifeStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'fuel' ? <FuelStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'power' ? <PowerStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'weak' ? <WeakStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'tone' ? <ToneStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'pact' ? <PactStep d={d} acc={acc} onSeal={seal} /> : null}
        </Part>
      ) : null}

      {st.id === 'done' ? <FirstDay d={d} acc={acc} insetTop={insets.top} insetBottom={insets.bottom} onEnter={enter} /> : null}

      {card ? (
        <ChapterCard
          key={card.key} n={partOf(card.to)} t={STEPS[card.to].t ?? ''} total={CHAPTERS} acc={acc} bg={bg}
          onSwap={() => pendingArrive.current()} onEnd={() => setCard(null)}
        />
      ) : null}
      {flash ? <Flash onEnd={() => setFlash(false)} /> : null}
      {entering ? <EnterFx name={nameOf(d)} acc={acc} bg={bg} onEnd={entered} /> : null}
    </View>
  );
}

/** The cover: REI's seal, the name, what is about to happen, and the way in. */
function Cover({ acc, name, email, onBegin, onSignOut, insetTop, insetBottom }: { acc: string; name: string; email: string | null; onBegin: () => void; onSignOut: () => void; insetTop: number; insetBottom: number }) {
  const { height: H } = useWindowDimensions();
  const small = H < 740;
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insetTop + SP.md, paddingHorizontal: SIDE, paddingBottom: insetBottom + SP.md }} showsVerticalScrollIndicator={false}>
      <Rise delay={100} from={0} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SP.md, minHeight: 24 }}>
        <Txt face="mono" size={12} lh={1.35} color={F.smoke}>Setting up</Txt>
        <Txt face="mono" raw size={12} lh={1.35} color={F.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{email ?? 'Signed in'}</Txt>
      </Rise>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SP.huge }}>
        <Rise delay={250}><ReiSeal size={small ? 72 : 96} ground={F.arena} /></Rise>
        <Rise delay={450} style={{ alignItems: 'center', marginTop: SP.xxl, gap: SP.xs }}>
          <Txt face="display" exact size={small ? 44 : 56} lh={1.15} align="center" accessibilityLabel="REI">REI</Txt>
          <Txt face="voice" size={17} lh={1.5} color={F.smoke} align="center">{name ? `Welcome, ${name}.` : 'Your coach. Every day.'}</Txt>
        </Rise>
        <Rise delay={600} style={{ alignSelf: 'center', width: 160, marginTop: SP.xxl }}><BrushRule long height={6} /></Rise>
        <Rise delay={750} style={{ marginTop: SP.xxl, gap: SP.md, maxWidth: 320 }}>
          <Txt face="voice" size={17} lh={1.5} align="center">You’re in. Good. I don’t do generic.</Txt>
          <Txt face="voice" size={17} lh={1.5} color={F.smoke} align="center">{`${CHAPTERS} short parts and I’ll know exactly who you want to become, and when you’re lying to yourself about it.`}</Txt>
        </Rise>
      </View>
      <Rise delay={950} style={{ gap: SP.sm }}>
        <Txt face="mono" raw size={12} lh={1.35} color={acc} align="center">{`${CHAPTERS} parts · then your vow`}</Txt>
        <Cta label="Begin" acc={acc} onPress={onBegin} />
        <Tap onPress={onSignOut} accessibilityLabel="Not you? Sign out" style={{ minHeight: HIT, alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={15} w={500} lh={1.4} color={C.sub}>Not you? Sign out</Txt>
        </Tap>
      </Rise>
    </ScrollView>
  );
}

/** The frame around every part: back, the progress stroke, the part's number and name, REI's typed line, the answers, and the one button. */
function Part({ step, acc, insetTop, insetBottom, line, shown, onBack, cta, children }: { step: number; acc: string; insetTop: number; insetBottom: number; line: string; shown: number; onBack: () => void; cta: ReactNode; children: ReactNode }) {
  const st = STEPS[step];
  const n = partOf(step);
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, paddingTop: insetTop + SP.sm, paddingHorizontal: SIDE, paddingBottom: insetBottom + SP.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, height: HIT }}>
          <Tap onPress={onBack} accessibilityLabel="Back" style={{ width: HIT, height: HIT, borderWidth: 1, borderColor: F.rule, borderRadius: RADIUS.sm, backgroundColor: F.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={20} color={F.chalk} tint={0} strokeWidth={1.8} />
          </Tap>
          <MeterBar pct={n / CHAPTERS} height={12} accent={acc} accessibilityLabel={`Part ${n} of ${CHAPTERS}`} style={{ flex: 1, alignSelf: 'center' }} />
        </View>

        <View accessibilityRole="header" style={{ marginTop: SP.lg, gap: SP.xs }}>
          <Txt face="mono" raw size={12} lh={1.35} color={acc}>{`Part ${n} of ${CHAPTERS}`}</Txt>
          <Txt face="display" exact size={30} lh={1.2} fit>{st.t ?? ''}</Txt>
        </View>

        <CoachShout accent={acc} portrait={28} style={{ marginTop: SP.md, paddingTop: SP.md, paddingBottom: SP.lg, gap: SP.sm }}>
          {/* The whole line holds its room from the start, so nothing jumps while REI types. */}
          <Txt face="voice" size={16} lh={1.5} accessibilityLabel={line}>
            {line.slice(0, shown)}
            <Txt face="voice" size={16} lh={1.5} color="transparent">{line.slice(shown)}</Txt>
          </Txt>
        </CoachShout>

        <ScrollView style={{ flex: 1, marginTop: SP.sm, marginHorizontal: -SIDE }} contentContainerStyle={{ paddingHorizontal: SIDE, paddingTop: SP.md, paddingBottom: SP.huge, gap: SP.xxl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
          style={{ fontFamily: fontFamily('display'), fontSize: 34 * textSize, height: 56 * textSize, color: F.chalk, padding: 0 }}
        />
        <View style={{ height: 2, borderRadius: 1, backgroundColor: F.rule }}>
          <View style={{ height: 2, borderRadius: 1, width: `${Math.min(100, d.name.length * 12)}%`, backgroundColor: acc }} />
        </View>
      </Rise>
      <Rise delay={420} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md }}>
        <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>Vow no.</Txt>
        <Txt face="mono" raw size={12} lh={1.35} color={ok ? acc : F.smoke}>{id}</Txt>
      </Rise>
    </View>
  );
}

function IdealStep({ d, patch, acc }: { d: Intake; patch: (o: Partial<Intake>) => void; acc: string }) {
  const own = d.arch === 'none';
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.md }}>
      {ARCHETYPES.map((a, i) => {
        const sel = d.arch === a.id;
        return (
          <Rise key={a.id} delay={200 + i * 70} style={{ width: '46%', flexGrow: 1 }}>
            <Tap
              onPress={() => patch({ arch: a.id, goal: a.goal, targetTouched: false, disc: { Hypertrophy: a.disc.includes('Hypertrophy'), Strength: a.disc.includes('Strength'), Calisthenics: a.disc.includes('Calisthenics'), Running: a.disc.includes('Running') } })}
              accessibilityLabel={`${a.name}. ${a.ref}. ${a.spec}`} accessibilityState={{ selected: sel }}
              style={[{ minHeight: 192, padding: SP.md, justifyContent: 'space-between', gap: SP.md, overflow: 'hidden' }, tile(sel, acc)]}
            >
              <View pointerEvents="none" style={{ position: 'absolute', right: -12, top: 30, opacity: sel ? 0.2 : 0.07 }}>
                <Icon name={a.icon} size={88} color={sel ? acc : F.chalk} tint={0} strokeWidth={1.3} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{two(i + 1)}</Txt>
                <Picked on={sel} acc={acc} />
              </View>
              <View>
                <Txt face="heading" size={16} lh={1.4} fit>{a.name}</Txt>
                <Txt size={13} w={500} lh={1.4} color={C.sub}>{a.ref}</Txt>
                <View style={{ gap: SP.xs, marginTop: SP.sm }}>
                  {(['Power', 'Speed', 'Size'] as const).map((l, j) => (
                    <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                      <Txt face="label" size={12} lh={1.35} color={F.smoke} style={{ width: 40 }}>{l}</Txt>
                      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: F.rope }}>
                        <View style={{ height: 4, borderRadius: 2, width: `${a.bars[j]}%`, backgroundColor: sel ? acc : F.smoke }} />
                      </View>
                    </View>
                  ))}
                </View>
                <Txt face="mono" raw size={12} lh={1.35} color={F.smoke} numberOfLines={2} style={{ marginTop: SP.sm }}>{a.spec}</Txt>
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
          <Icon name="profile" size={24} color={own ? acc : F.smoke} tint={0} strokeWidth={1.7} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt size={15} w={600} lh={1.4}>None. My own vision.</Txt>
            <Txt size={13} color={C.sub} lh={1.4}>Describe it in your goal. I’ll build the plan around it.</Txt>
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
      <Block i={0} label="Goal" acc={acc}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.md }}>
          {GOALS.map(g => {
            const sel = d.goal === g.id;
            return (
              <Tap
                key={g.id} onPress={() => set('goal', g.id)}
                accessibilityLabel={`${g.label}. ${g.sub}`} accessibilityState={{ selected: sel }}
                style={[{ width: '46%', flexGrow: 1, minHeight: 96, padding: SP.md, justifyContent: 'space-between', gap: SP.sm }, tile(sel, acc)]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt face="mono" raw size={12} lh={1.35} color={sel ? acc : F.smoke}>{g.tag}</Txt>
                  <Picked on={sel} acc={acc} />
                </View>
                <View>
                  <Txt face="heading" size={18} lh={1.35} fit>{g.label}</Txt>
                  <Txt size={13} color={C.sub} lh={1.4}>{g.sub}</Txt>
                </View>
              </Tap>
            );
          })}
        </View>
      </Block>
      <Block i={1} label="Deadline" right={calmDate(shortDate(deadlineOf(d, new Date()), true))} acc={acc}>
        <Seg value={d.weeks} opts={[12, 16, 22, 30, 40].map(w => [w, `${w} wk`] as [number, string])} onPick={v => set('weeks', v)} acc={acc} />
      </Block>
      <Block i={2} label="Why it matters" right="Quoted back" acc={acc}>
        <Field value={d.why} onChange={v => set('why', v)} placeholder="I’m tired of starting over every January." accessibilityLabel="Why it matters" acc={acc} />
      </Block>
    </>
  );
}

const SCRUB = {
  height: { label: 'Height', unit: 'cm', min: 140, max: 215, step: 1, dp: 0 },
  weight: { label: 'Weight', unit: 'kg', min: 40, max: 160, step: 0.1, dp: 1 },
  bf: { label: 'Body fat · a guess', unit: '%', min: 5, max: 40, step: 0.5, dp: 1 },
  targetWeight: { label: 'Target weight', unit: 'kg', min: 40, max: 160, step: 0.1, dp: 1 },
  targetBf: { label: 'Target body fat', unit: '%', min: 5, max: 40, step: 0.5, dp: 1 },
} as const;

function ScrubOf({ k, d, onChange, acc }: { k: keyof typeof SCRUB; d: Intake; onChange: (v: number) => void; acc: string }) {
  const c = SCRUB[k];
  return <Scrub label={c.label} unit={c.unit} value={d[k]} step={c.step} min={c.min} max={c.max} dp={c.dp} onChange={onChange} acc={acc} />;
}

const stepper = (d: Intake, set: SetFn, k: 'age' | 'wake' | 'bed' | 'steps', label: string, unit: string, step: number, min: number, max: number, show?: (v: number) => string) => {
  const v = d[k], clamp = (x: number) => Math.min(max, Math.max(min, +x.toFixed(2)));
  return { label, unit, value: show ? show(v) : String(v), minus: () => set(k, clamp(v - step)), plus: () => set(k, clamp(v + step)) };
};

/** One of their current bests: "—" until they set it; the first tap starts from what's typical for them. */
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
      <Block i={4} acc={acc}><Nums items={[stepper(d, set, 'age', 'Age', 'yrs', 1, 14, 80)]} /></Block>
    </>
  );
}

function TargetStep({ d, patch, acc }: { d: Intake; patch: (o: Partial<Intake>) => void; acc: string }) {
  const r = weeklyRate(d), total = r * d.weeks, fast = (Math.abs(r) / d.weight) * 100 > 1;
  const stats: [string, string, string][] = [
    ['Change', `${total > 0 ? '+' : ''}${total.toFixed(1)}`, F.chalk],
    ['Per week', `${r > 0 ? '+' : ''}${r.toFixed(2)}`, fast ? warnColor(acc) : acc],
    ['Lean mass', (d.targetWeight * (1 - d.targetBf / 100)).toFixed(1), F.chalk],
  ];
  return (
    <>
      <Rise delay={250} style={{ flexDirection: 'row', gap: SP.sm }}>
        {stats.map(([l, v, c]) => (
          <View key={l} accessible accessibilityLabel={`${l} ${v} kilograms`} style={[CARD, { flex: 1, paddingVertical: SP.md, paddingHorizontal: SP.md, gap: 2 }]}>
            <Txt face="num" size={20} lh={1.3} color={c} fit>
              {v}
              <Txt face="label" size={12} color={F.smoke}> kg</Txt>
            </Txt>
            <Txt face="label" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{l}</Txt>
          </View>
        ))}
      </Rise>
      <Block i={1} acc={acc}><ScrubOf k="targetWeight" d={d} onChange={v => patch({ targetWeight: v, targetTouched: true })} acc={acc} /></Block>
      <Block i={2} acc={acc}><ScrubOf k="targetBf" d={d} onChange={v => patch({ targetBf: v, targetTouched: true })} acc={acc} /></Block>
      <Rise delay={550}>
        <FieldLabel label="The road" right={`${d.weeks} weeks`} acc={acc} />
        <View accessible accessibilityLabel={`From ${d.weight} kilograms at ${d.bf} percent now to ${d.targetWeight} kilograms at ${d.targetBf} percent by ${shortDate(deadlineOf(d, new Date()))}`} style={[CARD, { padding: SP.lg, gap: SP.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: acc }} />
            <View style={{ flex: 1, height: 2, backgroundColor: acc }} />
            <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: F.chalk, backgroundColor: F.canvas }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SP.md }}>
            <View style={{ gap: 2, flexShrink: 1 }}>
              <Txt face="label" size={12} lh={1.35} color={F.smoke}>Now</Txt>
              <Txt face="mono" raw size={13} lh={1.35} color={F.chalk}>{`${d.weight} kg · ${d.bf}%`}</Txt>
            </View>
            <View style={{ gap: 2, flexShrink: 1, alignItems: 'flex-end' }}>
              <Txt face="label" size={12} lh={1.35} color={F.smoke}>{calmDate(shortDate(deadlineOf(d, new Date())))}</Txt>
              <Txt face="mono" raw size={13} lh={1.35} color={F.chalk}>{`${d.targetWeight} kg · ${d.targetBf}%`}</Txt>
            </View>
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
      <Block i={1} label="Sleep" right={`${sleepHours(d).toFixed(1)} h`} acc={acc}><Nums items={[stepper(d, set, 'wake', 'Wake', '', 15, 0, 1425, clockOf), stepper(d, set, 'bed', 'Bed', '', 15, 0, 1425, clockOf)]} /></Block>
      <Block i={2} label="Stress level" acc={acc}><Seg value={d.stress} opts={[[1, '1', 'calm'], [2, '2'], [3, '3'], [4, '4'], [5, '5', 'max']]} onPick={v => set('stress', v)} acc={acc} /></Block>
      <Block i={3} acc={acc}><Nums items={[stepper(d, set, 'steps', 'Daily steps', '', 1000, 2000, 25000, v => v.toLocaleString('en-US'))]} /></Block>
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
  const math = `BMR ${c.bmr.toLocaleString('en-US')} × ${c.af.toFixed(2)} activity ${c.adj > 0 ? '+' : '−'}${Math.abs(Math.round(c.adj * 100))}%${d.kcalAdj ? ` ${d.kcalAdj > 0 ? '+' : '−'}${Math.abs(d.kcalAdj)} you` : ''}`;
  const nudge = (dv: number) => set('kcalAdj', Math.max(-600, Math.min(600, d.kcalAdj + dv)));
  return (
    <View style={{ gap: SP.xxl }}>
      <Rise delay={250}>
        <FieldLabel label="Daily fuel" right={adj} acc={acc} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: SP.md }}>
          <View accessible accessibilityLabel={`${c.kcal} calories a day`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.sm, flexShrink: 1 }}>
            <Txt face="display" exact size={48} lh={1.2} color={acc}>{Math.round(c.kcal * count).toLocaleString('en-US')}</Txt>
            <Txt face="mono" raw size={14} lh={1.35} color={F.smoke}>kcal</Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: SP.sm, paddingBottom: SP.sm }}>
            {([['−', -50, 'Lower by 50 calories'], ['+', 50, 'Raise by 50 calories']] as const).map(([l, dv, say]) => (
              <Tap key={l} onPress={() => nudge(dv)} accessibilityLabel={say} style={{ width: HIT, height: HIT, borderWidth: 1, borderColor: F.rule, borderRadius: RADIUS.sm, backgroundColor: F.canvas, alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={22} w={500} lh={1.2}>{l}</Txt>
              </Tap>
            ))}
          </View>
        </View>
        <Txt face="mono" raw size={12} lh={1.35} color={F.smoke} style={{ marginTop: SP.xs }}>{math}</Txt>
      </Rise>
      <View style={{ gap: SP.sm }}>
        {macros.map(([label, grams, color, note, perG], i) => (
          <Rise key={label} delay={400 + i * 100} style={[CARD, { padding: SP.lg, gap: SP.sm }]}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SP.md }}>
              <Txt face="heading" size={17} lh={1.35}>{label}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SP.xs }}>
                <Txt face="num" size={22} lh={1.3}>{Math.round(grams * count)}</Txt>
                <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>g</Txt>
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
    <Block i={0} label="Recent bests" right="Tap + to set · skip the rest" acc={acc}>
      <Nums items={[
        best(d, set, 'bench', 'Bench', 'kg', 2.5, 0, 300), best(d, set, 'squat', 'Squat', 'kg', 2.5, 0, 400),
        best(d, set, 'dead', 'Deadlift', 'kg', 2.5, 0, 450), best(d, set, 'pullups', 'Pull-ups', 'reps', 1, 0, 60),
        best(d, set, 'run5k', '5K run', '', 15, 900, 3600, mmss),
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

/** How REI talks day to day, and whether it may message and speak. */
function ToneStep({ d, set, acc }: StepProps) {
  return (
    <>
      <View style={{ gap: SP.md }}>
        {TONES.map((o, i) => {
          const sel = d.tone === o.id;
          return (
            <Rise key={o.id} delay={200 + i * 80}>
              <Tap
                onPress={() => set('tone', o.id)} accessibilityLabel={`${o.id}. ${o.sub}`} accessibilityState={{ selected: sel }}
                style={[{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 64, paddingVertical: SP.md, paddingHorizontal: SP.md }, tile(sel, acc)]}
              >
                <Icon name={o.icon} size={24} color={sel ? acc : F.smoke} tint={0} strokeWidth={1.7} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt face="heading" size={18} lh={1.35}>{o.id}</Txt>
                  <Txt size={13} color={C.sub} lh={1.4}>{o.sub}</Txt>
                </View>
                <Picked on={sel} acc={acc} />
              </Tap>
            </Rise>
          );
        })}
      </View>
      <Rise delay={500}>
        <FieldLabel label="How that sounds" right="2 missed" acc={acc} />
        <View style={[CARD, { paddingVertical: SP.lg, paddingHorizontal: SP.xl }]}>
          <Txt face="voice" size={16} lh={1.5} color={C.textSoft}>{toneSample(d.tone, d)}</Txt>
        </View>
      </Rise>
      <Rise delay={600}>
        <FieldLabel label="Day to day" acc={acc} />
        <View style={{ gap: SP.sm }}>
          <ToggleRow icon="bell" label="Check-ins" sub="I message you when you slip. Late session, low protein, bedtime." on={d.nudge} onPress={() => set('nudge', !d.nudge)} acc={acc} />
          <ToggleRow icon="voice" label="Voice replies" sub="I speak replies out loud in voice mode." on={d.speak} onPress={() => set('speak', !d.speak)} acc={acc} />
        </View>
      </Rise>
    </>
  );
}

/**
 * Whose voice REI speaks in, and which world the app wears. Tapping a voice picks them, repaints the parts
 * in their world and plays their hello in their own voice; the world can then be changed on its own.
 * Voices that haven't arrived show the line instead.
 */
function VoiceStep({ d, set, patch, acc }: { d: Intake; set: SetFn; patch: (o: Partial<Intake>) => void; acc: string }) {
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
      <Block i={0} label="Voice" right={playing ? 'Playing' : 'Tap to hear'} acc={acc}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
          {CHARACTERS.map((c, i) => {
            const sel = (d.character || 'rei') === c.id, voiced = hasVoice(c), talking = playing === c.id;
            // Unpicked cards hint at the world they bring; the picked one wears the world on screen.
            const col = sel ? acc : worldAccent(c.theme);
            return (
              <Rise key={c.id} delay={200 + i * 50} style={{ width: '30%', flexGrow: 1 }}>
                <Tap
                  onPress={() => void choose(c.id)}
                  accessibilityLabel={`${c.name}, ${c.series}. ${voiced ? (talking ? 'Playing. Tap to stop.' : 'Tap to hear.') : 'Voice coming soon.'}`} accessibilityState={{ selected: sel }}
                  style={[{ minHeight: 108, padding: SP.md, justifyContent: 'space-between', gap: SP.sm }, tile(sel, acc)]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Icon name={talking ? 'voice' : c.icon} size={22} color={col} tint={0} strokeWidth={1.7} />
                    <Picked on={sel} acc={acc} />
                  </View>
                  <View>
                    <Txt face="heading" size={17} lh={1.35} fit>{c.name}</Txt>
                    <Txt face="label" size={12} lh={1.35} color={talking ? col : F.smoke} numberOfLines={1}>{talking ? 'Playing' : voiced ? c.series : 'Voice soon'}</Txt>
                  </View>
                </Tap>
              </Rise>
            );
          })}
        </View>
      </Block>
      <Rise delay={650}>
        <FieldLabel label="Their hello" right={cur.name} acc={acc} />
        <View style={[CARD, { paddingVertical: SP.lg, paddingHorizontal: SP.xl }]}>
          <Txt face="voice" size={16} lh={1.5} color={C.textSoft}>{`“${greeting(cur, d.name).replace(/\s*\[[^\]]*\]/g, '')}”`}</Txt>
        </View>
        <Txt size={13} color={note ? warnColor(acc) : C.sub} lh={1.4} style={{ marginTop: SP.sm }}>{note || 'Tap a card to hear them; tap again to stop. You can change the voice any time in Settings.'}</Txt>
      </Rise>
      <Block i={6} label="World" right={THEMES.find(t => t.id === d.theme)?.vibe} acc={acc}>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
          {THEMES.map(t => {
            const sel = d.theme === t.id;
            return (
              <Tap
                key={t.id} onPress={() => set('theme', t.id)}
                accessibilityRole="radio" accessibilityState={{ selected: sel, checked: sel }} accessibilityLabel={`${t.name}. ${t.vibe}`}
                style={[{ width: '30%', flexGrow: 1, minHeight: HIT + SP.xs, paddingHorizontal: SP.md, flexDirection: 'row', alignItems: 'center', gap: SP.sm }, tile(sel, t.acc)]}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.acc }} />
                <Txt face="heading" size={15} lh={1.35} color={F.chalk} fit style={{ flexShrink: 1 }}>{t.name}</Txt>
              </Tap>
            );
          })}
        </View>
      </Block>
    </>
  );
}

/** The vow: the sentence, its terms, who witnessed it, and the seal you hold to press. */
function PactStep({ d, acc, onSeal }: { d: Intake; acc: string; onSeal: () => void }) {
  const partner = characterOf(d.character);
  return (
    <View style={{ gap: SP.xxl }}>
      <Rise delay={250} style={[CARD, { padding: SP.xl }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SP.md }}>
          <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>No. 0001</Txt>
          <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{calmDate(shortDate(new Date(), true))}</Txt>
        </View>
        <Txt size={15} w={500} lh={1.4} color={C.sub} style={{ marginTop: SP.lg }}>I, <Txt size={15} w={600} lh={1.4} color={acc}>{nameOf(d)}</Txt>, will</Txt>
        <Txt face="heading" size={20} lh={1.4} style={{ marginTop: SP.xs }}>{calmDate(vowSentence(d, new Date()))}</Txt>
        <BrushRule long height={6} style={{ marginTop: SP.lg }} />
        <View style={{ marginTop: SP.sm }}>
          {pactRows(d).map(([k, v], i) => (
            <View key={k} accessible accessibilityLabel={`${k}: ${v}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: SP.lg, paddingVertical: SP.md, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
              <Txt face="label" size={13} lh={1.35} color={F.smoke}>{k}</Txt>
              <Txt size={15} w={500} lh={1.4} color={C.textSoft} align="right" style={{ flex: 1 }}>{v}</Txt>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginTop: SP.md }}>
          <Icon name={partner.icon} size={18} color={F.smoke} tint={0} strokeWidth={1.7} />
          <Txt size={13} w={500} lh={1.4} color={C.sub}>{`Witnessed by ${partner.name}`}</Txt>
        </View>
      </Rise>
      <Rise delay={500}><HoldSeal acc={acc} onSeal={onSeal} /></Rise>
    </View>
  );
}

/** Sealed. The first-day page: the stamp, when day one starts, the three numbers, REI's last word, and the way in. */
function FirstDay({ d, acc, insetTop, insetBottom, onEnter }: { d: Intake; acc: string; insetTop: number; insetBottom: number; onEnter: () => void }) {
  const c = fuel(d);
  const partner = characterOf(d.character);
  const [stamp] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(stamp, { toValue: 1, duration: 600, delay: 150, easing: Easing.bezier(0.2, 0.9, 0.3, 1), useNativeDriver: true }).start();
  }, [stamp]);
  const numbers: [string, string][] = [['kcal a day', c.kcal.toLocaleString('en-US')], ['g protein', String(c.p)], ['weeks', String(d.weeks)]];
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insetTop + SP.xxl, paddingHorizontal: SIDE, paddingBottom: insetBottom + SP.md }} showsVerticalScrollIndicator={false}>
      <Animated.View
        style={{
          alignSelf: 'flex-start',
          opacity: stamp.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: stamp.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1.3, 0.98, 1] }) }],
        }}
      >
        <RoundStamp label="Vow sealed" />
      </Animated.View>
      <Rise delay={450} style={{ marginTop: SP.lg }}>
        <Txt face="display" exact size={32} lh={1.2}>It begins today.</Txt>
      </Rise>
      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: SP.huge, gap: SP.md }}>
        <Rise delay={650}>
          <VersusHeader name={nameOf(d)} sub={`With ${partner.name}`} plate={{ big: 'Day 1', small: `First session ${trainTime(d)}` }} accent={acc} />
        </Rise>
        <Rise delay={850} style={{ flexDirection: 'row', gap: SP.sm }}>
          {numbers.map(([k, v]) => (
            <View key={k} accessible accessibilityLabel={`${v} ${k}`} style={[CARD, { flex: 1, paddingVertical: SP.md, paddingHorizontal: SP.md, gap: 2 }]}>
              <Txt face="num" size={22} lh={1.3} color={acc} fit>{v}</Txt>
              <Txt face="label" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{k}</Txt>
            </View>
          ))}
        </Rise>
      </View>
      <Rise delay={1100} style={{ gap: SP.xxl }}>
        <CoachShout accent={acc}>
          <Txt face="voice" size={17} lh={1.5}>{bondLine(d)}</Txt>
        </CoachShout>
        <Cta label="Enter" icon="door" acc={acc} onPress={onEnter} />
      </Rise>
    </ScrollView>
  );
}
