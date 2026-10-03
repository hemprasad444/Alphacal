import Constants, { ExecutionEnvironment } from 'expo-constants';
import { httpsCallable } from 'firebase/functions';
import type { LiveEngine } from '@rei/shared';
import { fb } from './firebase';

/** Live voice runs over native WebRTC (LiveKit), which Expo Go doesn't include; it needs a development build. */
export const liveVoiceAvailable = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/** A live call, ready to start: on the ElevenLabs agent, or in a LiveKit room with our own agent (Fish voice). */
export type VoiceSession =
  | { engine: 'elevenlabs'; token: string; prompt: string; firstMessage: string; voiceId: string }
  | { engine: 'livekit'; url: string; token: string };

/** A prepared session is used within this window; after it, today's numbers may be stale. */
const FRESH_MS = 60_000;
let prepared: { at: number; engine: LiveEngine; session: Promise<VoiceSession> } | null = null;

const fetchSession = (engine: LiveEngine) =>
  httpsCallable<{ engine: LiveEngine }, VoiceSession>(fb().functions, 'voiceSession', { timeout: 20000 })({ engine }).then(r => r.data);
const fresh = (engine: LiveEngine) => !!prepared && prepared.engine === engine && Date.now() - prepared.at < FRESH_MS;

/** Gets a live session ready in the background (from the Talk screen), so opening Live skips that wait. */
export function prepareVoiceSession(engine: LiveEngine) {
  if (fresh(engine)) return;
  const session = fetchSession(engine);
  session.catch(() => {
    if (prepared?.session === session) prepared = null;
  });
  prepared = { at: Date.now(), engine, session };
}

/** The prepared session when it's fresh, otherwise a new one. Each session is used once. */
export function takeVoiceSession(engine: LiveEngine): Promise<VoiceSession> {
  const session = fresh(engine) && prepared ? prepared.session : fetchSession(engine);
  prepared = null;
  return session;
}
