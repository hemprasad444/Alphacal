import { agentPrompt, characterOf, continuityNote, fallbackOpener, hasVoice, historyBlock, isVoice, liveTools, recentTurns, reiContext, type ReiContext, thread, type Thread } from '@rei/shared';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from 'livekit-server-sdk';
import { gzipSync } from 'node:zlib';
import { db } from './admin';
import { loadUser, usageToday } from './chat/load';
import { OPENROUTER_API_KEY } from './llm';
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
export const voiceSession = onCall({ secrets: [TTS_API_KEY, LIVEKIT_API_SECRET, OPENROUTER_API_KEY], timeoutSeconds: 30 }, async req => {
  if (!req.auth || req.auth.token.tester !== true) throw new HttpsError('permission-denied', 'Not on the tester list.');
  const uid = req.auth.uid;
  const body = req.data as { engine?: unknown; tools?: unknown } | undefined;
  const asked = body?.engine;
  // Only the actions this app build handles (older builds don't list them, and lack the newer ones).
  const tools = liveTools(body?.tools);
  const names = tools.map(t => t.name);
  const engine: Engine = asked === 'livekit' || asked === 'elevenlabs' ? asked : LIVE_ENGINE.value() === 'livekit' ? 'livekit' : 'elevenlabs';
  const t0 = Date.now();
  const { ref: usage, data: counts } = await usageToday(uid);
  const used = Number(counts.voice ?? 0);
  if (used >= LIVE_DAILY) throw new HttpsError('resource-exhausted', 'That’s enough live voice for today. Back tomorrow, or type to REI.');

  if (engine === 'livekit') {
    const url = LIVEKIT_URL.value();
    const apiKey = LIVEKIT_API_KEY.value();
    const secret = LIVEKIT_API_SECRET.value();
    if (!url || !apiKey || !secret) throw new HttpsError('failed-precondition', 'Live voice isn’t set up yet.');
    usage.set({ voice: FieldValue.increment(1) }, { merge: true }).catch(e => logger.warn('usage write failed', e));
    const data = await loadUser(uid);
    const ctx = reiContext(data.input);
    const flow = thread(data.messages, Date.now(), data.timeZone);
    const prompt = `${agentPrompt(ctx, names)}\n\n${continuityNote(flow)}`;
    const session = {
      prompt,
      history: recentTurns(data.messages),
      greeting: await opener(prompt, flow, ctx, historyBlock(recentTurns(data.messages, 8))),
      // The character's own voice once it's added; REI's Fish voice until then.
      voice: (hasVoice(characterOf(data.settings.character)) ? characterOf(data.settings.character).fish : '') || FISH_VOICE_ID.value(),
      models: LLM_LIVE.value().split(',').map(s => s.trim()).filter(Boolean),
      tools,
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
  const flow = thread(data.messages, Date.now(), data.timeZone);
  const prompt = `${agentPrompt(ctx, names)}\n\n${continuityNote(flow)}${historyBlock(recentTurns(data.messages))}`;
  const firstMessage = await opener(prompt, flow, ctx, '');
  logger.info('voiceSession', { uid, engine, ms: Date.now() - t0, used: used + 1, gap: flow.gap });
  return {
    engine,
    token,
    prompt,
    firstMessage,
    voiceId: isVoice(data.settings.voice) ? data.settings.voice : VOICE_ID.value(),
  };
});

const OPENER = `They just opened a live voice call with you. Write ONLY your first spoken line: 4 to 16 words, in your personality. In this order: 1) If the CONVERSATION note has an OPEN PLAN, ask how it went; it has already happened, so never wish them luck or tell them to enjoy it. 2) If it's your first conversation, introduce yourself as REI. 3) If they've been away for days, call out the gap. 4) Otherwise pick up what they said last. Bring up food, protein or today's session only when nothing above applies. Never "how are you", "what's up" or "what's good". Plain words, at most one audio tag like [laughs].`;

/**
 * REI's first line for a call, written for this moment by the fast live model (~0.5 s, while the
 * app prepares the session in the background). Falls back to a scripted line that still follows on.
 */
async function opener(prompt: string, flow: Thread, ctx: ReiContext, recent: string): Promise<string> {
  const fallback = fallbackOpener(flow, { name: ctx.profile.name, bro: ctx.bro, tough: ctx.tough, seed: Date.now() });
  const models = LLM_LIVE.value().split(',').map(s => s.trim()).filter(Boolean);
  const t0 = Date.now();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY.value()}`, 'Content-Type': 'application/json', 'X-Title': 'REI opener' },
      body: JSON.stringify({
        model: models[0],
        models,
        max_tokens: 400,
        temperature: 0.9,
        reasoning: { effort: 'low', exclude: true },
        provider: { order: ['groq', 'cerebras'], allow_fallbacks: true },
        messages: [{ role: 'system', content: `${prompt}${recent}` }, { role: 'user', content: OPENER }],
      }),
      signal: AbortSignal.timeout(2500),
    });
    const out = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const line = (out.choices?.[0]?.message?.content ?? '').replace(/^["“]|["”]$/g, '').replace(/\s+/g, ' ').trim();
    const ok = line.length >= 4 && line.length <= 160 && !/how are you|how[’']?s (it going|your)|what[’']?s (up|good|going on)/i.test(line);
    logger.info('opener', { ms: Date.now() - t0, gap: flow.gap, used: ok ? 'model' : 'fallback' });
    return ok ? line : fallback;
  } catch (e) {
    logger.warn('opener failed', { ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
    return fallback;
  }
}
