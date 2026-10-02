import { route } from '../route';
import { zonedNow } from '../time';

describe('route', () => {
  it('sends quick chat to the fast tier', () => {
    for (const t of ["I'm too tired today", 'Just ate: 2 eggs', "What's left today?", 'ok fine'])
      expect(route(t)).toBe('fast');
  });
  it('sends planning and analysis to the deep tier', () => {
    for (const t of ['Can you rebuild my plan for next week?', 'Why am I not losing weight?', 'Review my progress', 'My bench has stalled'])
      expect(route(t)).toBe('deep');
  });
});

describe('zonedNow', () => {
  it('reads the wall clock in another zone', () => {
    const utc = new Date(Date.UTC(2026, 9, 2, 12, 22));
    const ist = zonedNow('Asia/Kolkata', utc);
    expect([ist.getHours(), ist.getMinutes()]).toEqual([17, 52]);
  });
  it('falls back to the given time for an unknown zone', () => {
    const t = new Date();
    expect(zonedNow('Not/AZone', t)).toBe(t);
  });
});
