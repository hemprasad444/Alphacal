import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { auth, db } from './admin';

/**
 * Grants the `tester` claim to a signed-in user whose email is on the allowlist.
 * The app calls this once after sign-in, then refreshes its ID token so security
 * rules can check the claim instead of reading the allowlist on every request.
 */
// Explicit, so a redeploy restores public access if a failed first deploy left it unset.
export const activate = onCall({ invoker: 'public' }, async req => {
  const email = req.auth?.token.email?.toLowerCase();
  if (!req.auth || !email) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (req.auth.token.tester === true) return { tester: true };
  const entry = await db.doc(`allowlist/${email}`).get();
  if (!entry.exists) throw new HttpsError('permission-denied', 'This email is not on the REI tester list.');
  await auth.setCustomUserClaims(req.auth.uid, { tester: true });
  return { tester: true };
});
