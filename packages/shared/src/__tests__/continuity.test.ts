import { continuityNote, fallbackOpener, thread } from '../continuity';
import type { Message } from '../types';

const NOW = new Date(2026, 9, 4, 19, 0).getTime();
const m = (role: Message['role'], text: string, minutesAgo: number): Message => ({ role, text, time: '', createdAt: NOW - minutesAgo * 60000 });

describe('continuity', () => {
  it('knows a first conversation', () => {
    const t = thread([], NOW);
    expect(t.gap).toBe('first');
    expect(continuityNote(t)).toMatch(/first conversation/);
  });

  it('treats the last few hours as the same conversation and forbids a fresh greeting', () => {
    const t = thread([m('user', 'Doing legs tonight. Squats first.', 12), m('rei', 'Good. Eat after.', 11)], NOW);
    expect(t.gap).toBe('now');
    expect(t.minutes).toBe(11);
    expect(t.lastThem).toBe('Doing legs tonight. Squats first.');
    const note = continuityNote(t);
    expect(note).toMatch(/Do not greet/);
    expect(note).toMatch(/Doing legs tonight/);
    expect(fallbackOpener(t, { name: 'Hem', bro: true, tough: true, seed: 0 })).toMatch(/doing legs tonight/i);
  });

  it('separates earlier today, yesterday and days away', () => {
    expect(thread([m('user', 'Morning run done', 6 * 60)], NOW).gap).toBe('today');
    expect(thread([m('user', 'Off to bed', 22 * 60)], NOW).gap).toBe('yesterday');
    const t = thread([m('user', 'See you', 4 * 1440)], NOW);
    expect(t.gap).toBe('days');
    expect(continuityNote(t)).toMatch(/4 days ago/);
  });

  it('ignores system notes and untimed messages', () => {
    const t = thread([m('sys', 'MEAL LOGGED', 1), { role: 'user', text: 'no time', time: '' }, m('user', 'real one', 30)], NOW);
    expect(t.minutes).toBe(30);
    expect(t.lastThem).toBe('real one');
  });

  it('never opens a same-day call with how are you', () => {
    for (let seed = 0; seed < 6; seed++) {
      for (const gap of [15, 300]) {
        const line = fallbackOpener(thread([m('user', 'Had dosa for lunch', gap)], NOW), { name: '', bro: seed % 2 === 0, tough: true, seed });
        expect(line).not.toMatch(/how are you|what[’']?s up/i);
      }
    }
  });
});

describe('voice tags', () => {
  it('tidies loose tags for speech and strips them for reading', () => {
    const { stripTags, tidyTags } = jest.requireActual('../voices') as typeof import('../voices');
    expect(tidyTags('[ warm? ] Hey. [firm] Go.')).toBe('[warm] Hey. [firm] Go.');
    expect(tidyTags('[  ] Hi [ ? ] there')).toBe('Hi there');
    expect(stripTags('[ warm? ] Hey, [laughs] fine.')).toBe('Hey, fine.');
  });
});

describe('open plans', () => {
  const { openPlan, thread: th, continuityNote: note, fallbackOpener: fb } = jest.requireActual('../continuity') as typeof import('../continuity');
  const T = new Date(2026, 8, 21, 22, 45).getTime();
  const m = (role: 'user' | 'rei', text: string, minAgo: number) => ({ role, text, time: '', createdAt: T - minAgo * 60000 });

  it('finds the plan they left for, even when "ok bye" came after it', () => {
    const p = openPlan([m('user', 'going to watch Dune 3 with the boys at 7', 275), m('rei', 'Enjoy it.', 274), m('user', 'ok bye', 273)], T);
    expect(p?.topic).toBe('movie');
    expect(p?.minutes).toBe(275);
  });

  it('reaches back past "gotta go prep" to the driving test', () => {
    const p = openPlan([m('user', 'Got my driving test at 2 pm, wish me luck', 585), m('rei', 'You got this.', 584), m('user', 'gotta go prep', 583)], T);
    expect(p?.topic).toBe('test');
    expect(p?.text).toMatch(/driving test/);
  });

  it('closes the plan once they talk about it', () => {
    expect(openPlan([m('user', 'going to watch Dune 3 tonight', 300), m('user', 'dune was insane bro', 10)], T)).toBeUndefined();
  });

  it('ignores ordinary messages and plans older than 36 hours', () => {
    expect(openPlan([m('user', 'I ate 2 eggs', 60), m('user', 'protein is hard', 30)], T)).toBeUndefined();
    expect(openPlan([m('user', 'going to a wedding tonight', 40 * 60)], T)).toBeUndefined();
  });

  it('puts the plan first in REI’s note and the scripted opener', () => {
    const t = th([m('user', 'Off to my cousin’s wedding tonight, gonna be a long one', 14 * 60)], T, 'Asia/Kolkata');
    expect(note(t)).toMatch(/OPEN PLAN: .*wedding.*asks how it went.*before anything about food/s);
    expect(fb(t, { name: 'Hem', bro: true, tough: true, seed: 0 })).toMatch(/How was the wedding/);
  });

  it('does not ask about a plan made a few minutes ago', () => {
    const t = th([m('user', 'heading to the gym now, legs day', 10)], T);
    expect(note(t)).not.toMatch(/OPEN PLAN/);
  });

  it('works out today and yesterday in the user’s time zone, not the server’s', () => {
    // 01:30 India on the 22nd is still the 21st in UTC.
    const now = Date.UTC(2026, 8, 21, 20, 0);
    const late = { role: 'user' as const, text: 'night', time: '', createdAt: Date.UTC(2026, 8, 21, 14, 0) };
    expect(th([late], now, 'Asia/Kolkata').gap).toBe('yesterday');
  });
});

describe('open plans: asked once', () => {
  const { openPlan } = jest.requireActual('../continuity') as typeof import('../continuity');
  const T = new Date(2026, 9, 5, 20, 30).getTime();
  const m = (role: 'user' | 'rei', text: string, minAgo: number) => ({ role, text, time: '', createdAt: T - minAgo * 60000 });
  it('stops asking after REI has asked how it went', () => {
    const msgs = [m('user', 'going to a movie with my friends, Dune 3 at 7. talk later', 26 * 60 + 20), m('rei', 'Enjoy Dune.', 26 * 60 + 19), m('user', 'yo im back', 21 * 60 + 45), m('rei', 'How was the movie?', 21 * 60 + 44)];
    expect(openPlan(msgs, T)).toBeUndefined();
  });
  it('still asks when REI only said enjoy it before they left', () => {
    const msgs = [m('user', 'going to a movie with my friends at 7', 270), m('rei', 'Enjoy the movie.', 269)];
    expect(openPlan(msgs, T)?.topic).toBe('movie');
  });
});
