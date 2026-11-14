// Day writes from the phone must merge with the server's (meals by arrayUnion, minutes by increment),
// never overwrite the whole list or total.
import type { Meal } from '@rei/shared';

const calls: { op: string; path: string; data: unknown; opts?: unknown }[] = [];

jest.mock('../firebase', () => ({ fb: () => ({ db: {} }) }));
jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  doc: (parent: { path: string }, id: string) => ({ path: `${parent.path}/${id}` }),
  setDoc: async (ref: { path: string }, data: unknown, opts?: unknown) => {
    calls.push({ op: 'set', path: ref.path, data, opts });
  },
  writeBatch: () => {
    const ops: typeof calls = [];
    return {
      set: (ref: { path: string }, data: unknown, opts?: unknown) => ops.push({ op: 'batch.set', path: ref.path, data, opts }),
      commit: async () => {
        calls.push(...ops, { op: 'commit', path: '', data: null });
      },
    };
  },
  arrayUnion: (...e: unknown[]) => ({ arrayUnion: e }),
  arrayRemove: (...e: unknown[]) => ({ arrayRemove: e }),
  increment: (n: number) => ({ increment: n }),
  deleteDoc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  documentId: jest.fn(),
}));

// eslint-disable-next-line import/first
import { write } from '../sync';

const m = (id: string, kcal = 400): Meal => ({ id, time: '13:00', name: 'Dal rice', kcal, p: 15, c: 60, f: 10 });
const day = 'users/u/days/2026-11-15';

beforeEach(() => {
  calls.length = 0;
});

describe('day writes', () => {
  it('adds a meal without rewriting the list', async () => {
    await write.addMeal('u', '2026-11-15', m('a'));
    expect(calls).toEqual([{ op: 'set', path: day, data: { meals: { arrayUnion: [m('a')] } }, opts: { merge: true } }]);
  });

  it('removes only that meal', async () => {
    await write.removeMeal('u', '2026-11-15', m('a'));
    expect(calls).toEqual([{ op: 'set', path: day, data: { meals: { arrayRemove: [m('a')] } }, opts: { merge: true } }]);
  });

  it('edits a meal as one change: the old one out, the new one in', async () => {
    await write.replaceMeal('u', '2026-11-15', m('a'), m('a', 300));
    expect(calls).toEqual([
      { op: 'batch.set', path: day, data: { meals: { arrayRemove: [m('a')] } }, opts: { merge: true } },
      { op: 'batch.set', path: day, data: { meals: { arrayUnion: [m('a', 300)] } }, opts: { merge: true } },
      { op: 'commit', path: '', data: null },
    ]);
  });

  it('adds training minutes to the day instead of setting the total', async () => {
    await write.addMinutes('u', '2026-11-15', 45);
    expect(calls).toEqual([{ op: 'set', path: day, data: { sessionDone: true, loggedMin: { increment: 45 } }, opts: { merge: true } }]);
  });
});
