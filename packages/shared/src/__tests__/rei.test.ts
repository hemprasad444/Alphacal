import { addMemory, forgetMemory, MAX_MEMORY, memoryLines, readMemory } from '../memory';
import { DEFAULT_PROFILE } from '../data';
import { applyUpdate, fuelLine, offlineReply, parseReply, splitLead, takeSentences, toMeal, toTurns } from '../rei';
import type { Nutrition } from '../types';

const nu = (over: Partial<Nutrition> = {}): Nutrition => ({ steps: 4212, sleep: 6 + 5 / 60, sleepL: '6h 05m', kcal: 1840, protein: 92, carbs: 200, fat: 72, ...over });

describe('parseReply', () => {
  it('pulls out a MEAL line and cleans the text', () => {
    const r = parseReply('**Solid** choice — that fits.\nMEAL {"name":"chicken bowl","kcal":610,"p":52,"c":60,"f":14}');
    expect(r.text).toBe('Solid choice. That fits.');
    expect(r.meal).toEqual({ name: 'chicken bowl', kcal: 610, p: 52, c: 60, f: 14 });
    expect(r.upd).toBeNull();
  });

  it('pulls out an UPDATE line', () => {
    const r = parseReply('Fine. New date set.\nUPDATE: {"deadline":"2027-04-01","targetWeight":75}');
    expect(r.text).toBe('Fine. New date set.');
    expect(r.upd).toEqual({ deadline: '2027-04-01', targetWeight: 75 });
  });

  it('drops a malformed control line without throwing', () => {
    const r = parseReply('Logged.\nMEAL {"kcal": oops}');
    expect(r.text).toBe('Logged.');
    expect(r.meal).toBeNull();
  });

  it('strips a speaker prefix and bullet markers', () => {
    expect(parseReply('REI: - go lift.').text).toBe('go lift.');
  });
});

describe('toTurns', () => {
  it('merges consecutive roles, skips system notes and starts with a user turn', () => {
    const turns = toTurns([
      { role: 'rei', text: 'Morning.', time: '07:00' },
      { role: 'rei', text: 'Push at 18:30.', time: '07:01' },
      { role: 'sys', text: 'MEAL LOGGED', time: '08:00' },
      { role: 'user', text: 'Ok', time: '08:01' },
    ]);
    expect(turns).toEqual([
      { role: 'user', content: '(opened the app)' },
      { role: 'assistant', content: 'Morning.\nPush at 18:30.' },
      { role: 'user', content: 'Ok' },
    ]);
  });
});

describe('applyUpdate', () => {
  it('applies only allowed keys and reports them', () => {
    const r = applyUpdate(DEFAULT_PROFILE, { protein: 180, height: 190 } as never);
    expect(r?.profile.protein).toBe('180');
    expect(r?.profile.height).toBe(DEFAULT_PROFILE.height);
    expect(r?.note).toBe('VOW UPDATED · PROTEIN');
  });

  it('returns null when nothing allowed changed', () => {
    expect(applyUpdate(DEFAULT_PROFILE, { height: 190 } as never)).toBeNull();
    expect(applyUpdate(DEFAULT_PROFILE, null)).toBeNull();
  });
});

describe('meals', () => {
  it('estimates offline and capitalises the name', () => {
    expect(toMeal(null, 'burger & fries', '19:00')).toEqual({ time: '19:00', name: 'Burger & fries', kcal: 1050, p: 40, c: 100, f: 52 });
  });

  it('prefers the model estimate when it has calories', () => {
    expect(toMeal({ name: 'salmon', kcal: 420.4, p: 40, c: 0, f: 28 }, 'x', '13:00').kcal).toBe(420);
  });
});

describe('fuelLine', () => {
  it('calls out going over budget', () => {
    expect(fuelLine(DEFAULT_PROFILE, nu({ kcal: 2500 }))).toMatch(/^Over by 200 kcal/);
  });

  it('pushes lean protein when protein is far behind calories', () => {
    expect(fuelLine(DEFAULT_PROFILE, nu())).toMatch(/^460 kcal and 78 g protein left\. Only lean protein/);
  });
});

describe('offlineReply', () => {
  it('uses the real sleep and today line', () => {
    const x = { profile: DEFAULT_PROFILE, nutrition: nu(), tough: true, todayLine: 'Pull session at 18:30' };
    expect(offlineReply("I'm too tired", x)).toContain('You slept 6 hours');
    expect(offlineReply("What's left today?", x)).toBe('Pull session at 18:30. 78 g protein. 5,788 steps. Bed by 23:30. Four things. None of them optional.');
  });
});

describe('splitLead', () => {
  it('splits off the first sentence', () => {
    expect(splitLead("You're 22g short. Eat chicken. Go lift.")).toEqual({ lead: "You're 22g short.", rest: 'Eat chicken. Go lift.' });
    expect(splitLead('Go.')).toEqual({ lead: 'Go.', rest: '' });
  });
});

describe('takeSentences', () => {
  it('releases finished sentences and keeps the rest', () => {
    expect(takeSentences('Good. Now lift')).toEqual({ sentences: ['Good.'], rest: 'Now lift' });
    expect(takeSentences('Tired is information. Shoes on. ')).toEqual({ sentences: ['Tired is information.', 'Shoes on.'], rest: '' });
  });
  it('waits when the text may still be mid-sentence', () => {
    expect(takeSentences('Shoes on.')).toEqual({ sentences: [], rest: 'Shoes on.' });
    expect(takeSentences('Bench 82.5 kg')).toEqual({ sentences: [], rest: 'Bench 82.5 kg' });
  });
});

describe('memory', () => {
  let n = 0;
  const id = () => `m${++n}`;
  it('adds new facts, skips repeats, and makes room by dropping REI’s oldest notes', () => {
    const a = addMemory([], [{ text: ' Vegetarian, eats eggs ', kind: 'diet' }, { text: 'vegetarian eats eggs', kind: 'diet' }], 'rei', 1, id);
    expect(a.list).toEqual([{ id: 'm1', text: 'Vegetarian, eats eggs', kind: 'diet', createdAt: 1, source: 'rei' }]);
    expect(a.added).toHaveLength(1);
    const full = addMemory([], Array.from({ length: MAX_MEMORY }, (_, i) => ({ text: `fact ${i}`, kind: 'life' as const })), 'rei', 2, id).list;
    const mine = addMemory(full, [{ text: 'Left knee: no deep squats', kind: 'health' }], 'you', 3, id);
    expect(mine.list).toHaveLength(MAX_MEMORY);
    expect(mine.list[0].text).toBe('fact 1');
    expect(mine.added[0]).toMatchObject({ text: 'Left knee: no deep squats', source: 'you' });
  });

  it('forgets by id and lists facts for the prompt', () => {
    const list = [{ id: 'a', text: 'Trains at 6 am', kind: 'schedule' as const, createdAt: 1, source: 'rei' as const }, { id: 'b', text: 'Hates running', kind: 'preference' as const, createdAt: 2, source: 'you' as const }];
    expect(forgetMemory(list, ['a']).list.map(m => m.id)).toEqual(['b']);
    expect(memoryLines(list)).toBe('[a] (schedule) Trains at 6 am\n[b] (preference) Hates running');
    expect(readMemory([...list, { nope: 1 }, null, { id: 'c', text: 'x', kind: 'weird', source: 'admin' }])).toEqual([...list, { id: 'c', text: 'x', kind: 'life', source: 'rei', createdAt: 0 }]);
  });
});
