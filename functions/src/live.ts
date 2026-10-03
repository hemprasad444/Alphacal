import { agentGreeting, agentPrompt, historyBlock, isVoice, LIVEKIT_TOOLS, recentTurns, reiContext } from '@rei/shared';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from 'livekit-server-sdk';
import { gzipSync } from 'node:zlib';
import { db } from './admin';
import { loadUser, usageDay } from './chat/load';
import { BASE, key, TTS_API_KEY, VOICE_ID } from './voice';

/** Set by scripts/agent-setup.mjs in functions/.env.<project-id>. */
const AGENT_ID = defineString('ELEVENLABS_AGENT_ID', { default: '' });

/** Which live engine REI uses: the ElevenLabs agent, or our own LiveKit agent with a Fish voice (voice-agent/). */
const LIVE_ENGINE = defineString('LIVE_ENGINE', { default: 'elevenlabs' });
const LIVEKIT_URL = defineString('LIVEKIT_URL', { default: '' });
const LIVEKIT_API_KEY = defineString('LIVEKIT_API_KEY', { default: '' });
const LIVEKIT_API_SECRET = defineSecret('LIVEKIT_API_SECRET');
const FISH_VOICE_ID = defineString('FISH_VOICE_ID', { default: '' });
/**
 * The live agent's models, first choice first. GPT-OSS on Groq starts answering in ~0.4 s against
 * 1.2-2.9 s for GPT-6 Luna, with the same meal estimates once the prompt carries calorie anchors.
 */
const LLM_LIVE = defineString('LLM_LIVE', { default: 'openai/gpt-oss-120b,openai/gpt-6-luna' });

/**
 * Live sessions a user may start per day. The app prepares one each time Talk opens, so this
 * counts prepared sessions too; minutes are capped by the agent itself.
 */
const LIVE_DAILY = 40;
/** Longest single call, in seconds; same cap as the ElevenLabs agent (scripts/agent-setup.mjs). */
const MAX_SECONDS = 600;

export type Engine = 'elevenlabs' | 'livekit';

/**
 * Starts a live voice conversation with this user's prompt (personality, memory, today's
 * numbers), greeting and voice, on either engine:
 * - elevenlabs: a short-lived token for the private REI agent, plus the overrides.
 * - livekit: a token for a fresh room; joining it dispatches the REI agent with the session baked in.
 * The app may ask for an engine (for side-by-side testing); otherwise LIVE_ENGINE decides.
 */
export const voiceSession = onCall({ secrets: [TTS_API_KEY, LIVEKIT_API_SECRET], timeoutSeconds: 30 }, async req => {
  if (!req.auth || req.auth.token.tester !== true) throw new HttpsError('permission-denied', 'Not on the tester list.');
  const uid = req.auth.uid;
  const asked = (req.data as { engine?: unknown } | undefined)?.engine;
  const engine: Engine = asked === 'livekit' || asked === 'elevenlabs' ? asked : LIVE_ENGINE.value() === 'livekit' ? 'livekit' : 'elevenlabs';
  const t0 = Date.now();
  const usage = db.doc(`users/${uid}/usage/${usageDay()}`);
  const used = ((await usage.get()).get('voice') as number | undefined) ?? 0;
  if (used >= LIVE_DAILY) throw new HttpsError('resource-exhausted', 'That’s enough live voice for today. Back tomorrow, or type to REI.');

  if (engine === 'livekit') {
    const url = LIVEKIT_URL.value();
    const apiKey = LIVEKIT_API_KEY.value();
    const secret = LIVEKIT_API_SECRET.value();
    if (!url || !apiKey || !secret) throw new HttpsError('failed-precondition', 'Live voice isn’t set up yet.');
    usage.set({ voice: FieldValue.increment(1) }, { merge: true }).catch(e => logger.warn('usage write failed', e));
    const data = await loadUser(uid);
    const ctx = reiContext(data.input);
    const session = {
      prompt: agentPrompt(ctx),
      history: recentTurns(data.messages),
      greeting: agentGreeting(ctx),
      voice: FISH_VOICE_ID.value(),
      models: LLM_LIVE.value().split(',').map(s => s.trim()).filter(Boolean),
      tools: LIVEKIT_TOOLS,
      maxSeconds: MAX_SECONDS,
    };
    // The session rides inside the join token, which travels in the connect URL: compress it.
    const metadata = `gz:${gzipSync(JSON.stringify(session)).toString('base64')}`;
    const at = new AccessToken(apiKey, secret, { identity: uid, ttl: '10m' });
    at.addGrant({ room: `rei-${uid}-${Date.now()}`, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
    at.roomConfig = new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName: 'rei', metadata })], emptyTimeout: 30, maxParticipants: 2 });
    const token = await at.toJwt();
    logger.info('voiceSession', { uid, engine, ms: Date.now() - t0, used: used + 1, tokenBytes: token.length });
    return { engine, url, token };
  }

  const agent = AGENT_ID.value();
  const k = key();
  if (!agent || !k) throw new HttpsError('failed-precondition', 'Live voice isn’t set up yet.');
  usage.set({ voice: FieldValue.increment(1) }, { merge: true }).catch(e => logger.warn('usage write failed', e));
  const [data, res] = await Promise.all([
    loadUser(uid),
    fetch(`${BASE()}/v1/convai/conversation/token?agent_id=${encodeURIComponent(agent)}`, { headers: { 'xi-api-key': k } }),
  ]);
  if (!res.ok) {
    logger.error('voiceSession token failed', { status: res.status, detail: (await res.text().catch(() => '')).slice(0, 300) });
    throw new HttpsError('unavailable', 'Live voice is unavailable right now.');
  }
  const { token } = (await res.json()) as { token?: string };
  if (!token) throw new HttpsError('unavailable', 'Live voice is unavailable right now.');
  const ctx = reiContext(data.input);
  logger.info('voiceSession', { uid, engine, ms: Date.now() - t0, used: used + 1 });
  return {
    engine,
    token,
    prompt: agentPrompt(ctx) + historyBlock(recentTurns(data.messages)),
    firstMessage: agentGreeting(ctx),
    voiceId: isVoice(data.settings.voice) ? data.settings.voice : VOICE_ID.value(),
  };
});
