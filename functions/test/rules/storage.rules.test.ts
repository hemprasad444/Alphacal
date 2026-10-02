import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;
const root = resolve(__dirname, '../../..');

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rei',
    firestore: { rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(root, 'storage.rules'), 'utf8') },
  });
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'allowlist/tester@rei.app'), {});
  });
});
afterAll(() => env.cleanup());

const bytes = new Uint8Array([1, 2, 3]);
const storage = (uid: string, email: string) => env.authenticatedContext(uid, { email, ...(email === 'tester@rei.app' ? { tester: true } : {}) }).storage();

describe('storage', () => {
  it('lets a tester upload their own meal photo', async () => {
    await assertSucceeds(uploadBytes(ref(storage('alice', 'tester@rei.app'), 'users/alice/meals/a.jpg'), bytes, { contentType: 'image/jpeg' }));
  });
  it('rejects non-images, other users and strangers', async () => {
    await assertFails(uploadBytes(ref(storage('alice', 'tester@rei.app'), 'users/alice/meals/a.txt'), bytes, { contentType: 'text/plain' }));
    await assertFails(uploadBytes(ref(storage('alice', 'tester@rei.app'), 'users/bob/meals/a.jpg'), bytes, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage('mallory', 'mallory@evil.test'), 'users/mallory/meals/a.jpg'), bytes, { contentType: 'image/jpeg' }));
  });
  it('keeps progress photos private and image-only', async () => {
    await assertSucceeds(uploadBytes(ref(storage('alice', 'tester@rei.app'), 'users/alice/progress/p1.jpg'), bytes, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage('alice', 'tester@rei.app'), 'users/alice/progress/p1.txt'), bytes, { contentType: 'text/plain' }));
    await assertFails(uploadBytes(ref(storage('alice', 'tester@rei.app'), 'users/bob/progress/p1.jpg'), bytes, { contentType: 'image/jpeg' }));
  });
  it('accepts voice clips as audio only', async () => {
    await assertSucceeds(uploadBytes(ref(storage('alice', 'tester@rei.app'), 'users/alice/voice/v.m4a'), bytes, { contentType: 'audio/mp4' }));
    await assertFails(uploadBytes(ref(storage('alice', 'tester@rei.app'), 'users/alice/voice/v.jpg'), bytes, { contentType: 'image/jpeg' }));
  });
});
