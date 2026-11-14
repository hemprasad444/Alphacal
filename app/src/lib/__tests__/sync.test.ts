// Day writes from the phone must merge with the server's: meals added by arrayUnion, edited or
// deleted one at a time by a transaction, minutes by increment. Never the whole list or total.
import type { Meal } from '@rei/shared';

const mockCalls: { op: string; path: string; data: unknown; opts?: unknown }[] = [];
/** What the transaction reads, or an error when offline. */
let mockStored: { meals?: Meal[] } | undefined;
let mockOffline = false;

jest.mock('../firebase', () => ({ fb: () => ({ db: {} }) }));
jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  doc: (parent: { path: string }, id: string) => ({ path: `${parent.path}/${id}` }),
  setDoc: async (ref: { path: string }, data: unknown, opts?: unknown) => {
    mockCalls.push({ op: 'set', path: ref.path, data, opts });
  },
  runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    if (mockOffline) throw new Error('Failed to get document because the client is offline.');
    const ops: typeof mockCalls = [];
    const out = await fn({
      get: async () => ({ data: () => mockStored }),
      set: (ref: { path: string }, data: unknown, opts?: unknown) => ops.push({ op: 'tx.set', path: ref.path, data, opts }),
    });
    mockCalls.push(...ops);
    return out;
  },
  writeBatch: () => {
    const ops: typeof mockCalls = [];
    return {
      set: (ref: { path: string }, data: unknown, opts?: unknown) => ops.push({ op: 'batch.set', path: ref.path, data, opts }),
      commit: async () => {
        mockCalls.push(...ops, { op: 'commit', path: '', data: null });
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

const m = (id: string | undefined, kcal = 400, name = 'Dal rice'): Meal => ({ ...(id ? { id } : {}), time: '13:00', name, kcal, p: 15, c: 60, f: 10 });
const day = 'users/u/days/2026-11-15';
const stored$ = () => (mockCalls.find(c => c.op === 'tx.set')?.data as { meals: Meal[] } | undefined)?.meals;

beforeEach(() => {
  mockCalls.length = 0;
  mockStored = undefined;
  mockOffline = false;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('day writes', () => {
  it('adds a meal without rewriting the list', async () => {
    await write.addMeal('u', '2026-11-15', m('a'));
    expect(mockCalls).toEqual([{ op: 'set', path: day, data: { meals: { arrayUnion: [m('a')] } }, opts: { merge: true } }]);
  });

  it('adds training minutes to the day instead of setting the total', async () => {
    await write.addMinutes('u', '2026-11-15', 45);
    expect(mockCalls).toEqual([{ op: 'set', path: day, data: { sessionDone: true, loggedMin: { increment: 45 } }, opts: { merge: true } }]);
  });
});

describe('changeMeal', () => {
  it('deletes one of two identical older meals, keeping the meal REI logged meanwhile', async () => {
    const egg = m(undefined, 70, 'Egg');
    mockStored = { meals: [egg, { ...egg }, m('srv', 500, 'Biryani')] };
    expect(await write.changeMeal('u', '2026-11-15', egg, null, false)).toBe('saved');
    expect(stored$()?.map(x => x.name)).toEqual(['Egg', 'Biryani']);
    expect(mockCalls[0]).toMatchObject({ op: 'tx.set', path: day, opts: { merge: true } });
  });

  it('edits the meal in place by id', async () => {
    mockStored = { meals: [m('a'), m('b', 300, 'Tea')] };
    expect(await write.changeMeal('u', '2026-11-15', m('a'), m('a', 350), true)).toBe('saved');
    expect(stored$()).toEqual([m('a', 350), m('b', 300, 'Tea')]);
  });

  it('writes nothing when the meal is gone (deleted or changed elsewhere)', async () => {
    mockStored = { meals: [m('b', 300, 'Tea')] };
    expect(await write.changeMeal('u', '2026-11-15', m('a'), m('a', 350), true)).toBe('gone');
    expect(mockCalls).toEqual([]);
  });

  it('offline with a unique id: queues a change of exactly that meal', async () => {
    mockOffline = true;
    expect(await write.changeMeal('u', '2026-11-15', m('a'), m('a', 350), true)).toBe('queued');
    await Promise.resolve();
    expect(mockCalls).toEqual([
      { op: 'batch.set', path: day, data: { meals: { arrayRemove: [m('a')] } }, opts: { merge: true } },
      { op: 'batch.set', path: day, data: { meals: { arrayUnion: [m('a', 350)] } }, opts: { merge: true } },
      { op: 'commit', path: '', data: null },
    ]);
  });

  it('offline without an id (or a shared one): writes nothing and says so', async () => {
    mockOffline = true;
    expect(await write.changeMeal('u', '2026-11-15', m(undefined), null, false)).toBe('failed');
    expect(await write.changeMeal('u', '2026-11-15', m('a'), null, false)).toBe('failed');
    expect(mockCalls).toEqual([]);
  });
});
