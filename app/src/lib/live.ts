import Constants, { ExecutionEnvironment } from 'expo-constants';
import { httpsCallable } from 'firebase/functions';
import { LIVE_TOOL_NAMES } from '@rei/shared';
import { fb } from './firebase';

/** Live voice runs over native WebRTC (LiveKit), which Expo Go doesn't include; it needs a development build. */
export const liveVoiceAvailable = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/** A live call, ready to start: a LiveKit room that our agent joins with this user's session (Fish voice). */
export type VoiceSession = { url: string; token: string };

/** A prepared session is used within this window; after it, today's numbers may be stale. */
const FRESH_MS = 60_000;
let prepared: { at: number; session: Promise<VoiceSession> } | null = null;

// `tools`: the actions LiveVoice carries out (all of them; its tools() map is typed to match).
const fetchSession = () =>
  httpsCallable<{ tools: readonly string[] }, VoiceSession>(fb().functions, 'voiceSession', { timeout: 20000 })({ tools: LIVE_TOOL_NAMES }).then(r => r.data);
const fresh = () => !!prepared && Date.now() - prepared.at < FRESH_MS;

/** Gets a live session ready in the background (from the Talk screen), so opening Live skips that wait. */
export function prepareVoiceSession() {
  if (fresh()) return;
  const session = fetchSession();
  session.catch(() => {
    if (prepared?.session === session) prepared = null;
  });
  prepared = { at: Date.now(), session };
}

/** The prepared session when it's fresh, otherwise a new one. Each session is used once. */
export function takeVoiceSession(): Promise<VoiceSession> {
  const session = fresh() && prepared ? prepared.session : fetchSession();
  prepared = null;
  return session;
}
