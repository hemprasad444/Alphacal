import type { Request } from 'firebase-functions/v2/https';
import { auth } from './admin';

/** Checks the Firebase ID token on an HTTP request and that its user is an invited tester. */
export async function verify(req: Request): Promise<{ uid: string } | { error: number; message: string }> {
  const m = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
  if (!m) return { error: 401, message: 'Missing token.' };
  try {
    const t = await auth.verifyIdToken(m[1]);
    if (t.tester !== true) return { error: 403, message: 'Not on the tester list.' };
    return { uid: t.uid };
  } catch {
    return { error: 401, message: 'Invalid token.' };
  }
}
