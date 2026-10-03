import { DEFAULT_INTAKE, fuel, intakeDisciplines, intakeMemory, intakeProfile, reiLine, sleepHours, STEPS, CHAPTERS, suggestedTarget, trainTime, vowSentence, type Intake } from '../onboarding';
import { DEFAULT_PROFILE } from '../data';

const now = new Date(2026, 9, 3, 12, 0);
const d = (over: Partial<Intake> = {}): Intake => ({ ...DEFAULT_INTAKE, name: 'Hem', ...over });

describe('onboarding', () => {
  it('has fifteen chapters, then the account and the bond', () => {
    expect(CHAPTERS).toBe(15);
    expect(STEPS.map(s => s.id).slice(-3)).toEqual(['pact', 'account', 'done']);
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
});
