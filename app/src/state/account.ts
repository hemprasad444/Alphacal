import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseError } from 'firebase/app';
import { createUserWithEmailAndPassword, onIdTokenChanged, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useCallback, useEffect, useState } from 'react';
import { fb, firebaseEnabled } from '../lib/firebase';

/**
 * `off`: no Firebase project configured, so the app runs on-device only.
 * `denied`: signed in, but the email isn't on the tester allowlist.
 * `unverified`: a new account whose email link hasn't been opened yet. Accounts that already
 * have tester access skip this, so nobody who could sign in before is locked out.
 */
export type AccountStatus = 'off' | 'loading' | 'signedOut' | 'unverified' | 'denied' | 'signedIn';

export interface Account {
  status: AccountStatus;
  uid: string | null;
  email: string | null;
  /** Chose "Try the demo" on the sign-in screen: run on-device without an account. */
  demo: boolean;
}

const DEMO_KEY = 'rei-demo-mode';

export function authMessage(e: unknown): string {
  const code = e instanceof FirebaseError ? e.code : '';
  switch (code) {
    case 'auth/invalid-email': return 'That email address doesn’t look right.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Email or password is wrong.';
    case 'auth/email-already-in-use': return 'An account with this email exists. Sign in instead.';
    case 'auth/weak-password': return 'Use at least 6 characters for the password.';
    case 'auth/network-request-failed': return 'No connection. Check your network and try again.';
    case 'auth/too-many-requests': return 'Too many attempts. Wait a minute and try again.';
    case 'auth/missing-password': return 'Enter your password.';
    case 'auth/user-disabled': return 'This account has been switched off.';
    default: return e instanceof Error ? e.message : 'Something went wrong.';
  }
}

export function useAccount() {
  const [account, setAccount] = useState<Account>({ status: firebaseEnabled ? 'loading' : 'off', uid: null, email: null, demo: false });

  useEffect(() => {
    AsyncStorage.getItem(DEMO_KEY).then(v => v === '1' && setAccount(a => ({ ...a, demo: true }))).catch(() => {});
    if (!firebaseEnabled) return;
    const { auth, functions } = fb();
    return onIdTokenChanged(auth, async user => {
      if (!user) {
        setAccount(a => ({ ...a, status: 'signedOut', uid: null, email: null }));
        return;
      }
      const token = await user.getIdTokenResult();
      if (token.claims.tester === true) {
        setAccount(a => ({ ...a, status: 'signedIn', uid: user.uid, email: user.email }));
        return;
      }
      // New account: prove the email first. The backend refuses access until it's verified.
      if (!user.emailVerified) {
        setAccount(a => ({ ...a, status: 'unverified', uid: user.uid, email: user.email }));
        return;
      }
      // First sign-in on this account: ask the backend for the tester claim, then
      // refresh the token, which fires this listener again with the claim set.
      try {
        await httpsCallable(functions, 'activate')();
        await user.getIdToken(true);
      } catch (e) {
        const code = e instanceof FirebaseError ? e.code : '';
        const status = code === 'functions/permission-denied' ? 'denied' : code === 'functions/failed-precondition' ? 'unverified' : 'signedOut';
        if (status === 'signedOut') console.warn('REI: activation failed', e);
        setAccount(a => ({ ...a, status, uid: user.uid, email: user.email }));
      }
    });
  }, []);

  const setDemo = useCallback((on: boolean) => {
    AsyncStorage.setItem(DEMO_KEY, on ? '1' : '0').catch(() => {});
    setAccount(a => ({ ...a, demo: on }));
  }, []);

  const signIn = useCallback((email: string, password: string) => signInWithEmailAndPassword(fb().auth, email.trim(), password), []);
  const signUp = useCallback(async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(fb().auth, email.trim(), password);
    await sendEmailVerification(cred.user).catch(e => console.warn('REI: verification email failed', e));
    return cred;
  }, []);
  const resendVerification = useCallback(async () => {
    const user = fb().auth.currentUser;
    if (user) await sendEmailVerification(user);
  }, []);
  /** Re-reads the account; once the link has been opened, refreshing the token moves it on. True when verified. */
  const checkVerified = useCallback(async () => {
    const user = fb().auth.currentUser;
    if (!user) return false;
    await reload(user);
    if (!user.emailVerified) return false;
    await user.getIdToken(true);
    return true;
  }, []);
  const resetPassword = useCallback((email: string) => sendPasswordResetEmail(fb().auth, email.trim()), []);
  const signOut = useCallback(() => (firebaseEnabled ? fbSignOut(fb().auth) : Promise.resolve()), []);

  return { account, setDemo, signIn, signUp, resendVerification, checkVerified, resetPassword, signOut };
}
