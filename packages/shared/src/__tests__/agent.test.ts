import { agentGreeting, checkLiveMeal, todayLine, agentPrompt, historyBlock, LIVE_TOOLS, liveTools, mealIndex, memoryKind, recentTurns } from '../agent';
import { vowChange } from '../rei';
import { reiContext } from '../context';
import { DEFAULT_DISCIPLINES, DEFAULT_PROFILE } from '../data';

const ctx = (tone: { tough: boolean; bro: boolean }) =>
  reiContext({ profile: DEFAULT_PROFILE, disc: DEFAULT_DISCIPLINES, meals: [], sessionDone: false, history: { kind: 'demo', scenario: 'Slipping week' }, activity: { steps: null, sleep: null, sleepL: '' }, nudge: true, now: new Date(2026, 9, 3, 18, 0), ...tone });

describe('live voice agent', () => {
  it('builds a voice prompt with actions and the user’s numbers, not text-chat control lines', () => {
    const p = agentPrompt(ctx({ tough: true, bro: true }));
    expect(p).toContain('swear back');
    expect(p).toContain('call log_meal');
    expect(p).toContain('[laughs]');
    expect(p).toContain(DEFAULT_PROFILE.kcal);
    expect(p).not.toContain('MEAL {');
  });

  it('greets in the chosen personality', () => {
    expect(agentGreeting({ bro: true, tough: true })).toMatch(/what’s good/);
    expect(agentGreeting({ bro: false, tough: false })).toMatch(/REI/);
  });

  it('defines every tool the app handles, with all parameters required', () => {
    expect(LIVE_TOOLS.map(t => t.name).sort()).toEqual(['forget', 'log_meal', 'log_workout', 'rebuild_program', 'remember', 'remove_meal', 'update_vow']);
    for (const t of LIVE_TOOLS) expect(t.parameters.required).toEqual(Object.keys(t.parameters.properties));
  });

  it('only accepts safe goal changes', () => {
    expect(vowChange('weight', '80.5')).toEqual(['weight', '80.5']);
    expect(vowChange('deadline', '2027-01-31')).toEqual(['deadline', '2027-01-31']);
    expect(vowChange('deadline', 'next march')).toBeNull();
    expect(vowChange('kcal', '-5')).toBeNull();
    expect(vowChange('password', 'x')).toBeNull();
    expect(vowChange('goal', '')).toBeNull();
  });

  it('falls back to "life" for unknown memory kinds', () => {
    expect(memoryKind('diet')).toBe('diet');
    expect(memoryKind('random')).toBe('life');
  });

  it('carries recent chat into a live call, skipping system notes and alerts', () => {
    const turns = recentTurns([
      { role: 'sys', text: 'Synced', time: '09:00' },
      { role: 'user', text: 'Doing legs tonight', time: '09:01' },
      { role: 'rei', text: 'Check-in: you slipped', time: '09:02', alert: true },
      { role: 'rei', text: 'Good. Squats first.', time: '09:03' },
    ]);
    expect(turns).toEqual([
      { role: 'user', content: 'Doing legs tonight' },
      { role: 'assistant', content: 'Good. Squats first.' },
    ]);
    expect(historyBlock(turns)).toContain('THEM: Doing legs tonight\nYOU: Good. Squats first.');
    expect(historyBlock([])).toBe('');
  });

  it('gives the agent plain function schemas', () => {
    expect(Object.keys(LIVE_TOOLS[0]).sort()).toEqual(['description', 'name', 'parameters']);
  });

  it('offers forget only to app builds that handle it', () => {
    const old = liveTools(undefined).map(t => t.name);
    expect(old).not.toContain('forget');
    expect(old).toHaveLength(6);
    expect(agentPrompt(ctx({ tough: false, bro: false }), old)).not.toContain('forget');
    const now = liveTools(LIVE_TOOLS.map(t => t.name)).map(t => t.name);
    expect(now).toEqual(LIVE_TOOLS.map(t => t.name));
    expect(agentPrompt(ctx({ tough: false, bro: false }), now)).toContain('call forget');
    expect(liveTools(['log_meal', 'made_up', 7]).map(t => t.name)).toEqual(['log_meal']);
  });

  it('finds the meal to remove by its spoken name, latest first', () => {
    const m = (name: string) => ({ time: '20:00', name, kcal: 500, p: 20, c: 60, f: 15 });
    const meals = [m('Chicken fried rice'), m('Chicken bread'), m('Chai')];
    expect(mealIndex(meals, 'the chicken bread')).toBe(1);
    expect(mealIndex(meals, 'Chicken Fried Rice')).toBe(0);
    expect(mealIndex(meals, 'chai')).toBe(2);
    expect(mealIndex(meals, 'pizza')).toBe(-1);
    expect(mealIndex(meals, '')).toBe(-1);
    expect(mealIndex([m('Chai'), m('Chai')], 'chai')).toBe(1);
  });
});


describe('meals logged on a call', () => {
  const { catalog } = jest.requireActual('../food') as typeof import('../food');
  const foods = catalog();
  it('uses the food list when everything they said is on it', () => {
    const r = checkLiveMeal({ name: 'Two eggs', kcal: 150, p: 5, c: 2, f: 3 }, 'I just had 2 eggs for breakfast', foods, '08:10');
    expect('meal' in r && r.meal.items?.length).toBe(1);
    if ('meal' in r) {
      expect(r.meal.p).toBeGreaterThanOrEqual(12);
      expect(r.meal.f).toBeGreaterThanOrEqual(8);
      expect(r.meal.name).toBe('Two eggs');
    }
  });
  it('catches the 2 eggs and a banana at 7 g protein, 0 g fat from a real call', () => {
    const r = checkLiveMeal({ name: 'Eggs and banana', kcal: 250, p: 7, c: 27, f: 0 }, 'I just had 2 eggs and a banana for breakfast', foods, '08:10');
    expect('redo' in r).toBe(true);
  });
  it('keeps an estimate that adds up', () => {
    const r = checkLiveMeal({ name: 'Mom’s special pulao', kcal: 520, p: 14, c: 80, f: 16 }, 'had my mom’s special pulao', foods, '13:00');
    expect(r).toEqual({ meal: { time: '13:00', name: 'Mom’s special pulao', kcal: 520, p: 14, c: 80, f: 16, src: 'ai' } });
  });
  it('asks for a redo when the macros don’t add up, then scales them', () => {
    const est = { name: 'Thing', kcal: 400, p: 7, c: 20, f: 0 };
    const r = checkLiveMeal(est, 'ate a thing', foods, '13:00');
    expect('redo' in r && r.redo).toMatch(/add up to 108 kcal, not 400/);
    const again = checkLiveMeal(est, 'ate a thing', foods, '13:00', true);
    expect('meal' in again && again.meal.kcal).toBe(400);
    if ('meal' in again) expect(again.meal.p * 4 + again.meal.c * 4 + again.meal.f * 9).toBeGreaterThan(380);
  });
  it('says what is left today', () => {
    const line = todayLine({ ...DEFAULT_PROFILE, kcal: '2000', protein: '150' }, [{ time: '09:00', name: 'x', kcal: 500, p: 30, c: 50, f: 15 }]);
    expect(line).toContain('1500 kcal and 120 g protein left');
  });
});
