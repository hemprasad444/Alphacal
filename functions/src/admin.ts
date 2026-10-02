// Shared setup, imported by every function module so it runs before any function is
// defined (imports are hoisted, so options set in index.ts would come too late).
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';

// Mumbai: closest region to REI's users.
setGlobalOptions({ region: 'asia-south1', maxInstances: 10 });

if (!getApps().length) initializeApp();

export const db = getFirestore();
export const auth = getAuth();
