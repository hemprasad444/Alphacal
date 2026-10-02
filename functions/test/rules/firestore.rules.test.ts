import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rei',
    firestore: { rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'allowlist/tester@rei.app'), { addedBy: 'test' });
  });
});

// Email casing differs from the allowlist id on purpose: rules lowercase it.
const tester = () => env.authenticatedContext('alice', { email: 'Tester@rei.app' }).firestore();
const stranger = () => env.authenticatedContext('mallory', { email: 'mallory@evil.test' }).firestore();

describe('allowlist', () => {
  it('lets a tester see their own entry only', async () => {
    await assertSucceeds(getDoc(doc(tester(), 'allowlist/tester@rei.app')));
    await assertFails(getDoc(doc(tester(), 'allowlist/someone@else.app')));
  });
  it('cannot be written by clients', async () => {
    await assertFails(setDoc(doc(stranger(), 'allowlist/mallory@evil.test'), {}));
  });
});

describe('users', () => {
  it('tester owns their user doc and days', async () => {
    await assertSucceeds(setDoc(doc(tester(), 'users/alice'), { profile: { goal: 'x' } }));
    await assertSucceeds(setDoc(doc(tester(), 'users/alice/days/2026-10-02'), { meals: [] }));
    await assertSucceeds(getDoc(doc(tester(), 'users/alice/days/2026-10-02')));
  });
  it('locks out non-allowlisted users, even from their own uid', async () => {
    await assertFails(setDoc(doc(stranger(), 'users/mallory'), { profile: {} }));
  });
  it('keeps testers out of other users', async () => {
    await assertFails(getDoc(doc(tester(), 'users/bob')));
    await assertFails(setDoc(doc(tester(), 'users/bob/days/2026-10-02'), { meals: [] }));
  });
  it('accepts the tester claim without an allowlist entry', async () => {
    const db = env.authenticatedContext('carol', { email: 'carol@rei.app', tester: true }).firestore();
    await assertSucceeds(setDoc(doc(db, 'users/carol'), { profile: {} }));
  });
  it('rejects malformed day ids', async () => {
    await assertFails(setDoc(doc(tester(), 'users/alice/days/today'), { meals: [] }));
  });
  it('validates messages', async () => {
    await assertSucceeds(setDoc(doc(tester(), 'users/alice/messages/m1'), { role: 'user', text: 'hi', createdAt: 1 }));
    await assertFails(setDoc(doc(tester(), 'users/alice/messages/m2'), { role: 'admin', text: 'hi', createdAt: 1 }));
    await assertFails(setDoc(doc(tester(), 'users/alice/messages/m3'), { role: 'user', text: 'x'.repeat(4001), createdAt: 1 }));
  });
  it('validates weigh-ins', async () => {
    await assertSucceeds(setDoc(doc(tester(), 'users/alice/weighIns/2026-10-02'), { kg: 81.6 }));
    await assertFails(setDoc(doc(tester(), 'users/alice/weighIns/2026-10-02'), { kg: '81.6' }));
  });
  it('validates sessions', async () => {
    const run = { date: '2026-10-02', plan: 'RUN', done: 1, total: 1, seconds: 1800, cardio: { km: 5, seconds: 1800 } };
    await assertSucceeds(setDoc(doc(tester(), 'users/alice/sessions/s1'), run));
    await assertFails(setDoc(doc(tester(), 'users/alice/sessions/s2'), { ...run, date: 'today' }));
    await assertFails(setDoc(doc(tester(), 'users/alice/sessions/s3'), { ...run, seconds: -5 }));
    await assertFails(setDoc(doc(tester(), 'users/alice/sessions/s1'), { ...run, seconds: 10 }));
  });
  it('validates own foods', async () => {
    const food = { name: 'Usual breakfast', per: 1, kcal: 420, p: 30, c: 40, f: 14, units: [{ n: 'serving', g: 1 }], src: 'mine', serving: true };
    await assertSucceeds(setDoc(doc(tester(), 'users/alice/foods/m:abc123'), food));
    await assertSucceeds(getDoc(doc(tester(), 'users/alice/foods/m:abc123')));
    await assertSucceeds(deleteDoc(doc(tester(), 'users/alice/foods/m:abc123')));
    await assertFails(setDoc(doc(tester(), 'users/alice/foods/m:x'), { ...food, kcal: -1 }));
    await assertFails(setDoc(doc(tester(), 'users/alice/foods/m:x'), { ...food, units: [] }));
    await assertFails(setDoc(doc(tester(), 'users/alice/foods/m:x'), { ...food, name: '' }));
    await assertFails(setDoc(doc(tester(), 'users/bob/foods/m:x'), food));
  });
  it('validates measurements and progress photos', async () => {
    await assertSucceeds(setDoc(doc(tester(), 'users/alice/measurements/2026-10-02'), { date: '2026-10-02', waist: 86.5, arms: 37 }));
    await assertFails(setDoc(doc(tester(), 'users/alice/measurements/2026-10-02'), { date: '2026-10-02', waist: '86' }));
    await assertFails(setDoc(doc(tester(), 'users/alice/measurements/2026-10-02'), { date: '2026-10-02', weight: 80 }));
    await assertFails(setDoc(doc(tester(), 'users/alice/measurements/someday'), { waist: 86 }));
    const photo = { date: '2026-10-02', pose: 'front', path: 'users/alice/progress/p1.jpg', createdAt: 1 };
    await assertSucceeds(setDoc(doc(tester(), 'users/alice/photos/p1'), photo));
    await assertFails(setDoc(doc(tester(), 'users/alice/photos/p2'), { ...photo, path: 'users/bob/progress/p1.jpg' }));
    await assertFails(setDoc(doc(tester(), 'users/alice/photos/p3'), { ...photo, pose: 'selfie' }));
    await assertFails(getDoc(doc(tester(), 'users/bob/photos/p1')));
  });
  it('leaves programs, reports and usage to the server', async () => {
    await assertFails(setDoc(doc(tester(), 'users/alice/programs/2026-W40'), { days: [] }));
    await assertFails(setDoc(doc(tester(), 'users/alice/reports/2026-W40'), { headline: 'x' }));
    await assertFails(setDoc(doc(tester(), 'users/alice/usage/today'), { n: 0 }));
    await assertFails(setDoc(doc(tester(), 'users/alice/jobs/j1'), { type: 'program' }));
  });
});
