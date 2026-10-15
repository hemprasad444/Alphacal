import { ARCHETYPES, DEFAULT_INTAKE, fuel, GOALS, intakeDisciplines, intakeMemory, intakeProfile, pactRows, reiLine, sleepHours, STEPS, CHAPTERS, suggestedTarget, TONES, trainTime, vowSentence, weeklyRate, type Intake } from '../onboarding';
import { CHARACTERS, characterOf, forSpeech, greeting, hasVoice, isSpeakVoice, speakVoice, spokenName } from '../characters';
import { DEFAULT_PROFILE } from '../data';
import { DEFAULT_VOICE } from '../voices';

/** Japanese or Chinese characters: the app shows icons now, not kanji. */
const CJK = /[\u3040-\u30ff\u4e00-\u9fff]/;

const now = new Date(2026, 9, 3, 12, 0);
const d = (over: Partial<Intake> = {}): Intake => ({ ...DEFAULT_INTAKE, name: 'Hem', ...over });

describe('onboarding', () => {
  it('has sixteen chapters between the cover and the bond; the account comes before, not inside', () => {
    expect(CHAPTERS).toBe(16);
    expect(STEPS[0].id).toBe('boot');
    expect(STEPS.map(s => s.id).slice(-2)).toEqual(['pact', 'done']);
    expect(STEPS.map(s => s.id)).not.toContain('account');
    expect(new Set(STEPS.map(s => s.id)).size).toBe(STEPS.length);
  });

  it('gives every chapter an icon, a title, a line from REI and (but the pact) a button', () => {
    for (const st of STEPS.filter(x => x.t)) {
      expect(st.icon).toBeTruthy();
      expect(reiLine(st.id, d()).length).toBeGreaterThan(10);
      if (st.id !== 'pact') expect(st.cta).toBeTruthy();
    }
    expect(reiLine('boot', d())).toBe('');
  });

  it('shows no kanji anywhere in the chapters', () => {
    const text = [
      ...STEPS.map(x => `${x.t ?? ''} ${x.cta ?? ''}`), ...ARCHETYPES.map(a => `${a.name} ${a.ref} ${a.spec} ${a.quip}`),
      ...GOALS.map(g => `${g.tag} ${g.label} ${g.sub}`), ...TONES.map(t => `${t.id} ${t.sub}`),
      ...STEPS.map(x => reiLine(x.id, d({ arch: 'shinobi', character: 'naruto' }))), ...pactRows(d()).flat(),
    ].join('\n');
    expect(text).not.toMatch(CJK);
    expect([...ARCHETYPES, ...GOALS, ...TONES].every(x => typeof x.icon === 'string' && !CJK.test(x.icon))).toBe(true);
  });

  it('greets with the chosen partner on the partner chapter', () => {
    expect(reiLine('partner', d())).toMatch(/corner/);
    expect(reiLine('partner', d({ character: 'naruto' }))).toMatch(/^Naruto\./);
    expect(pactRows(d({ character: 'gojo' })).find(([k]) => k === 'VOICE')?.[1]).toMatch(/Gojo$/);
  });

  it('runs the fuel numbers from Mifflin–St Jeor, activity and the goal', () => {
    const c = fuel(d());
    // 10×81.6 + 6.25×178 − 5×26 + 5 = 1803.5; desk 1.2 + 5 × 0.05 = 1.45; cut −18%.
    expect(c.bmr).toBe(1804);
    expect(c.kcal).toBe(Math.round((1803.5 * 1.45 * 0.82) / 50) * 50);
    expect(c.p).toBe(180);
    expect(c.f).toBe(65);
    expect(c.c).toBeGreaterThanOrEqual(60);
    expect(fuel(d({ kcalAdj: 100 })).kcal).toBe(c.kcal + 100);
  });

  it('works a target back from the chosen physique', () => {
    expect(suggestedTarget(d({ arch: 'shinobi' }))).toEqual({ targetBf: 11, targetWeight: 74.5 });
    expect(suggestedTarget(d({ arch: 'none' }))).toBeNull();
  });

  it('turns the answers into the profile REI coaches against', () => {
    const p = intakeProfile(d({ why: 'Tired of starting over.', time: 'Morning', bed: 1380, wake: 390 }), now);
    expect(Object.keys(p).sort()).toEqual(Object.keys(DEFAULT_PROFILE).sort());
    expect(p).toMatchObject({ name: 'Hem', weight: '81.6', targetWeight: '74', sessions: '5', sessionTime: '06:30', bedtime: '23:00', sleep: '7.5', deadline: '2027-03-06' });
    expect(p.goal).toBe('Get lean to 74 kg at 12% body fat by 6 MAR 2027. Why: Tired of starting over.');
    expect(p.kcal).toBe(String(fuel(d()).kcal));
  });

  it('remembers diet, injuries, equipment, schedule, bests and weak points', () => {
    const m = intakeMemory(d({ injuries: { Knee: true }, quit: { Weekends: true }, note: 'Night shifts on Thursdays' }));
    const text = m.map(x => `${x.kind}: ${x.text}`).join('\n');
    expect(text).toContain('diet: Non-veg; 4 meals a day');
    expect(text).toContain('health: Knee injury');
    expect(text).toContain('equipment: Trains with: Full gym, Pull-up bar');
    expect(text).toContain('schedule: Trains evening (18:30)');
    expect(text).toContain('bench 80 kg');
    expect(text).toContain('life: Night shifts on Thursdays');
    expect(m.every(x => x.text.length <= 160)).toBe(true);
  });

  it('works out sleep, training time, vow and the target verdict', () => {
    expect(sleepHours(d({ bed: 30, wake: 480 }))).toBe(7.5);
    expect(trainTime(d({ time: 'Night' }))).toBe('21:00');
    expect(vowSentence(d({ goal: 'size', targetWeight: 85 }), now)).toBe('build to 85 kg of quality size by 6 MAR 2027.');
    expect(reiLine('target', d({ weight: 90, targetWeight: 70, weeks: 12 }))).toMatch(/Aggressive/);
    expect(intakeDisciplines(d({ disc: { Running: true } }))).toEqual({ Hypertrophy: false, Strength: false, Calisthenics: false, Running: true });
  });

  it('keeps the fuel sane at the edges', () => {
    // A light, short, older person on a hard cut still gets at least 60 g of carbs.
    const small = fuel(d({ weight: 40, height: 140, age: 80, sex: 'Female', sessions: 2, length: 30 }));
    expect(small.c).toBeGreaterThanOrEqual(60);
    expect(small.kcal).toBeGreaterThan(0);
    // Everything stays a whole number of grams.
    const big = fuel(d({ weight: 160, height: 215, goal: 'size', job: 'Physical', sessions: 7, length: 90 }));
    expect([big.p, big.c, big.f, big.kcal].every(Number.isInteger)).toBe(true);
    expect(big.kcal).toBeGreaterThan(fuel(d()).kcal);
  });

  it('handles an unknown or unset archetype and a zero-change target', () => {
    expect(suggestedTarget(d({ arch: null }))).toBeNull();
    expect(suggestedTarget(d({ arch: 'nobody' }))).toBeNull();
    expect(weeklyRate(d({ weight: 80, targetWeight: 80 }))).toBe(0);
    expect(reiLine('target', d({ weight: 80, targetWeight: 80 }))).toMatch(/Holding weight/);
    expect(reiLine('ideal', d({ arch: null }))).toMatch(/Pick yours/);
  });

  it('uses Operator when the name is only spaces', () => {
    expect(intakeProfile(d({ name: '   ' }), now).name).toBe('');
    expect(reiLine('fuel', d({ name: '  ' }))).toMatch(/Operator/);
  });
});

describe('characters', () => {
  it('each has a voice, a hello with the name in it, a world and a unique id', () => {
    expect(new Set(CHARACTERS.map(c => c.id)).size).toBe(CHARACTERS.length);
    expect(CHARACTERS.map(c => c.id)).toEqual(expect.arrayContaining(['rei', 'naruto', 'rem', 'tanjiro', 'gojo', 'luffy', 'allmight', 'asta', 'toji']));
    for (const c of CHARACTERS) {
      expect(hasVoice(c)).toBe(true);
      expect(c.fish).toMatch(/^[0-9a-f]{32}$/);
      expect(c.intro).toContain('{name}');
      // A voice swallows the first word of a clip, so the name never comes first.
      expect(c.intro.startsWith('{name}')).toBe(false);
      expect(['zero', 'shinobi', 'voyager', 'hero', 'cursed', 'slayer']).toContain(c.theme);
    }
    expect(new Set(CHARACTERS.map(c => c.fish)).size).toBe(CHARACTERS.length);
  });

  it('greets by name, cleaned up for speaking', () => {
    const allMight = characterOf('allmight');
    expect(greeting(allMight, 'Hem')).toBe('Hey, Hem! Fear not, for I am here! From today, you and I go beyond. Plus Ultra!');
    expect(greeting(allMight, '  hem ')).toMatch(/^Hey, Hem!/);
    expect(greeting(allMight, '')).toMatch(/^Hey, friend!/);
    expect(greeting(allMight, null)).toMatch(/^Hey, friend!/);
    expect(greeting(characterOf('toji'), 'Hem')).toMatch(/^So you’re Hem\. Toji/);
    expect(spokenName('  ravi   kumar 🔥 ')).toBe('Ravi kumar');
    expect(spokenName("d'souza-ann")).toBe("D'souza-ann");
    expect(spokenName('ಹೇಮ್')).toBe('ಹೇಮ್');
    expect(spokenName('123 <b>')).toBe('B');
    expect(spokenName('x'.repeat(40))).toHaveLength(24);
  });

  it('says REI as a name, not letters', () => {
    expect(forSpeech('I’m REI. REI’s got you. REIGN stays.')).toBe('I’m Rei. Rei’s got you. REIGN stays.');
  });

  it('falls back to REI for unknown ids', () => {
    expect(characterOf('nobody').id).toBe('rei');
    expect(characterOf(undefined).id).toBe('rei');
  });

  it('speaks through the character’s own voice and lets only known voiced characters through', () => {
    expect(speakVoice({ character: 'naruto', voice: DEFAULT_VOICE })).toBe('c:naruto');
    expect(speakVoice({ character: 'toji', voice: DEFAULT_VOICE })).toBe('c:toji');
    expect(speakVoice({ character: undefined, voice: DEFAULT_VOICE })).toBe('c:rei');
    expect(isSpeakVoice('c:asta')).toBe(true);
    expect(isSpeakVoice('c:')).toBe(false);
    expect(isSpeakVoice('c:nobody')).toBe(false);
    expect(isSpeakVoice(DEFAULT_VOICE)).toBe(true);
    expect(isSpeakVoice('someone-else')).toBe(false);
    expect(isSpeakVoice(42)).toBe(false);
  });
});
