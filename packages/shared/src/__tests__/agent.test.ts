import { AGENT_TOOLS, agentGreeting, agentPrompt, memoryKind, vowChange } from '../agent';
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
    expect(AGENT_TOOLS.map(t => t.name).sort()).toEqual(['log_meal', 'rebuild_program', 'remember', 'update_vow']);
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
});
