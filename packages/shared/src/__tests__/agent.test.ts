import { AGENT_TOOLS, agentGreeting, agentPrompt, historyBlock, LIVEKIT_TOOLS, mealIndex, memoryKind, recentTurns, vowChange } from '../agent';
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
    expect(AGENT_TOOLS.map(t => t.name).sort()).toEqual(['log_meal', 'log_workout', 'rebuild_program', 'remember', 'remove_meal', 'update_vow']);
    for (const t of AGENT_TOOLS) expect(t.parameters.required).toEqual(Object.keys(t.parameters.properties));
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

  it('gives the LiveKit agent the same tools as the ElevenLabs agent', () => {
    expect(LIVEKIT_TOOLS.map(t => t.name)).toEqual(AGENT_TOOLS.map(t => t.name));
    expect(LIVEKIT_TOOLS[0]).not.toHaveProperty('type');
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
