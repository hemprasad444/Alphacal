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
    expect(offlineReply("What's left today?", x)).toBe('Pull session at 18:30. 78 g protein. 5,788 steps. Bed by 23:00. Four things. None of them optional.');
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

describe('dropRepeats', () => {
  const { dropRepeats } = jest.requireActual('../rei') as typeof import('../rei');
  it('says a repeated line once', () => {
    expect(dropRepeats('How’d legs go, Hem? Give me the damage.\nHow’d legs go, Hem? Give me the damage.')).toBe('How’d legs go, Hem? Give me the damage.');
    expect(dropRepeats('Nice.\n\nNice!\nNow eat.')).toBe('Nice.\n\nNow eat.');
  });
  it('keeps the first of two drafts that open the same way', () => {
    expect(dropRepeats('85 for 5, hell yeah Hem. That’s strong work. How’d the rest of push day go?\n85 for 5, hell yeah Hem. Strong work. How long was the session?')).toBe('85 for 5, hell yeah Hem. That’s strong work. How’d the rest of push day go?');
    expect(dropRepeats('Eat now.\nEat now and sleep.')).toBe('Eat now.\nEat now and sleep.');
  });
  it('says a repeated run of sentences on one line once', () => {
    expect(dropRepeats('How was Dune 3 with the boys? Was it worth the hype? How was Dune 3 with the boys? Was it worth the hype?')).toBe('How was Dune 3 with the boys? Was it worth the hype?');
    expect(dropRepeats('Nice. Nice. Now eat.')).toBe('Nice. Now eat.');
    expect(dropRepeats('Eat. Train. Sleep.')).toBe('Eat. Train. Sleep.');
  });
  it('keeps different lines and repeats that are not next to each other', () => {
    expect(dropRepeats('Eat.\nTrain.\nEat.')).toBe('Eat.\nTrain.\nEat.');
  });
});

describe('dropRepeats, drafts that open differently', () => {
  const { dropRepeats } = jest.requireActual('../rei') as typeof import('../rei');
  it('keeps the first draft', () => {
    expect(dropRepeats('Nice, dal and rice fits, that leaves you 450 kcal and 40 g protein for dinner. Dal and rice, solid pick, puts you at 450 kcal left with 40 g protein to go for dinner.')).toBe(
      'Nice, dal and rice fits, that leaves you 450 kcal and 40 g protein for dinner.',
    );
    expect(dropRepeats('How was Dune 3 with the boys? Bet the sound in IMAX was insane.\nYo, how was Dune 3? Bet IMAX sound with the boys was insane.')).toBe('How was Dune 3 with the boys? Bet the sound in IMAX was insane.');
  });
  it('keeps replies that build on what came before', () => {
    const keep = [
      'How was Dune 3? And did you eat anything before or during the show?\nAlso, it’s nearly 11 and your log’s still empty. Did you eat anything at all today?',
      '85 for 5 is strong, that’s moving. Legs were supposed to be today though, so did you swap them for tomorrow? And you still haven’t eaten a thing today, that bench happened on fumes.',
      'Rajma chawal plus curd puts you near 1530 of 2150 kcal and about 56 g protein, still 59 short. Nothing left tonight but protein: paneer, curd or a shake.',
    ];
    for (const t of keep) expect(dropRepeats(t)).toBe(t);
  });
});

describe('swearOnlyBack', () => {
  const { swearOnlyBack, SWEARING } = jest.requireActual('../rei') as typeof import('../rei');
  it('says it milder until they swear', () => {
    expect(swearOnlyBack('Yo, I’m REI. Zero excuses, zero bullshit.', false)).toBe('Yo, I’m REI. Zero excuses, zero BS.');
    expect(swearOnlyBack('And you just ate a fuckload of cheese, so don’t skip pull.', false)).toBe('And you just ate a ton of cheese, so don’t skip pull.');
    expect(swearOnlyBack('Fucking brilliant. Holy shit.', false)).toBe('Freaking brilliant. Holy crap.');
    expect(SWEARING.test(swearOnlyBack('what the fuck, shitty day, fuck it', false))).toBe(false);
  });
  it('swears back once they have', () => {
    expect(swearOnlyBack('Fuck you too, now go lift.', true)).toBe('Fuck you too, now go lift.');
    expect(SWEARING.test('this diet is bullshit')).toBe(true);
    expect(SWEARING.test('shiitake and shitake mushrooms')).toBe(false);
    expect(SWEARING.test('assess the class, a big glass')).toBe(false);
  });
});
