// save(): what the chat and photo endpoints write for a meal, a vow change and a workout.
import { DEFAULT_PROFILE, type Meal } from '@rei/shared';

interface Write { path: string; data: Record<string, unknown>; opts?: unknown }
const writes: Write[] = [];
let autoId = 0;

function ref(path: string): Record<string, unknown> {
  return {
    path,
    collection: (name: string) => ({ doc: (id?: string) => ref(`${path}/${name}/${id ?? `auto${++autoId}`}`) }),
  };
}

jest.mock('../src/admin', () => ({
  db: {
    doc: (path: string) => ref(path),
    collection: (name: string) => ({ doc: () => ({ id: `generatedid${++autoId}xyz` }) }),
    batch: () => ({
      set: (r: { path: string }, data: Record<string, unknown>, opts?: unknown) => writes.push({ path: r.path, data, opts }),
      commit: async () => undefined,
    }),
  },
  auth: {},
}));
// Only save() is under test: the HTTP and logging layers are stubs.
jest.mock('firebase-functions', () => ({ logger: { info: () => {}, warn: () => {}, error: () => {} } }));
jest.mock('firebase-functions/params', () => ({ defineInt: () => ({ value: () => 0 }), defineSecret: () => ({ value: () => '' }), defineString: () => ({ value: () => '' }) }));
jest.mock('firebase-functions/v2/https', () => ({ onRequest: (_: unknown, f: unknown) => f, HttpsError: Error }));
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayUnion: (...elements: unknown[]) => ({ arrayUnion: elements }), increment: (n: number) => ({ increment: n }) },
  FieldPath: { documentId: () => '__name__' },
}));

// eslint-disable-next-line import/first
import { save } from '../src/chat';

const data = (meals: Meal[] = []) => ({
  input: { profile: { ...DEFAULT_PROFILE }, meals, now: new Date(2026, 10, 15, 13, 5) },
  today: '2026-11-15',
  memory: [],
}) as unknown as Parameters<typeof save>[1];

const lunch: Meal = { time: '13:05', name: 'Dal rice', kcal: 500, p: 18, c: 80, f: 10, src: 'ai' };

beforeEach(() => {
  writes.length = 0;
});

describe('save', () => {
  it('gives each meal its own id, so two identical meals stay two', async () => {
    await save('u1', data(), 'r1', 'Logged.', lunch, null, null);
    await save('u1', data([lunch]), 'r2', 'Logged.', lunch, null, null);
    const ids = writes.filter(w => w.path === 'users/u1/days/2026-11-15').map(w => ((w.data.meals as { arrayUnion: Meal[] }).arrayUnion[0]).id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('writes the checked vow values, not the raw ones', async () => {
    await save('u1', data(), 'r1', 'Done.', null, { kcal: ' 2100 ', deadline: '2026-13-01' }, null);
    const user = writes.find(w => w.path === 'users/u1' && 'profile' in w.data);
    expect(user?.data.profile).toEqual({ kcal: '2100' });
    expect(user?.opts).toEqual({ mergeFields: ['profile.kcal'] });
  });

  it('records a weigh-in only when the weight passed', async () => {
    await save('u1', data(), 'r1', 'Done.', null, { weight: '0' }, null);
    expect(writes.some(w => w.path.includes('/weighIns/'))).toBe(false);
    await save('u1', data(), 'r2', 'Done.', null, { weight: '81.2' }, null);
    expect(writes.find(w => w.path === 'users/u1/weighIns/2026-11-15')?.data).toEqual({ kg: 81.2 });
  });
});
