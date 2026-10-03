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
