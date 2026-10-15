// First run, after the account exists: the cover, sixteen chapters, the pact, the bond and the dive
// into the app. Same look as the Dojo: dark panels, hard accent shadows, icons instead of kanji.
// Numbers and wording come from @rei/shared (onboarding.ts); this file is the stage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ARCHETYPES, bondLine, CHAPTERS, CHARACTERS, characterOf, clockOf, deadlineOf, DEFAULT_INTAKE, fuel, goalOf, GOALS, greeting, hasVoice, type Intake, mmss, nameOf, pactRows, reiLine, shortDate,
  sleepHours, STEPS, suggestedTarget, TONES, toneSample, trainTime, vowSentence, weeklyRate,
} from '@rei/shared';
import { Icon, type IconKey } from '../components/icons';
import { Core } from '../components/Core';
import { Gauge, Stamp } from '../components/manga';
import { ChapterCard, EnterFx, Flash, HoldSeal, markArrival } from '../components/onboarding/fx';
import { Atmosphere, Chips, comic, Cta, Field, FieldLabel, Nums, pick, Picked, Rise, Scrub, Seg, solid, ToggleRow } from '../components/onboarding/kit';
import { Tap, Txt } from '../components/ui';
import { alpha, C, EMBLEMS, fontFamily, THEMES } from '../lib/theme';
import { playGreeting, prefetchGreetings } from '../lib/greetings';
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
/** Chapter number of a step (the cover is 0). */
const chapterOf = (step: number) => STEPS.slice(1, step + 1).filter(x => x.t).length;

export default function Onboarding() {
  const s = useStore();
  const insets = useSafeAreaInsets();

  const [d, setD] = useState<Intake>(() => ({ ...DEFAULT_INTAKE, name: s.profile.name || '' }));
  const [step, setStep] = useState(0);
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

  // REI types its line for each chapter (and again when the chosen ideal or partner changes).
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
    if (!instant && to.t && i > step) {
      pendingArrive.current = arrive;
      setCard({ to: i, key: Date.now() });
    } else arrive();
  };

  // Past the name chapter, every partner's greeting with their name is made in the background,
  // so the Partner chapter plays it the moment a card is tapped.
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

  const emblem = d.theme === 'shinobi' ? EMBLEMS.shinobi?.[0]?.source : null;

  return (
    <View style={{ flex: 1, backgroundColor: bg, overflow: 'hidden' }}>
      <Atmosphere acc={acc} acc2={acc2} />
      {emblem ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Image source={emblem} style={{ width: 300, height: 300, opacity: 0.1 }} contentFit="contain" />
        </View>
      ) : null}

      {st.id === 'boot' ? <Cover acc={acc} email={s.account.email} onBegin={() => go(1)} onSignOut={() => void s.signOut()} insetTop={insets.top} insetBottom={insets.bottom} /> : null}

      {st.t ? (
        <Chapter
          step={step} acc={acc} insetTop={insets.top} insetBottom={insets.bottom}
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
          {st.id === 'partner' ? <PartnerStep d={d} patch={patch} acc={acc} /> : null}
          {st.id === 'world' ? <WorldStep d={d} set={set} /> : null}
          {st.id === 'link' ? <LinkStep d={d} set={set} acc={acc} /> : null}
          {st.id === 'pact' ? <PactStep d={d} acc={acc} onSeal={seal} /> : null}
        </Chapter>
      ) : null}

      {st.id === 'done' ? <Bond d={d} acc={acc} acc2={acc2} bg={bg} insetTop={insets.top} insetBottom={insets.bottom} onEnter={enter} /> : null}

      {card ? (
        <ChapterCard
          key={card.key} n={chapterOf(card.to)} icon={STEPS[card.to].icon ?? 'rei'} t={STEPS[card.to].t ?? ''} total={CHAPTERS} acc={acc} bg={bg}
          onSwap={() => pendingArrive.current()} onEnd={() => setCard(null)}
        />
      ) : null}
      {flash ? <Flash onEnd={() => setFlash(false)} /> : null}
      {entering ? <EnterFx name={nameOf(d)} acc={acc} bg={bg} onEnd={entered} /> : null}
    </View>
  );
}

function Cover({ acc, email, onBegin, onSignOut, insetTop, insetBottom }: { acc: string; email: string | null; onBegin: () => void; onSignOut: () => void; insetTop: number; insetBottom: number }) {
  const boot: [string, string][] = [
    ['REI SYSTEM · v1.0', C.dim],
    [`ACCOUNT LINKED · ${(email ?? 'YOU').toUpperCase()}`, C.dim],
    ['NO OPERATOR PROFILE FOUND', C.alertSoft],
    ['PACT PROTOCOL READY ▍', acc],
  ];
  return (
    <View style={{ flex: 1, paddingTop: insetTop + 14, paddingHorizontal: 22, paddingBottom: insetBottom + 16 }}>
      <View style={{ gap: 6 }}>
        {boot.map(([t, color], i) => (
          <Rise key={t} delay={100 + i * 280} from={0}><Txt face="mono" size={11} ls={0.14} color={color} numberOfLines={1}>{t}</Txt></Rise>
        ))}
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <Rise delay={1100} from={-20}><Core size={150} color={acc} /></Rise>
        <Rise delay={1500} style={{ alignItems: 'center', gap: 10 }}>
          <View style={{ alignItems: 'center' }}>
            <Stamp text="Vol.01 · The Pact Arc" color={acc} tilt={-3} size={10} />
          </View>
          <Txt size={52} w={600} ls={-0.04}>REI</Txt>
        </Rise>
      </View>
      <Rise delay={1900} style={{ gap: 18 }}>
        <View style={{ padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: alpha(acc, 0.45), backgroundColor: '#0D0F13', ...comic(alpha(acc, 0.5), 4) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Icon name="rei" size={16} color={acc} />
            <Txt face="mono" size={10.5} ls={0.18} color={acc}>REI</Txt>
          </View>
          <Txt size={17} w={500} lh={1.42}>{`You’re in. Good. I don’t do generic. ${({ 14: 'Fourteen', 15: 'Fifteen', 16: 'Sixteen', 17: 'Seventeen' } as Record<number, string>)[CHAPTERS] ?? CHAPTERS} short chapters and I’ll know exactly who you want to become, and when you’re lying to yourself about it.`}</Txt>
        </View>
        <View style={{ gap: 4 }}>
          <Cta label="Begin chapter 1" icon="scroll" acc={acc} onPress={onBegin} />
          <Tap onPress={onSignOut} style={{ height: 42, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={13.5} color={C.dim}>Not you? Sign out</Txt>
          </Tap>
        </View>
      </Rise>
    </View>
  );
}

/** The frame around every chapter: back, progress, the chapter crest and title, REI's typed line, the answers, and the call to action. */
function Chapter({ step, acc, insetTop, insetBottom, line, typing, onBack, cta, children }: { step: number; acc: string; insetTop: number; insetBottom: number; line: string; typing: boolean; onBack: () => void; cta: ReactNode; children: ReactNode }) {
  const st = STEPS[step];
  const n = chapterOf(step);
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -40, bottom: 70, opacity: 0.05 }}>
        <Icon name={st.icon ?? 'rei'} size={280} color="#FFFFFF" tint={0.3} strokeWidth={0.9} />
      </View>
      <View style={{ flex: 1, paddingTop: insetTop + 8, paddingHorizontal: 20, paddingBottom: insetBottom + 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 40 }}>
          <Tap onPress={onBack} style={{ width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D0F13', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={18} color={C.body} strokeWidth={2} />
          </Tap>
          <View style={{ flex: 1 }}>
            <Gauge pct={n / CHAPTERS} acc={acc} segments={CHAPTERS} height={6} />
          </View>
          <Txt face="mono" size={12} w={500} color={acc} style={{ minWidth: 46, textAlign: 'right' }}>{`${String(n).padStart(2, '0')}/${CHAPTERS}`}</Txt>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <View style={{ width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: solid(acc, 0.1, '#0D0F13'), borderWidth: 1.5, borderColor: alpha(acc, 0.45), transform: [{ rotate: '-4deg' }] }}>
            <Icon name={st.icon ?? 'rei'} size={26} color={acc} tint={0.3} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt face="mono" size={10} ls={0.16} color={C.muted}>{`CHAPTER ${String(n).padStart(2, '0')}`}</Txt>
            <Txt size={26} w={600} ls={-0.02} lh={1.1}>{(st.t ?? '').charAt(0) + (st.t ?? '').slice(1).toLowerCase()}</Txt>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 14, padding: 14, minHeight: 92, borderRadius: 14, borderWidth: 1.5, borderColor: alpha(acc, 0.4), backgroundColor: '#0D0F13', ...comic(alpha(acc, 0.45), 4) }}>
          <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Core size={34} speaking={typing} color={acc} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt face="mono" size={10} ls={0.18} color={acc}>REI</Txt>
            <Txt size={15.5} w={500} lh={1.42} style={{ marginTop: 3 }}>
              {line}
              {typing ? <Txt size={15.5} color={acc}>▍</Txt> : null}
            </Txt>
          </View>
        </View>

        <ScrollView style={{ flex: 1, marginTop: 14, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
              style={{ height: 196, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderColor, backgroundColor: p.backgroundColor, padding: 12, justifyContent: 'space-between', overflow: 'hidden', ...(sel ? comic(alpha(acc, 0.55), 3) : null) }}
            >
              <View pointerEvents="none" style={{ position: 'absolute', right: -16, top: 14, opacity: sel ? 0.5 : 0.16 }}>
                <Icon name={a.icon} size={104} color={sel ? acc : '#FFFFFF'} tint={0.2} strokeWidth={1.1} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt face="mono" size={9.5} ls={0.16} color={C.label}>{`TYPE ${String(i + 1).padStart(2, '0')}`}</Txt>
                <Picked on={sel} acc={acc} />
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
        <Tap onPress={() => d.arch !== 'none' && patch({ arch: 'none', targetTouched: false })} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: own.borderColor, backgroundColor: own.backgroundColor }}>
          <Icon name="profile" size={28} color={d.arch === 'none' ? acc : C.muted} />
          <View style={{ flex: 1 }}>
            <Txt size={15.5} w={600}>None. My own vision.</Txt>
            <Txt size={12.5} color={C.sub} style={{ marginTop: 2 }}>Describe it in your vow. I’ll build the plan around it.</Txt>
          </View>
          <Picked on={d.arch === 'none'} acc={acc} />
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
              <Tap key={g.id} onPress={() => set('goal', g.id)} style={{ width: '48.4%', flexGrow: 1, minHeight: 104, padding: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderColor, backgroundColor: p.backgroundColor, justifyContent: 'space-between', overflow: 'hidden', ...(d.goal === g.id ? comic(alpha(acc, 0.55), 3) : null) }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Icon name={g.icon} size={24} color={d.goal === g.id ? acc : C.muted} tint={d.goal === g.id ? 0.3 : 0.12} />
                  <Txt face="mono" size={9.5} ls={0.16} color={d.goal === g.id ? acc : C.label}>{g.tag}</Txt>
                </View>
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
      <Rise delay={250} style={{ flexDirection: 'row', gap: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' }}>
        {stats.map(([l, v, c]) => (
          <View key={l} style={{ flex: 1, backgroundColor: '#0D0F13', paddingVertical: 13, paddingHorizontal: 12 }}>
            <Txt face="mono" size={9.5} ls={0.16} color={C.dim}>{l}</Txt>
            <Txt face="mono" size={19} w={500} color={c} style={{ marginTop: 5 }} numberOfLines={1}>{v}</Txt>
          </View>
        ))}
      </Rise>
      <Block i={1} acc={acc}><ScrubOf k="targetWeight" d={d} onChange={v => patch({ targetWeight: v, targetTouched: true })} acc={acc} /></Block>
      <Block i={2} acc={acc}><ScrubOf k="targetBf" d={d} onChange={v => patch({ targetBf: v, targetTouched: true })} acc={acc} /></Block>
      <Rise delay={550} style={{ height: 88, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0D0F13', overflow: 'hidden' }}>
        <Txt face="mono" size={9.5} ls={0.16} color={C.dim} style={{ position: 'absolute', left: 14, top: 11 }}>TRAJECTORY</Txt>
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
  const macros: [IconKey, string, number, string, string, number][] = [
    ['protein', 'Protein', c.p, acc, `${(c.p / d.weight).toFixed(1)} g per kg. ${veg ? 'Paneer, dal, tofu, whey. Every meal.' : 'Non-negotiable. This keeps the muscle.'}`, 4],
    ['carbs', 'Carbs', c.c, C.carbs, `Around training. ${d.time === 'Morning' ? 'Breakfast after the session.' : `Bigger meal before ${trainTime(d)}.`}`, 4],
    ['fat', 'Fat', c.f, C.fat, d.alcohol === 'None' ? 'Hormones need it. Do not go lower.' : `Alcohol comes out of this budget. ${d.alcohol} is noted.`, 9],
  ];
  const adj = `${c.adj > 0 ? '+' : ''}${Math.round(c.adj * 100)}% · ${g.tag}`;
  const math = `BMR ${c.bmr.toLocaleString('en-US')} × ${c.af.toFixed(2)} ACTIVITY ${c.adj > 0 ? '+' : '−'}${Math.abs(Math.round(c.adj * 100))}%${d.kcalAdj ? ` ${d.kcalAdj > 0 ? '+' : '−'}${Math.abs(d.kcalAdj)} YOU` : ''}`;
  return (
    <View style={{ gap: 10 }}>
      <Rise delay={250} style={{ paddingTop: 20, paddingHorizontal: 18, paddingBottom: 18, borderRadius: 14, borderWidth: 1.5, borderColor: acc, backgroundColor: solid(acc, 0.06, '#0D0F13'), ...comic(alpha(acc, 0.45), 4) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="kcal" size={16} color={acc} />
            <Txt face="mono" size={10.5} ls={0.16} color={C.sub}>DAILY FUEL</Txt>
          </View>
          <Txt face="mono" size={10.5} ls={0.16} color={acc}>{adj}</Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Txt face="mono" size={56} w={500} ls={-0.04} lh={1}>{Math.round(c.kcal * count).toLocaleString('en-US')}</Txt>
            <Txt size={15} color={C.sub}>kcal</Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[['−', -50], ['+', 50]].map(([l, dv]) => (
              <Tap key={l as string} onPress={() => set('kcalAdj', Math.max(-600, Math.min(600, d.kcalAdj + (dv as number))))} style={{ width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0D0F13', alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={18} color={C.body}>{l as string}</Txt>
              </Tap>
            ))}
          </View>
        </View>
        <Txt face="mono" size={10.5} ls={0.06} color={C.label} style={{ marginTop: 12 }}>{math}</Txt>
      </Rise>
      {macros.map(([k, label, grams, color, note, perG], i) => (
        <Rise key={label} delay={400 + i * 100} style={{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#0D0F13', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name={k} size={20} color={color} />
              <Txt size={15} w={500}>{label}</Txt>
            </View>
            <Txt face="mono" size={18} w={500}>{Math.round(grams * count)}<Txt face="mono" size={12} color={C.dim}> g</Txt></Txt>
          </View>
          <View style={{ marginTop: 9 }}>
            <Gauge pct={Math.min(1, ((grams * perG) / Math.max(1, c.kcal)) * count * 2)} acc={color} segments={20} height={5} />
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
          const sel = d.tone === o.id, p = pick(sel, acc);
          return (
            <Rise key={o.id} delay={200 + i * 80}>
              <Tap onPress={() => set('tone', o.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderColor, backgroundColor: p.backgroundColor, ...(sel ? comic(alpha(acc, 0.55), 3) : null) }}>
                <Icon name={o.icon} size={26} color={sel ? acc : C.muted} tint={sel ? 0.3 : 0.12} />
                <View style={{ flex: 1 }}>
                  <Txt size={16} w={600}>{o.id}</Txt>
                  <Txt size={12.5} color={C.sub} style={{ marginTop: 2 }}>{o.sub}</Txt>
                </View>
                <Picked on={sel} acc={acc} />
              </Tap>
            </Rise>
          );
        })}
      </View>
      <Block i={3} label="INTENSITY" right={['', 'GENTLE', 'STEADY', 'FIRM', 'HARD', 'RELENTLESS'][d.intensity]} acc={acc}>
        <Seg value={d.intensity} opts={[1, 2, 3, 4, 5].map(n => [n, String(n)] as [number, string])} onPick={v => set('intensity', v)} acc={acc} />
      </Block>
      <Rise delay={600}>
        <FieldLabel label="PREVIEW · TUESDAY 12:40 · 2 SESSIONS MISSED" acc={acc} />
        <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: hard ? C.alertSoft : alpha(acc, 0.6), backgroundColor: '#0D0F13' }}>
          <Txt size={15.5} lh={1.45} color={C.textSoft}>{toneSample(d.tone, d)}</Txt>
        </View>
      </Rise>
    </>
  );
}

/**
 * Who's in their corner. Tapping a character picks them, repaints the chapters in their world and
 * plays their hello in their own voice. Characters whose voice hasn't arrived show the line instead.
 */
function PartnerStep({ d, patch, acc }: { d: Intake; patch: (o: Partial<Intake>) => void; acc: string }) {
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {CHARACTERS.map((c, i) => {
          const sel = (d.character || 'rei') === c.id, voiced = hasVoice(c), talking = playing === c.id;
          return (
            <Rise key={c.id} delay={200 + i * 60} style={{ width: '48.4%', flexGrow: 1 }}>
              <Tap onPress={() => void choose(c.id)}>
                <View style={{ height: 148, borderRadius: 12, borderWidth: 1.5, borderColor: sel ? c.acc : 'rgba(255,255,255,0.1)', backgroundColor: sel ? solid(c.acc, 0.12, '#0D0F13') : '#0D0F13', padding: 12, justifyContent: 'space-between', overflow: 'hidden', ...(sel ? comic(alpha(c.acc, 0.6), 3) : null) }}>
                  <View pointerEvents="none" style={{ position: 'absolute', right: -18, bottom: -18, opacity: sel ? 0.4 : 0.12 }}>
                    <Icon name={c.icon} size={104} color={c.acc} tint={0.2} strokeWidth={1.1} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    {voiced ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 6, backgroundColor: talking ? c.acc : 'rgba(255,255,255,0.06)' }}>
                        <Icon name="voice" size={12} color={talking ? C.ink : c.acc} strokeWidth={2} />
                        <Txt face="mono" size={8.5} ls={0.12} color={talking ? C.ink : C.body}>{talking ? 'PLAYING' : 'HEAR'}</Txt>
                      </View>
                    ) : (
                      <Stamp text="Voice soon" color={C.muted} tilt={0} size={8} />
                    )}
                    <Picked on={sel} acc={c.acc} />
                  </View>
                  <View style={{ gap: 1 }}>
                    <Txt size={18} w={600}>{c.name}</Txt>
                    <Txt face="mono" size={9} ls={0.12} color={sel ? c.acc : C.muted} numberOfLines={1}>{c.series.toUpperCase()}</Txt>
                  </View>
                </View>
              </Tap>
            </Rise>
          );
        })}
      </View>
      <Rise delay={700}>
        <FieldLabel label={`${cur.name.toUpperCase()} SAYS`} right={playing ? 'PLAYING…' : undefined} acc={cur.acc} />
        <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: alpha(cur.acc, 0.6), backgroundColor: '#0D0F13' }}>
          <Icon name={cur.icon} size={30} color={cur.acc} tint={0.3} />
          <Txt size={15} lh={1.45} color={C.textSoft} style={{ flex: 1 }}>{`“${greeting(cur, d.name)}”`}</Txt>
        </View>
        <Txt size={12} color={note ? C.warn : C.faint} lh={1.4} style={{ marginTop: 8 }}>{note || 'Tap a card to hear them; tap again to stop. You can change partner any time in Settings.'}</Txt>
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
            <Tap onPress={() => set('theme', t.id)} style={{ height: 146, padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: sel ? t.acc : 'rgba(255,255,255,0.1)', backgroundColor: sel ? solid(t.acc, 0.08) : '#0D0E11', justifyContent: 'space-between', overflow: 'hidden', ...(sel ? comic(t.acc, 3) : null) }}>
              <View style={{ position: 'absolute', right: -14, bottom: -18 }}>
                <Icon name={t.icon} size={112} color={sel ? alpha(t.acc, 0.45) : 'rgba(255,255,255,0.14)'} tint={sel ? 0.16 : 0} strokeWidth={1.1} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.acc, shadowColor: t.acc, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }} />
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.acc2 }} />
                </View>
                <Picked on={sel} acc={t.acc} />
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
  const items: ['health' | 'nudge' | 'speak' | 'photo', IconKey, string, string][] = [
    ['health', 'heart', 'Apple Health', 'Steps, sleep, workouts and weight, read automatically. Coming soon.'],
    ['nudge', 'bell', 'Check-ins', 'I message you when you slip. Late session, low protein, bedtime.'],
    ['speak', 'voice', 'Voice', 'I speak replies out loud in voice mode.'],
    ['photo', 'camera', 'Camera meals', 'Snap a plate and I log the macros.'],
  ];
  return (
    <View style={{ gap: 8 }}>
      {items.map(([k, icon, label, sub], i) => (
        <Rise key={k} delay={220 + i * 80}><ToggleRow icon={icon} label={label} sub={sub} on={d[k]} onPress={() => set(k, !d[k])} acc={acc} /></Rise>
      ))}
    </View>
  );
}

function PactStep({ d, acc, onSeal }: { d: Intake; acc: string; onSeal: () => void }) {
  const partner = characterOf(d.character);
  return (
    <View style={{ gap: 16 }}>
      <Rise delay={250} style={{ paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14, borderRadius: 14, borderWidth: 1.5, borderColor: alpha(acc, 0.5), backgroundColor: '#0D0F13', overflow: 'hidden', ...comic(alpha(acc, 0.6), 5) }}>
        <View pointerEvents="none" style={{ position: 'absolute', right: -24, top: -20, opacity: 0.12 }}>
          <Icon name="scroll" size={150} color={acc} tint={0.3} strokeWidth={1} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stamp text="Pact No.0001" color={acc} tilt={-3} size={9} />
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Icon name={partner.icon} size={18} color={partner.acc} />
          <Txt size={12.5} color={C.sub}>{`Witnessed by ${partner.name}`}</Txt>
        </View>
      </Rise>
      <Rise delay={500}><HoldSeal acc={acc} onSeal={onSeal} /></Rise>
    </View>
  );
}

function Bond({ d, acc, acc2, bg, insetTop, insetBottom, onEnter }: { d: Intake; acc: string; acc2: string; bg: string; insetTop: number; insetBottom: number; onEnter: () => void }) {
  const c = fuel(d);
  const partner = characterOf(d.character);
  const [stamp] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(stamp, { toValue: 1, duration: 800, delay: 150, easing: Easing.bezier(0.2, 0.9, 0.3, 1), useNativeDriver: true }).start();
  }, [stamp]);
  const stats: [IconKey, string, string][] = [['kcal', 'DAILY', c.kcal.toLocaleString('en-US')], ['protein', 'PROTEIN', `${c.p} g`], ['vow', 'WEEKS', String(d.weeks)]];
  return (
    <View style={{ flex: 1, paddingTop: insetTop + 20, paddingHorizontal: 22, paddingBottom: insetBottom + 14 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <Animated.View
          style={{
            width: 132, height: 132, borderRadius: 24, borderWidth: 3, borderColor: acc, backgroundColor: solid(acc, 0.12, bg), alignItems: 'center', justifyContent: 'center',
            ...comic(acc2, 6),
            opacity: stamp.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1] }),
            transform: [
              { scale: stamp.interpolate({ inputRange: [0, 0.55, 0.75, 1], outputRange: [2.8, 0.9, 1.04, 1] }) },
              { rotate: stamp.interpolate({ inputRange: [0, 0.55, 1], outputRange: ['-24deg', '-8deg', '-8deg'] }) },
            ],
          }}
        >
          <Icon name={partner.icon} size={80} color={acc} tint={0.3} strokeWidth={1.4} />
        </Animated.View>
        <Rise delay={800} style={{ alignItems: 'center', gap: 10 }}>
          <View style={{ alignItems: 'center' }}>
            <Stamp text="Pact sealed" color={acc} tilt={-3} size={10} />
          </View>
          <Txt size={34} w={600} ls={-0.035}>Bond established.</Txt>
        </Rise>
        <Rise delay={1000} style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
          {stats.map(([icon, k, v]) => (
            <View key={k} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.line3, backgroundColor: '#0D0F13', alignItems: 'center', gap: 5 }}>
              <Icon name={icon} size={18} color={acc} />
              <Txt size={17} w={500}>{v}</Txt>
              <Txt face="mono" size={8.5} ls={0.12} color={C.muted}>{k}</Txt>
            </View>
          ))}
        </Rise>
      </View>
      <Rise delay={1250} style={{ gap: 16 }}>
        <View style={{ padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: alpha(acc, 0.45), backgroundColor: '#0D0F13', ...comic(alpha(acc, 0.5), 4) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Icon name="rei" size={16} color={acc} />
            <Txt face="mono" size={10.5} ls={0.18} color={acc}>REI</Txt>
          </View>
          <Txt size={16} w={500} lh={1.42}>{bondLine(d)}</Txt>
        </View>
        <Cta label="Enter REI" icon="today" acc={acc} onPress={onEnter} />
      </Rise>
    </View>
  );
}
