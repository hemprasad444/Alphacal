// First run: the cover, fifteen chapters, the pact, the account (for new users), the bond and the
// dive into the app. Numbers and wording come from @rei/shared (onboarding.ts); this file is the stage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  ARCHETYPES, bondLine, CHAPTERS, CHARACTERS, characterOf, clockOf, deadlineOf, DEFAULT_INTAKE, fuel, goalOf, GOALS, type Intake, mmss, nameOf, pactRows, reiLine, shortDate,
  sleepHours, STEPS, suggestedTarget, TONES, toneSample, trainTime, vowSentence, weeklyRate,
} from '@rei/shared';
import { Icon } from '../components/icons';
import { Core } from '../components/Core';
import { ChapterCard, EnterFx, Flash, HoldSeal, markArrival } from '../components/onboarding/fx';
import { Bubble, Chips, comic, Cta, solid, Field, FieldLabel, Halftone, Nums, Outline, pick, Rise, Scrub, Seg, SpeedLines, ToggleRow } from '../components/onboarding/kit';
import { Tap, Txt } from '../components/ui';
import { alpha, C, EMBLEMS, fontFamily, THEMES } from '../lib/theme';
import { authMessage } from '../state/account';
import { useStore } from '../state/store';

const DRAFT_KEY = 'rei-onboarding-draft';
const idx = (id: string) => STEPS.findIndex(s => s.id === id);
const on = (o: Record<string, boolean>, k: string) => !!o[k];
const toggle = (o: Record<string, boolean>, k: string) => {
  if (k === 'None') return o.None ? {} : { None: true };
  const n = { ...o };
  delete n.None;
  n[k] = !n[k];
  return n;
};

export default function Onboarding() {
  const s = useStore();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const signedIn = s.account.status === 'signedIn';

  const [d, setD] = useState<Intake>(() => ({ ...DEFAULT_INTAKE, name: s.profile.name || '' }));
  const [step, setStep] = useState(() => (s.pendingOnboarding && !signedIn ? idx('account') : 0));
  const [card, setCard] = useState<{ to: number; key: number } | null>(null);
  const [flash, setFlash] = useState(false);
  const [entering, setEntering] = useState(false);
  /** How much of REI's line is shown, for which chapter (a new chapter starts from nothing). */
  const [typed, setTyped] = useState({ key: '', n: 0 });
  const loaded = useRef(false);
  /** The step change a chapter card performs halfway through its wipe. */
  const pendingArrive = useRef<() => void>(() => {});

  const st = STEPS[step];
  const theme = THEMES.find(t => t.id === d.theme) ?? THEMES[0];
  const { acc, acc2, bg } = theme;
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => setD(cur => ({ ...cur, [k]: v }));
  const patch = (o: Partial<Intake>) => setD(cur => ({ ...cur, ...o }));

  // Once sealed, the account counts as onboarded; keep this flow on screen until the dive finishes.
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

  // REI types its line for each chapter (and again when the chosen ideal changes).
  const line = reiLine(st.id, d);
  const typeKey = `${step}|${st.id === 'ideal' ? d.arch : ''}`;
  useEffect(() => {
    let n = 0, timer: ReturnType<typeof setInterval> | undefined;
    const wait = setTimeout(() => {
      timer = setInterval(() => {
        n += 2;
        setTyped({ key: typeKey, n });
        if (n > 400 && timer) clearInterval(timer);
      }, 20);
    }, st.k ? 560 : 140);
    return () => {
      clearTimeout(wait);
      if (timer) clearInterval(timer);
    };
  }, [typeKey, st.k]);
  const shown = typed.key === typeKey ? typed.n : 0;
  const typing = shown < line.length;

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
    if (!instant && to.k && i > step) setCard({ to: i, key: Date.now() });
    else arrive();
    if (!instant && to.k && i > step) pendingArrive.current = arrive;
  };

  const blocked = (st.id === 'name' && !d.name.trim()) || (st.id === 'ideal' && !d.arch);
  const next = () => {
    if (!blocked) go(step + 1);
  };

  const seal = () => {
    s.setObActive(true);
    setFlash(true);
    s.completeOnboarding(d);
    setTimeout(() => go(signedIn ? idx('done') : idx('account'), true), 380);
  };

  // A new account just finished: its answers are in, on to the bond.
  useEffect(() => {
    if (st.id !== 'account' || !signedIn || !s.onboarded) return;
    const t = setTimeout(() => go(idx('done'), true), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.id, signedIn, s.onboarded]);

  const enter = () => setEntering(true);
  const entered = () => {
    AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    markArrival();
    s.setObActive(false);
    router.replace('/');
  };

  const emblem = d.theme === 'shinobi' ? EMBLEMS.shinobi?.[0]?.source : null;

  return (
    <View style={{ flex: 1, backgroundColor: bg, overflow: 'hidden' }}>
      <Atmosphere acc={acc} acc2={acc2} W={W} />
      {emblem ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Image source={emblem} style={{ width: 300, height: 300, opacity: 0.14 }} contentFit="contain" />
        </View>
      ) : null}

      {st.id === 'boot' ? <Cover acc={acc} signedIn={signedIn} onBegin={() => go(1)} insetTop={insets.top} insetBottom={insets.bottom} /> : null}

      {st.k || st.id === 'account' ? (
        <Chapter
          step={step} acc={acc} motto={theme.motto} insetTop={insets.top} insetBottom={insets.bottom}
          line={typing ? line.slice(0, shown) : line} typing={typing} onBack={() => go(step - 1, true)}
          cta={st.cta ? <Cta label={st.cta} acc={acc} disabled={blocked} onPress={next} /> : null}
        >
          {st.id === 'name' ? <NameStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'ideal' ? <IdealStep d={d} patch={patch} acc={acc} /> : null}
          {st.id === 'vow' ? <VowStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'body' ? <BodyStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'target' ? <TargetStep d={d} patch={patch} acc={acc} acc2={acc2} bg={bg} /> : null}
          {st.id === 'power' ? <PowerStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'train' ? <TrainStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'life' ? <LifeStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'kitchen' ? <KitchenStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'fuel' ? <FuelStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'weak' ? <WeakStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'tone' ? <ToneStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'world' ? <WorldStep d={d} set={set} /> : null}
          {st.id === 'link' ? <LinkStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'pact' ? <PactStep d={d} acc={acc} onSeal={seal} /> : null}
          {st.id === 'account' ? <AccountStep acc={acc} /> : null}
        </Chapter>
      ) : null}

      {st.id === 'done' ? <Bond d={d} acc={acc} acc2={acc2} bg={bg} insetTop={insets.top} insetBottom={insets.bottom} onEnter={enter} onReplay={() => go(0, true)} /> : null}

      {card ? (
        <ChapterCard
          key={card.key} n={card.to} k={STEPS[card.to].k ?? ''} t={STEPS[card.to].t ?? ''} total={CHAPTERS} acc={acc} bg={bg}
          onSwap={() => pendingArrive.current()} onEnd={() => setCard(null)}
        />
      ) : null}
      {flash ? <Flash onEnd={() => setFlash(false)} /> : null}
      {entering ? <EnterFx name={nameOf(d)} acc={acc} bg={bg} onEnd={entered} /> : null}
    </View>
  );
}

/** The panel's glow, corner halftones and accent wash. */
function Atmosphere({ acc, acc2, W }: { acc: string; acc2: string; W: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="obTop" cx="50%" cy="-12%" rx="110%" ry="55%">
            <Stop offset="0" stopColor={acc} stopOpacity={0.14} />
            <Stop offset="0.62" stopColor={acc} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="obCorner" cx="105%" cy="108%" rx="80%" ry="40%">
            <Stop offset="0" stopColor={acc2} stopOpacity={0.18} />
            <Stop offset="0.7" stopColor={acc2} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#obTop)" />
        <Rect width="100%" height="100%" fill="url(#obCorner)" />
      </Svg>
      <View style={{ position: 'absolute', right: 0, top: 0 }}><Halftone width={Math.min(260, W * 0.65)} height={300} corner="tr" /></View>
      <View style={{ position: 'absolute', left: 0, bottom: 0 }}><Halftone width={240} height={260} color={acc} opacity={0.3} corner="bl" /></View>
    </View>
  );
}

function Cover({ acc, signedIn, onBegin, insetTop, insetBottom }: { acc: string; signedIn: boolean; onBegin: () => void; insetTop: number; insetBottom: number }) {
  const { width: W } = useWindowDimensions();
  const [lines] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(lines, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(lines, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [lines]);
  const boot: [string, string][] = [['零 REI SYSTEM · v1.0', C.dim], ['BOOTING PERSONAL CORE ···· OK', C.dim], ['NO OPERATOR PROFILE FOUND', C.alertSoft], ['BOND PROTOCOL READY ▍', acc]];
  return (
    <View style={{ flex: 1, paddingTop: insetTop + 14, paddingHorizontal: 26, paddingBottom: insetBottom + 16 }}>
      <Rise delay={1100} from={0} style={{ position: 'absolute', left: W / 2 - 450, top: '40%', marginTop: -450 }}>
        <Animated.View style={{ transform: [{ rotate: lines.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '4deg'] }) }, { scale: lines.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] }}>
          <SpeedLines size={900} color={acc} inner={0.12} outer={0.4} count={84} opacity={0.75} />
        </Animated.View>
      </Rise>
      <Rise delay={1900} from={0} style={{ position: 'absolute', right: 14, top: insetTop + 60 }}>
        <Outline text="ゴゴゴゴ" size={58} color={alpha(acc, 0.55)} width={1.5} vertical />
      </Rise>
      <View style={{ gap: 6 }}>
        {boot.map(([t, color], i) => (
          <Rise key={t} delay={100 + i * 300} from={0}><Txt face="mono" size={11} ls={0.14} color={color}>{t}</Txt></Rise>
        ))}
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <Rise delay={1200} from={0} style={{ position: 'absolute' }}>
          <Outline text="零" size={300} color="rgba(255,255,255,0.07)" width={1} />
        </Rise>
        <Rise delay={1200} from={-20}><Core size={160} color={acc} /></Rise>
        <Rise delay={1700} style={{ alignItems: 'center', gap: 8 }}>
          <Txt face="mono" size={10.5} ls={0.3} color={acc}>VOL.01 · 契約編 · THE PACT ARC</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
            <Txt size={52} w={600} ls={-0.04}>REI</Txt>
            <Txt face="jp" size={26} w={500} color={C.label}>零</Txt>
          </View>
        </Rise>
      </View>
      <Rise delay={2200} style={{ gap: 20 }}>
        <Bubble acc={acc}>
          <Txt size={18} w={500} color="#0A0B0D" lh={1.42}>{'You’re new. Good. I don’t do generic. Fifteen short chapters and I’ll know exactly who you want to become, and when you’re lying to yourself about it.'}</Txt>
        </Bubble>
        <View style={{ gap: 6 }}>
          <Cta label="Begin chapter 1" kanji="第1話" acc={acc} onPress={onBegin} />
          {signedIn ? null : (
            <Tap onPress={() => router.push('/sign-in')} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Txt size={14} color={C.muted}>I already have an account</Txt>
            </Tap>
          )}
        </View>
      </Rise>
    </View>
  );
}

/** The frame around every chapter: back, progress, REI's typed line, the answers, and the call to action. */
function Chapter({ step, acc, motto, insetTop, insetBottom, line, typing, onBack, cta, children }: { step: number; acc: string; motto: string; insetTop: number; insetBottom: number; line: string; typing: boolean; onBack: () => void; cta: ReactNode; children: ReactNode }) {
  const st = STEPS[step];
  const chapters = STEPS.filter(x => x.k);
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {st.k ? <Outline text={st.k} size={300} color="rgba(255,255,255,0.06)" width={1} style={{ position: 'absolute', right: -30, bottom: 96 }} /> : null}
      <View pointerEvents="none" style={{ position: 'absolute', left: 8, top: 200, alignItems: 'center' }}>
        {[...motto.replace(/\s/g, '')].map((c, i) => <Txt key={i} face="jp" size={10} color="rgba(255,255,255,0.15)">{c}</Txt>)}
      </View>
      <View style={{ flex: 1, paddingTop: insetTop + 8, paddingHorizontal: 20, paddingBottom: insetBottom + 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 40 }}>
          <Tap onPress={onBack} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={20} color={C.body}>‹</Txt>
          </Tap>
          <View style={{ flex: 1, flexDirection: 'row', gap: 3 }}>
            {chapters.map((c, i) => (
              <View key={c.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < step ? acc : 'rgba(255,255,255,0.1)', shadowColor: acc, shadowOpacity: i === step - 1 ? 1 : 0, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', minWidth: 58, justifyContent: 'flex-end' }}>
            <Txt face="jp" size={13} w={500} color={C.body}>第</Txt>
            <Txt face="mono" size={13} w={500} color={acc}>{String(Math.min(step, CHAPTERS)).padStart(2, '0')}</Txt>
            <Txt face="jp" size={13} w={500} color={C.body}>話</Txt>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 18, minHeight: 116 }}>
          <View style={{ width: 44, height: 44, marginTop: 20, alignItems: 'center', justifyContent: 'center' }}>
            <Core size={44} speaking={typing} color={acc} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt face="mono" size={10.5} ls={0.18} color={acc}>REI</Txt>
              <Txt face="mono" size={10.5} color={C.ghost}>／</Txt>
              <Txt face="mono" size={10.5} ls={0.18} color={C.muted}>{st.t ?? 'ACCOUNT'}</Txt>
            </View>
            <Bubble acc={acc} tail="top" style={{ marginTop: 8, paddingVertical: 12, paddingHorizontal: 15, minHeight: 44 }}>
              <Txt size={16} w={500} color="#0A0B0D" lh={1.42}>
                {line}
                {typing ? <Txt size={16} color="#0A0B0D">▍</Txt> : null}
              </Txt>
            </Bubble>
          </View>
        </View>

        <ScrollView style={{ flex: 1, marginTop: 16, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {cta ? <View style={{ marginTop: 10 }}>{cta}</View> : null}
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
  const ok = !!d.name.trim();
  const id = ok ? `REI-${d.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6).padEnd(3, 'X')}-0001` : '— — —';
  return (
    <View style={{ gap: 16, paddingTop: 24 }}>
      <Rise delay={300} style={{ paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.14)' }}>
        <TextInput
          value={d.name}
          onChangeText={v => set('name', v)}
          placeholder="Your name"
          placeholderTextColor={C.ghost}
          maxLength={20}
          autoFocus
          autoCapitalize="words"
          keyboardAppearance="dark"
          style={{ fontFamily: fontFamily('Geist', 600), fontSize: 44, letterSpacing: -0.035 * 44, color: C.text, padding: 0 }}
        />
        <View style={{ position: 'absolute', left: 0, bottom: -1, height: 2, width: `${Math.min(100, d.name.length * 12)}%`, backgroundColor: acc, shadowColor: acc, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }} />
      </Rise>
      <Rise delay={420} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt face="mono" size={11} ls={0.14} color={C.dim}>OPERATOR ID</Txt>
        <Txt face="mono" size={11} ls={0.14} color={C.sub}>{id}</Txt>
      </Rise>
    </View>
  );
}

function IdealStep({ d, patch, acc }: { d: Intake; patch: (o: Partial<Intake>) => void; acc: string }) {
  const own = pick(d.arch === 'none', acc);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {ARCHETYPES.map((a, i) => {
        const sel = d.arch === a.id, p = pick(sel, acc);
        return (
          <Rise key={a.id} delay={200 + i * 70} style={{ width: '48.4%', flexGrow: 1 }}>
            <Tap
              onPress={() => patch({ arch: a.id, goal: a.goal, targetTouched: false, disc: { Hypertrophy: a.disc.includes('Hypertrophy'), Strength: a.disc.includes('Strength'), Calisthenics: a.disc.includes('Calisthenics'), Running: a.disc.includes('Running') } })}
              style={{ height: 196, borderRadius: 10, borderWidth: 1.5, borderColor: p.borderColor, backgroundColor: p.backgroundColor, padding: 12, justifyContent: 'space-between', overflow: 'hidden', ...(sel ? comic(alpha(acc, 0.55), 3) : null) }}
            >
              {sel ? <View pointerEvents="none" style={{ position: 'absolute', left: -150, top: -170 }}><SpeedLines size={480} color={acc} inner={0.1} outer={0.5} count={70} opacity={0.7} /></View> : null}
              <Outline text={a.k} size={112} color={p.kStroke} width={1.5} style={{ position: 'absolute', right: -8, top: 18 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Txt face="mono" size={9.5} ls={0.16} color={C.label}>{`TYPE ${String(i + 1).padStart(2, '0')}`}</Txt>
                <Txt face="mono" size={9.5} ls={0.16} color={acc}>{p.check}</Txt>
              </View>
              <View>
                <Txt size={15.5} w={600} ls={-0.01} lh={1.2}>{a.name}</Txt>
                <Txt size={11.5} color={C.sub} style={{ marginTop: 2 }}>{a.ref}</Txt>
                <View style={{ gap: 4, marginTop: 10 }}>
                  {(['POW', 'SPD', 'SIZ'] as const).map((l, j) => (
                    <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Txt face="mono" size={8.5} ls={0.12} color={C.dim} style={{ width: 24 }}>{l}</Txt>
                      <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <View style={{ height: 3, width: `${a.bars[j]}%`, backgroundColor: sel ? acc : 'rgba(255,255,255,0.4)' }} />
                      </View>
                    </View>
                  ))}
                </View>
                <Txt face="mono" size={9.5} ls={0.1} color={C.sub} style={{ marginTop: 8 }}>{a.spec}</Txt>
              </View>
            </Tap>
          </Rise>
        );
      })}
      <Rise delay={750} style={{ width: '100%' }}>
        <Tap onPress={() => d.arch !== 'none' && patch({ arch: 'none', targetTouched: false })} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, borderColor: own.borderColor, backgroundColor: own.backgroundColor }}>
          <Outline text="我" size={30} color={own.kStroke} />
          <View style={{ flex: 1 }}>
            <Txt size={15.5} w={600}>None. My own vision.</Txt>
            <Txt size={12.5} color={C.sub} style={{ marginTop: 2 }}>Describe it in your vow. I’ll build the plan around it.</Txt>
          </View>
          <Txt face="mono" size={9.5} ls={0.16} color={acc}>{own.check}</Txt>
        </Tap>
      </Rise>
    </View>
  );
}

function VowStep({ d, set, acc }: StepProps) {
  return (
    <>
      <Block i={0} label="MISSION" acc={acc}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {GOALS.map(g => {
            const p = pick(d.goal === g.id, acc);
            return (
              <Tap key={g.id} onPress={() => set('goal', g.id)} style={{ width: '48.4%', flexGrow: 1, minHeight: 96, padding: 13, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: p.borderColor, backgroundColor: p.backgroundColor, justifyContent: 'space-between', overflow: 'hidden', ...(d.goal === g.id ? comic(alpha(acc, 0.55), 3) : null) }}>
                <Outline text={g.k} size={66} color={p.kStroke} style={{ position: 'absolute', right: -4, top: -12 }} />
                <Txt face="mono" size={9.5} ls={0.16} color={C.label}>{g.tag}</Txt>
                <View>
                  <Txt size={15.5} w={600}>{g.label}</Txt>
                  <Txt size={12} color={C.sub} lh={1.3} style={{ marginTop: 2 }}>{g.sub}</Txt>
                </View>
              </Tap>
            );
          })}
        </View>
      </Block>
      <Block i={1} label="DEADLINE" right={shortDate(deadlineOf(d, new Date()), true)} acc={acc}>
        <Seg value={d.weeks} opts={[12, 16, 22, 30, 40].map(w => [w, `${w} wk`] as [number, string])} onPick={v => set('weeks', v)} acc={acc} />
      </Block>
      <Block i={2} label="WHY IT MATTERS · I’LL QUOTE THIS BACK" acc={acc}>
        <Field value={d.why} onChange={v => set('why', v)} placeholder="I’m tired of starting over every January." />
      </Block>
    </>
  );
}

const SCRUB = {
  height: { label: 'HEIGHT', unit: 'cm', min: 140, max: 215, step: 1, dp: 0 },
  weight: { label: 'WEIGHT', unit: 'kg', min: 40, max: 160, step: 0.1, dp: 1 },
  bf: { label: 'BODY FAT · ESTIMATE IS FINE', unit: '%', min: 5, max: 40, step: 0.5, dp: 1 },
  targetWeight: { label: 'TARGET WEIGHT', unit: 'kg', min: 40, max: 160, step: 0.1, dp: 1 },
  targetBf: { label: 'TARGET BODY FAT', unit: '%', min: 5, max: 40, step: 0.5, dp: 1 },
} as const;

function ScrubOf({ k, d, onChange, acc }: { k: keyof typeof SCRUB; d: Intake; onChange: (v: number) => void; acc: string }) {
  const c = SCRUB[k];
  return <Scrub label={c.label} unit={c.unit} value={d[k]} step={c.step} min={c.min} max={c.max} dp={c.dp} onChange={onChange} acc={acc} />;
}

const stepper = (d: Intake, set: SetFn, k: 'age' | 'waist' | 'bench' | 'squat' | 'dead' | 'pullups' | 'run5k' | 'wake' | 'bed' | 'steps', label: string, unit: string, step: number, min: number, max: number, show?: (v: number) => string) => {
  const v = d[k], clamp = (x: number) => Math.min(max, Math.max(min, +x.toFixed(2)));
  return { label, unit, value: show ? show(v) : String(v), minus: () => set(k, clamp(v - step)), plus: () => set(k, clamp(v + step)) };
};

function BodyStep({ d, set, acc }: StepProps) {
  return (
    <>
      <Block i={0} label="BIOLOGY · FOR THE MATH" acc={acc}><Seg value={d.sex} opts={[['Male', 'Male'], ['Female', 'Female']]} onPick={v => set('sex', v)} acc={acc} /></Block>
      <Block i={1} acc={acc}><ScrubOf k="height" d={d} onChange={v => set('height', v)} acc={acc} /></Block>
      <Block i={2} acc={acc}><ScrubOf k="weight" d={d} onChange={v => set('weight', v)} acc={acc} /></Block>
      <Block i={3} acc={acc}><ScrubOf k="bf" d={d} onChange={v => set('bf', v)} acc={acc} /></Block>
      <Block i={4} acc={acc}><Nums items={[stepper(d, set, 'age', 'AGE', 'yrs', 1, 14, 80), stepper(d, set, 'waist', 'WAIST', 'cm', 1, 50, 160)]} /></Block>
    </>
  );
}

function TargetStep({ d, patch, acc, acc2, bg }: { d: Intake; patch: (o: Partial<Intake>) => void; acc: string; acc2: string; bg: string }) {
  const r = weeklyRate(d), total = r * d.weeks, fast = (Math.abs(r) / d.weight) * 100 > 1;
  const stats: [string, string, string][] = [
    ['CHANGE', `${total > 0 ? '+' : ''}${total.toFixed(1)} kg`, C.text],
    ['PER WEEK', `${r > 0 ? '+' : ''}${r.toFixed(2)}`, fast ? C.alertSoft : acc],
    ['LEAN MASS', (d.targetWeight * (1 - d.targetBf / 100)).toFixed(1), C.text],
  ];
  return (
    <>
      <Rise delay={250} style={{ flexDirection: 'row', gap: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' }}>
        {stats.map(([l, v, c]) => (
          <View key={l} style={{ flex: 1, backgroundColor: bg, paddingVertical: 13, paddingHorizontal: 12 }}>
            <Txt face="mono" size={9.5} ls={0.16} color={C.dim}>{l}</Txt>
            <Txt face="mono" size={19} w={500} color={c} style={{ marginTop: 5 }} numberOfLines={1}>{v}</Txt>
          </View>
        ))}
      </Rise>
      <Block i={1} acc={acc}><ScrubOf k="targetWeight" d={d} onChange={v => patch({ targetWeight: v, targetTouched: true })} acc={acc} /></Block>
      <Block i={2} acc={acc}><ScrubOf k="targetBf" d={d} onChange={v => patch({ targetBf: v, targetTouched: true })} acc={acc} /></Block>
      <Rise delay={550} style={{ height: 88, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
        <Txt face="mono" size={9.5} ls={0.16} color={C.dim} style={{ position: 'absolute', left: 14, top: 11 }}>TRAJECTORY · 軌道</Txt>
        <View style={{ position: 'absolute', left: 16, right: 16, top: 42, height: 2, backgroundColor: acc }} />
        <View style={{ position: 'absolute', right: 16, top: 42, width: '45%', height: 2, backgroundColor: acc2 }} />
        <View style={{ position: 'absolute', left: 12, top: 38, width: 10, height: 10, borderRadius: 5, backgroundColor: acc, shadowColor: acc, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }} />
        <View style={{ position: 'absolute', right: 12, top: 36, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: acc2, backgroundColor: bg }} />
        <Txt face="mono" size={10} color={C.sub} style={{ position: 'absolute', left: 14, bottom: 11 }}>{`NOW · ${d.weight} KG · ${d.bf}%`}</Txt>
        <Txt face="mono" size={10} color={C.text} style={{ position: 'absolute', right: 14, bottom: 11 }}>{`${shortDate(deadlineOf(d, new Date()))} · ${d.targetWeight} KG · ${d.targetBf}%`}</Txt>
      </Rise>
    </>
  );
}

function PowerStep({ d, set, acc }: StepProps) {
  return (
    <>
      <Block i={0} label="TRAINING AGE" acc={acc}><Seg value={d.exp} opts={[['New', 'New'], ['1–3 yrs', '1–3 yrs'], ['3+ yrs', '3+ yrs']]} onPick={v => set('exp', v)} acc={acc} /></Block>
      <Block i={1} label="CURRENT BESTS · SKIP WHAT YOU DON’T DO" acc={acc}>
        <Nums items={[
          stepper(d, set, 'bench', 'BENCH', 'kg', 2.5, 0, 300), stepper(d, set, 'squat', 'SQUAT', 'kg', 2.5, 0, 400),
          stepper(d, set, 'dead', 'DEADLIFT', 'kg', 2.5, 0, 450), stepper(d, set, 'pullups', 'PULL-UPS', 'reps', 1, 0, 60),
          stepper(d, set, 'run5k', '5K RUN', '', 15, 900, 3600, mmss),
        ]} />
      </Block>
    </>
  );
}

function TrainStep({ d, set, acc }: StepProps) {
  const rest = 7 - d.sessions;
  return (
    <>
      <Block i={0} label="DISCIPLINES" acc={acc}><Chips opts={['Hypertrophy', 'Strength', 'Calisthenics', 'Running']} isOn={o => on(d.disc, o)} onPick={o => set('disc', toggle(d.disc, o))} acc={acc} /></Block>
      <Block i={1} label="SESSIONS / WEEK" right={`${rest} REST DAY${rest === 1 ? '' : 'S'}`} acc={acc}><Seg value={d.sessions} opts={[2, 3, 4, 5, 6, 7].map(n => [n, String(n)] as [number, string])} onPick={v => set('sessions', v)} acc={acc} /></Block>
      <Block i={2} label="SESSION LENGTH" right="MINUTES" acc={acc}><Seg value={d.length} opts={[30, 45, 60, 75, 90].map(n => [n, String(n)] as [number, string])} onPick={v => set('length', v)} acc={acc} /></Block>
      <Block i={3} label="WHEN I EXPECT YOU" acc={acc}><Seg value={d.time} opts={[['Morning', 'Morning', '06:30'], ['Midday', 'Midday', '12:30'], ['Evening', 'Evening', '18:30'], ['Night', 'Night', '21:00']]} onPick={v => set('time', v)} acc={acc} /></Block>
      <Block i={4} label="EQUIPMENT" acc={acc}><Chips opts={['Full gym', 'Home dumbbells', 'Barbell + rack', 'Pull-up bar', 'Bands', 'Bodyweight only']} isOn={o => on(d.equip, o)} onPick={o => set('equip', toggle(d.equip, o))} acc={acc} /></Block>
    </>
  );
}

function LifeStep({ d, set, acc }: StepProps) {
  return (
    <>
      <Block i={0} label="WORK" acc={acc}><Seg value={d.job} opts={[['Desk', 'Desk'], ['On my feet', 'On my feet'], ['Physical', 'Physical']]} onPick={v => set('job', v)} acc={acc} /></Block>
      <Block i={1} label={`SLEEP · ${sleepHours(d).toFixed(1)} H`} acc={acc}><Nums items={[stepper(d, set, 'wake', 'WAKE', '', 15, 0, 1425, clockOf), stepper(d, set, 'bed', 'BED', '', 15, 0, 1425, clockOf)]} /></Block>
      <Block i={2} label="STRESS LEVEL" acc={acc}><Seg value={d.stress} opts={[[1, '1', 'calm'], [2, '2'], [3, '3'], [4, '4'], [5, '5', 'max']]} onPick={v => set('stress', v)} acc={acc} /></Block>
      <Block i={3} acc={acc}><Nums items={[stepper(d, set, 'steps', 'DAILY STEPS', '', 1000, 2000, 25000, v => v.toLocaleString('en-US'))]} /></Block>
    </>
  );
}

function KitchenStep({ d, set, acc }: StepProps) {
  return (
    <>
      <Block i={0} label="DIET" acc={acc}><Chips opts={['Non-veg', 'Eggetarian', 'Vegetarian', 'Vegan', 'Jain', 'Pescatarian']} isOn={o => d.diet === o} onPick={o => set('diet', o)} acc={acc} /></Block>
      <Block i={1} label="WHAT YOU USUALLY EAT" acc={acc}><Chips opts={['Indian', 'Western', 'East Asian', 'Mediterranean', 'Mixed']} isOn={o => on(d.cuisine, o)} onPick={o => set('cuisine', toggle(d.cuisine, o))} acc={acc} /></Block>
      <Block i={2} label="MEALS A DAY" acc={acc}><Seg value={d.meals} opts={[2, 3, 4, 5, 6].map(n => [n, String(n)] as [number, string])} onPick={v => set('meals', v)} acc={acc} /></Block>
      <Block i={3} label="COOKING" acc={acc}><Seg value={d.cook} opts={[['I cook', 'I cook'], ['Sometimes', 'Sometimes'], ['Never', 'Never']]} onPick={v => set('cook', v)} acc={acc} /></Block>
      <Block i={4} label="ALCOHOL" acc={acc}><Seg value={d.alcohol} opts={[['None', 'None'], ['Weekends', 'Weekends'], ['Often', 'Often']]} onPick={v => set('alcohol', v)} acc={acc} /></Block>
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
  const macros: [string, string, number, string, string, number][] = [
    ['蛋', 'Protein', c.p, acc, `${(c.p / d.weight).toFixed(1)} g per kg. ${veg ? 'Paneer, dal, tofu, whey. Every meal.' : 'Non-negotiable. This keeps the muscle.'}`, 4],
    ['炭', 'Carbs', c.c, C.carbs, `Around training. ${d.time === 'Morning' ? 'Breakfast after the session.' : `Bigger meal before ${trainTime(d)}.`}`, 4],
    ['脂', 'Fat', c.f, C.fat, d.alcohol === 'None' ? 'Hormones need it. Do not go lower.' : `Alcohol comes out of this budget. ${d.alcohol} is noted.`, 9],
  ];
  const adj = `${c.adj > 0 ? '+' : ''}${Math.round(c.adj * 100)}% · ${g.tag}`;
  const math = `BMR ${c.bmr.toLocaleString('en-US')} × ${c.af.toFixed(2)} ACTIVITY ${c.adj > 0 ? '+' : '−'}${Math.abs(Math.round(c.adj * 100))}%${d.kcalAdj ? ` ${d.kcalAdj > 0 ? '+' : '−'}${Math.abs(d.kcalAdj)} YOU` : ''}`;
  return (
    <View style={{ gap: 10 }}>
      <Rise delay={250} style={{ paddingTop: 20, paddingHorizontal: 18, paddingBottom: 18, borderRadius: 12, borderWidth: 1.5, borderColor: acc, backgroundColor: solid(acc, 0.06), ...comic(alpha(acc, 0.45), 4) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt face="mono" size={10.5} ls={0.16} color={C.sub}>DAILY FUEL · 燃料</Txt>
          <Txt face="mono" size={10.5} ls={0.16} color={acc}>{adj}</Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Txt face="mono" size={56} w={500} ls={-0.04} lh={1}>{Math.round(c.kcal * count).toLocaleString('en-US')}</Txt>
            <Txt size={15} color={C.sub}>kcal</Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[['−', -50], ['+', 50]].map(([l, dv]) => (
              <Tap key={l as string} onPress={() => set('kcalAdj', d.kcalAdj + (dv as number))} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={18} color={C.body}>{l as string}</Txt>
              </Tap>
            ))}
          </View>
        </View>
        <Txt face="mono" size={10.5} ls={0.06} color={C.label} style={{ marginTop: 12 }}>{math}</Txt>
      </Rise>
      {macros.map(([k, label, grams, color, note, perG], i) => (
        <Rise key={label} delay={400 + i * 100} style={{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
              <Txt face="jp" size={15} w={500} color={color}>{k}</Txt>
              <Txt size={15} w={500}>{label}</Txt>
            </View>
            <Txt face="mono" size={18} w={500}>{Math.round(grams * count)}<Txt face="mono" size={12} color={C.dim}> g</Txt></Txt>
          </View>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)', marginTop: 9, overflow: 'hidden' }}>
            <View style={{ height: 4, borderRadius: 2, width: `${Math.min(100, ((grams * perG) / c.kcal) * 100 * count * 2)}%`, backgroundColor: color }} />
          </View>
          <Txt size={12.5} color={C.sub} lh={1.4} style={{ marginTop: 7 }}>{note}</Txt>
        </Rise>
      ))}
    </View>
  );
}

function WeakStep({ d, set, acc }: StepProps) {
  return (
    <>
      <Block i={0} label="WHAT USUALLY MAKES YOU QUIT" acc={acc}><Chips opts={['Work gets busy', 'Weekends', 'Late-night snacking', 'Low motivation', 'Travel', 'Social eating', 'Boredom', 'Bad sleep']} isOn={o => on(d.quit, o)} onPick={o => set('quit', toggle(d.quit, o))} acc={acc} /></Block>
      <Block i={1} label="INJURIES · I PLAN AROUND THEM" acc={acc}><Chips opts={['None', 'Lower back', 'Knee', 'Shoulder', 'Wrist', 'Elbow', 'Ankle']} isOn={o => on(d.injuries, o)} onPick={o => set('injuries', toggle(d.injuries, o))} acc={acc} /></Block>
      <Block i={2} label="ANYTHING ELSE I SHOULD NEVER FORGET" acc={acc}><Field value={d.note} onChange={v => set('note', v)} placeholder="Night shifts on Thursdays" /></Block>
    </>
  );
}

function ToneStep({ d, set, acc }: StepProps) {
  const hard = d.tone === 'Tough love' && d.intensity >= 4;
  return (
    <>
      <View style={{ gap: 8 }}>
        {TONES.map((o, i) => {
          const p = pick(d.tone === o.id, acc);
          return (
            <Rise key={o.id} delay={200 + i * 80}>
              <Tap onPress={() => set('tone', o.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, borderColor: p.borderColor, backgroundColor: p.backgroundColor, ...(d.tone === o.id ? comic(alpha(acc, 0.55), 3) : null) }}>
                <Outline text={o.k} size={30} color={p.kStroke} />
                <View style={{ flex: 1 }}>
                  <Txt size={16} w={600}>{o.id}</Txt>
                  <Txt size={12.5} color={C.sub} style={{ marginTop: 2 }}>{o.sub}</Txt>
                </View>
                <Txt face="mono" size={9.5} ls={0.14} color={acc}>{p.check}</Txt>
              </Tap>
            </Rise>
          );
        })}
      </View>
      <Block i={3} label="INTENSITY" right={['', 'GENTLE', 'STEADY', 'FIRM', 'HARD', 'RELENTLESS'][d.intensity]} acc={acc}>
        <Seg value={d.intensity} opts={[1, 2, 3, 4, 5].map(n => [n, String(n)] as [number, string])} onPick={v => set('intensity', v)} acc={acc} />
      </Block>
      <Block i={4} label="WHOSE VOICE" right={characterOf(d.character).series.toUpperCase()} acc={acc}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CHARACTERS.map(c => {
            const on = (d.character || 'rei') === c.id;
            return (
              <Tap key={c.id} onPress={() => set('character', c.id)} style={{ width: '31%', flexGrow: 1 }}>
                <View style={{ height: 84, borderRadius: 10, borderWidth: 1.5, borderColor: on ? c.acc : 'rgba(255,255,255,0.1)', backgroundColor: on ? solid(c.acc, 0.12) : '#0D0E11', padding: 10, justifyContent: 'space-between', overflow: 'hidden', ...(on ? comic(alpha(c.acc, 0.6), 3) : null) }}>
                  <Icon name={c.icon} size={22} color={on ? c.acc : C.muted} tint={on ? 0.3 : 0.1} />
                  <View>
                    <Txt size={13} w={600} numberOfLines={1}>{c.name}</Txt>
                    <Txt face="mono" size={8} ls={0.1} color={c.fish || c.id === 'rei' ? (on ? c.acc : C.dim) : C.faint} numberOfLines={1}>{c.fish || c.id === 'rei' ? c.series.toUpperCase() : 'VOICE SOON'}</Txt>
                  </View>
                </View>
              </Tap>
            );
          })}
        </View>
      </Block>
      <Rise delay={700}>
        <FieldLabel label="PREVIEW · TUESDAY 12:40 · 2 SESSIONS MISSED" acc={acc} />
        <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, borderColor: hard ? C.alertSoft : acc, backgroundColor: 'rgba(255,255,255,0.03)' }}>
          <Txt size={15.5} lh={1.45} color={C.textSoft}>{toneSample(d.tone, d)}</Txt>
        </View>
      </Rise>
    </>
  );
}

function WorldStep({ d, set }: { d: Intake; set: SetFn }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {THEMES.map((t, i) => {
        const sel = d.theme === t.id;
        return (
          <Rise key={t.id} delay={200 + i * 60} style={{ width: '48.4%', flexGrow: 1 }}>
            <Tap onPress={() => set('theme', t.id)} style={{ height: 146, padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: sel ? t.acc : 'rgba(255,255,255,0.1)', backgroundColor: sel ? solid(t.acc, 0.08) : '#0D0E11', justifyContent: 'space-between', overflow: 'hidden', ...(sel ? comic(t.acc, 3) : null) }}>
              <View style={{ position: 'absolute', right: -14, bottom: -18 }}>
                <Icon name={t.icon} size={112} color={sel ? t.acc : 'rgba(255,255,255,0.14)'} tint={sel ? 0.16 : 0} strokeWidth={1.1} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.acc, shadowColor: t.acc, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.acc2 }} />
                </View>
                <Txt face="mono" size={9.5} ls={0.12} color={t.acc}>{sel ? '● ON' : ''}</Txt>
              </View>
              <View>
                <Txt size={15.5} w={600} lh={1.2}>{t.name}</Txt>
                <Txt size={11} color={C.sub} style={{ marginTop: 3 }}>{t.vibe}</Txt>
              </View>
            </Tap>
          </Rise>
        );
      })}
    </View>
  );
}

function LinkStep({ d, set, acc }: StepProps) {
  const items: ['health' | 'nudge' | 'speak' | 'photo', string, string, string][] = [
    ['health', '心', 'Apple Health', 'Steps, sleep, workouts and weight, read automatically. Coming soon.'],
    ['nudge', '鐘', 'Check-ins', 'I message you when you slip. Late session, low protein, bedtime.'],
    ['speak', '声', 'Voice', 'I speak replies out loud in voice mode.'],
    ['photo', '眼', 'Camera meals', 'Snap a plate and I log the macros.'],
  ];
  return (
    <View style={{ gap: 8 }}>
      {items.map(([k, kj, label, sub], i) => (
        <Rise key={k} delay={220 + i * 80}><ToggleRow k={kj} label={label} sub={sub} on={d[k]} onPress={() => set(k, !d[k])} acc={acc} /></Rise>
      ))}
    </View>
  );
}

function PactStep({ d, acc, onSeal }: { d: Intake; acc: string; onSeal: () => void }) {
  return (
    <View style={{ gap: 16 }}>
      <Rise delay={250} style={{ paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: '#0E0F12', overflow: 'hidden', ...comic(acc, 5) }}>
        <Outline text="誓" size={150} color={alpha(acc, 0.3)} width={1} style={{ position: 'absolute', right: -12, top: -34 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt face="mono" size={10} ls={0.16} color={C.dim}>契約書 · PACT No.0001</Txt>
          <Txt face="mono" size={10} ls={0.16} color={C.dim}>{shortDate(new Date(), true)}</Txt>
        </View>
        <Txt size={14} color={C.sub} style={{ marginTop: 14 }}>I, <Txt size={14} w={600}>{nameOf(d)}</Txt>, will</Txt>
        <Txt size={20} w={600} lh={1.35} ls={-0.01} style={{ marginTop: 4 }}>{vowSentence(d, new Date())}</Txt>
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
          {pactRows(d).map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
              <Txt face="mono" size={9.5} ls={0.16} color={C.dim}>{k}</Txt>
              <Txt size={13} color={C.textSoft} align="right" style={{ flex: 1 }}>{v}</Txt>
            </View>
          ))}
        </View>
      </Rise>
      <Rise delay={500}><HoldSeal acc={acc} onSeal={onSeal} /></Rise>
    </View>
  );
}

/** New users make their account here, right after sealing the pact. */
function AccountStep({ acc }: { acc: string }) {
  const s = useStore();
  const [mode, setMode] = useState<'up' | 'in'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const denied = s.account.status === 'denied';
  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6;
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setNote('');
    try {
      await (mode === 'up' ? s.signUp(email, password) : s.signIn(email, password));
    } catch (e) {
      setNote(authMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Block i={0} label="EMAIL" acc={acc}><Field value={email} onChange={setEmail} placeholder="you@example.com" keyboard="email-address" autoCapitalize="none" /></Block>
      <Block i={1} label="PASSWORD · 6+ CHARACTERS" acc={acc}><Field value={password} onChange={setPassword} placeholder="Password" secure autoCapitalize="none" /></Block>
      {denied ? <Txt size={13.5} color={C.alertSoft} lh={1.4}>{`${s.account.email ?? 'That email'} isn’t on the REI tester list yet. Ask for an invite, then sign in.`}</Txt> : null}
      {note ? <Txt size={13.5} color={C.alertSoft} lh={1.4}>{note}</Txt> : null}
      <Rise delay={380} style={{ gap: 6 }}>
        <Cta label={busy ? 'Linking…' : mode === 'up' ? 'Create my account' : 'Sign in'} acc={acc} disabled={!valid || busy} onPress={submit} />
        <Tap onPress={() => setMode(m => (m === 'up' ? 'in' : 'up'))} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={14} color={C.muted}>{mode === 'up' ? 'I already have an account' : 'New here? Create an account'}</Txt>
        </Tap>
      </Rise>
    </>
  );
}

function Bond({ d, acc, acc2, bg, insetTop, insetBottom, onEnter, onReplay }: { d: Intake; acc: string; acc2: string; bg: string; insetTop: number; insetBottom: number; onEnter: () => void; onReplay: () => void }) {
  const { width: W } = useWindowDimensions();
  const c = fuel(d);
  const [stamp] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(stamp, { toValue: 1, duration: 800, delay: 150, easing: Easing.bezier(0.2, 0.9, 0.3, 1), useNativeDriver: true }).start();
  }, [stamp]);
  const stats: [string, string][] = [['DAILY', c.kcal.toLocaleString('en-US')], ['PROTEIN', `${c.p} g`], ['WEEKS', String(d.weeks)]];
  return (
    <View style={{ flex: 1, paddingTop: insetTop + 20, paddingHorizontal: 24, paddingBottom: insetBottom + 14 }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: W / 2 - 490, top: '34%', marginTop: -490 }}>
        <SpeedLines size={980} color={acc} inner={0.11} outer={0.42} count={96} opacity={0.85} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <Rise delay={350} from={0} style={{ position: 'absolute', left: 4, top: 16 }}>
          <Outline text="ドン!" size={86} color={acc} width={2} />
        </Rise>
        <Animated.View
          style={{
            width: 128, height: 128, borderRadius: 14, borderWidth: 3, borderColor: acc, backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
            ...comic(acc2, 6),
            opacity: stamp.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1] }),
            transform: [
              { scale: stamp.interpolate({ inputRange: [0, 0.55, 0.75, 1], outputRange: [2.8, 0.9, 1.04, 1] }) },
              { rotate: stamp.interpolate({ inputRange: [0, 0.55, 1], outputRange: ['-24deg', '-8deg', '-8deg'] }) },
            ],
          }}
        >
          <Txt face="jp" size={72} w={500} color={acc} lh={1}>絆</Txt>
        </Animated.View>
        <Rise delay={800} style={{ alignItems: 'center', gap: 8 }}>
          <Txt face="mono" size={10.5} ls={0.26} color={acc}>契約成立 · PACT SEALED</Txt>
          <Txt size={34} w={600} ls={-0.035}>Bond established.</Txt>
        </Rise>
        <Rise delay={1000} style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
          {stats.map(([k, v]) => (
            <View key={k} style={{ flex: 1, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: alpha(bg, 0.7) }}>
              <Txt face="mono" size={9} ls={0.16} color={C.dim}>{k}</Txt>
              <Txt face="mono" size={17} w={500} style={{ marginTop: 4 }}>{v}</Txt>
            </View>
          ))}
        </Rise>
      </View>
      <Rise delay={1250} style={{ gap: 18 }}>
        <Bubble acc={acc}><Txt size={16} w={500} color="#0A0B0D" lh={1.42}>{bondLine(d)}</Txt></Bubble>
        <View style={{ gap: 4 }}>
          <Cta label="Enter REI" kanji="入" acc={acc} onPress={onEnter} />
          <Tap onPress={onReplay} style={{ height: 42, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={14} color={C.dim}>Replay from the cover</Txt>
          </Tap>
        </View>
      </Rise>
    </View>
  );
}
