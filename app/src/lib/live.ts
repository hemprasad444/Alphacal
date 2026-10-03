import Constants, { ExecutionEnvironment } from 'expo-constants';
import { httpsCallable } from 'firebase/functions';
import { fb } from './firebase';

/** Live voice uses the native ElevenLabs SDK, which Expo Go doesn't include; it needs a development build. */
export const liveVoiceAvailable = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export interface VoiceSession {
  token: string;
  prompt: string;
  firstMessage: string;
  voiceId: string;
}

/** A prepared session is used within this window; after it, today's numbers may be stale. */
const FRESH_MS = 60_000;
let prepared: { at: number; session: Promise<VoiceSession> } | null = null;

const fetchSession = () => httpsCallable<void, VoiceSession>(fb().functions, 'voiceSession', { timeout: 20000 })().then(r => r.data);

/** Gets a live session ready in the background (from the Talk screen), so opening Live skips that wait. */
export function prepareVoiceSession() {
  if (prepared && Date.now() - prepared.at < FRESH_MS) return;
  const session = fetchSession();
  session.catch(() => {
    if (prepared?.session === session) prepared = null;
  });
  prepared = { at: Date.now(), session };
}

/** The prepared session when it's fresh, otherwise a new one. Each session is used once. */
export function takeVoiceSession(): Promise<VoiceSession> {
  const session = prepared && Date.now() - prepared.at < FRESH_MS ? prepared.session : fetchSession();
  prepared = null;
  return session;
}
