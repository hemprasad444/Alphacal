import { nudgeDue, type CoachState } from '../coach';
import { DEFAULT_PROFILE, SESSIONS } from '../data';
import { week } from '../derive';

const base = (over: Partial<CoachState> = {}): CoachState => ({
  plan: SESSIONS.PUSH,
  sessionDone: false,
  nutrition: { kcal: 1500, protein: 120, carbs: 150, fat: 50, steps: null, sleep: null, sleepL: '—' },
  profile: DEFAULT_PROFILE,
  week: week({ kind: 'demo', scenario: 'Strong week' }, false, new Date(2026, 9, 2)),
  sent: [],
  ...over,
});
const t = (h: number, m = 0) => new Date(2026, 9, 2, h, m);

describe('nudgeDue', () => {
  it('stays quiet at night', () => {
    expect(nudgeDue(base({ nutrition: { ...base().nutrition, kcal: 9000 } }), t(23, 45))).toBeNull();
    expect(nudgeDue(base({ nutrition: { ...base().nutrition, kcal: 9000 } }), t(6, 30))).toBeNull();
  });

  it('calls out a late session 30 minutes after it was due', () => {
    expect(nudgeDue(base(), t(18, 59))).toBeNull();
    expect(nudgeDue(base(), t(19, 0))?.id).toBe('session-late');
    expect(nudgeDue(base({ sessionDone: true }), t(19, 0))).toBeNull();
    expect(nudgeDue(base({ plan: null }), t(19, 0))).toBeNull();
  });

  it('flags going over calories', () => {
    const n = nudgeDue(base({ nutrition: { ...base().nutrition, kcal: 2450 } }), t(14));
    expect(n).toMatchObject({ id: 'over-kcal', fallback: 'Over by 150 kcal. Kitchen’s closed. Water, a walk, bed.' });
  });

  it('flags low protein from 20:00', () => {
    const low = base({ sessionDone: true, nutrition: { ...base().nutrition, protein: 80 } });
    expect(nudgeDue(low, t(19, 30))).toBeNull();
    expect(nudgeDue(low, t(20, 0))?.id).toBe('protein-low');
  });

  it('calls out a slipping week in the morning', () => {
    const slipping = base({ week: week({ kind: 'demo', scenario: 'Slipping week' }, false, new Date(2026, 9, 2)) });
    expect(nudgeDue(slipping, t(8, 15))?.id).toBe('streak');
    expect(nudgeDue(slipping, t(13))).toBeNull();
  });

  it('sends each nudge once a day, in priority order', () => {
    const s = base({ nutrition: { ...base().nutrition, kcal: 2450 } });
    expect(nudgeDue(s, t(19, 30))?.id).toBe('session-late');
    expect(nudgeDue({ ...s, sent: ['session-late'] }, t(19, 30))?.id).toBe('over-kcal');
    expect(nudgeDue({ ...s, sent: ['session-late', 'over-kcal'] }, t(19, 30))).toBeNull();
  });

  it('says goodnight at 23:00', () => {
    expect(nudgeDue(base({ sessionDone: true }), t(23, 5))?.id).toBe('bedtime');
  });
});
