import { agentGreeting, agentPrompt, isVoice, reiContext } from '@rei/shared';
import { logger } from 'firebase-functions';
import { defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { loadUser } from './chat/load';
import { BASE, key, TTS_API_KEY, VOICE_ID } from './voice';

/** Set by scripts/agent-setup.mjs in functions/.env.<project-id>. */
const AGENT_ID = defineString('ELEVENLABS_AGENT_ID', { default: '' });

/**
 * Starts a live voice conversation: a short-lived ElevenLabs token for the private REI
 * agent, plus this user's prompt (personality, memory, today's numbers), greeting and voice.
 */
export const voiceSession = onCall({ secrets: [TTS_API_KEY], timeoutSeconds: 30 }, async req => {
  if (!req.auth || req.auth.token.tester !== true) throw new HttpsError('permission-denied', 'Not on the tester list.');
  const agent = AGENT_ID.value();
  const k = key();
  if (!agent || !k) throw new HttpsError('failed-precondition', 'Live voice isn’t set up yet.');
  const t0 = Date.now();
  const [data, res] = await Promise.all([
    loadUser(req.auth.uid),
    fetch(`${BASE()}/v1/convai/conversation/token?agent_id=${encodeURIComponent(agent)}`, { headers: { 'xi-api-key': k } }),
  ]);
  if (!res.ok) {
    logger.error('voiceSession token failed', { status: res.status, detail: (await res.text().catch(() => '')).slice(0, 300) });
    throw new HttpsError('unavailable', 'Live voice is unavailable right now.');
  }
  const { token } = (await res.json()) as { token?: string };
  if (!token) throw new HttpsError('unavailable', 'Live voice is unavailable right now.');
  const ctx = reiContext(data.input);
  logger.info('voiceSession', { uid: req.auth.uid, ms: Date.now() - t0 });
  return {
    token,
    prompt: agentPrompt(ctx),
    firstMessage: agentGreeting(ctx),
    voiceId: isVoice(data.settings.voice) ? data.settings.voice : VOICE_ID.value(),
  };
});
