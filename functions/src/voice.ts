// Premium voice through ElevenLabs: text → streamed speech, and speech → text.
// The key stays in Secret Manager. Until it's set (any value shorter than 20
// characters counts as unset), both endpoints answer 503 and the app falls back
// to the iPhone's own voice and keyboard dictation.
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { characterOf, DEFAULT_VOICE, hasVoice, isVoice, stripTags } from '@rei/shared';
import { speak, TtsError } from './elevenlabs';
import { verify } from './http';

/** Set with: firebase functions:secrets:set TTS_API_KEY (enter "none" until you have one). */
export const TTS_API_KEY = defineSecret('TTS_API_KEY');
/** Fish Audio, for voice characters (characters.ts). */
export const FISH_API_KEY = defineSecret('FISH_API_KEY');
/** Fish model: the free S2.1 Pro until Nov 30, 2026, then "s2.1-pro". */
const FISH_MODEL = defineString('FISH_MODEL', { default: 's2.1-pro-free' });
/** REI's voice when the app doesn't pick one (from VOICES). */
export const VOICE_ID = defineString('TTS_VOICE_ID', { default: DEFAULT_VOICE });

/**
 * ElevenLabs model. eleven_v4_turbo: most expressive and fastest (~150 ms to first sound), over
 * their WebSocket. eleven_v3: expressive, slower to start. eleven_flash_v2_5: cheapest, flat.
 */
const TTS_MODEL = defineString('TTS_MODEL', { default: 'eleven_v4_turbo' });
const TAG_MODELS = ['eleven_v3', 'eleven_v3_conversational', 'eleven_v4_turbo'];

export const BASE = () => process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';
/** The ElevenLabs key, or null while it's unset ("none"). */
export const key = () => {
  const k = TTS_API_KEY.value();
  return k && k.length >= 20 ? k : null;
};

/**
 * GET /tts?t=<sentence>[&v=<voice id>]  → audio/mpeg, streamed as it's generated.
 * GET /tts?probe=1       → 204 when the premium voice is configured, 503 when not.
 * GET (not POST) so the phone's audio player can stream it directly with an auth header.
 */
export const tts = onRequest({ secrets: [TTS_API_KEY, FISH_API_KEY], timeoutSeconds: 60, concurrency: 40, cors: true }, async (req, res) => {
  const who = await verify(req);
  if ('error' in who) {
    res.status(who.error).json({ error: who.message });
    return;
  }
  // A voice character ("c:naruto") speaks through Fish Audio when its voice has been added.
  const ch = typeof req.query.v === 'string' && req.query.v.startsWith('c:') ? characterOf(req.query.v.slice(2)) : null;
  const fish = FISH_API_KEY.value();
  if (ch && hasVoice(ch) && fish && !req.query.probe) {
    await fishSpeak(req.query.t, ch.fish, fish, res, who.uid);
    return;
  }
  const k = key();
  if (!k) {
    res.status(503).json({ error: 'Premium voice is not configured.' });
    return;
  }
  if (req.query.probe) {
    res.status(204).end();
    return;
  }
  const model = TTS_MODEL.value() || 'eleven_v4_turbo';
  const raw = typeof req.query.t === 'string' ? req.query.t.trim().slice(0, 600) : '';
  // Other models would read a tag out loud.
  const text = TAG_MODELS.includes(model) ? raw : stripTags(raw);
  if (!text) {
    res.status(400).json({ error: 'Missing text.' });
    return;
  }
  const voice = isVoice(req.query.v) ? req.query.v : VOICE_ID.value();
  const t0 = Date.now();
  let first = 0;
  try {
    await speak({
      key: k, model, voice, text, base: BASE(),
      onAudio: chunk => {
        if (!first) {
          first = Date.now() - t0;
          res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' });
        }
        res.write(chunk);
      },
    });
  } catch (e) {
    logger.error('tts upstream failed', { voice, model, status: e instanceof TtsError ? e.status : undefined, detail: e instanceof Error ? e.message : String(e) });
    // Once audio has started the status is sent; end what played rather than switch to JSON.
    if (first) res.end();
    else res.status(502).json({ error: 'Voice unavailable.' });
    return;
  }
  res.end();
  logger.info('tts', { uid: who.uid, model, chars: text.length, firstByteMs: first, totalMs: Date.now() - t0 });
});

/** Streams one sentence from Fish Audio as MP3. Fish S2 performs [tags] itself, so they stay in. */
async function fishSpeak(t: unknown, voice: string, apiKey: string, res: Parameters<Parameters<typeof onRequest>[0]>[1], uid: string) {
  const text = typeof t === 'string' ? t.trim().slice(0, 600) : '';
  if (!text) {
    res.status(400).json({ error: 'Missing text.' });
    return;
  }
  const t0 = Date.now();
  const model = FISH_MODEL.value() || 's2.1-pro-free';
  const upstream = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', model },
    body: JSON.stringify({ text, reference_id: voice, format: 'mp3', mp3_bitrate: 128, latency: 'balanced' }),
  }).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    logger.error('fish tts failed', { status: upstream?.status, detail: upstream ? (await upstream.text().catch(() => '')).slice(0, 300) : 'network' });
    res.status(502).json({ error: 'Voice unavailable.' });
    return;
  }
  res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' });
  let first = 0;
  const reader = upstream.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!first) first = Date.now() - t0;
    res.write(Buffer.from(value));
  }
  res.end();
  logger.info('tts', { uid, engine: 'fish', model, chars: text.length, firstByteMs: first, totalMs: Date.now() - t0 });
}

/** POST /stt with the recorded clip as the body (audio/mp4, up to ~60 s) → { text }. */
export const stt = onRequest({ secrets: [TTS_API_KEY], timeoutSeconds: 60, memory: '512MiB', cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const who = await verify(req);
  if ('error' in who) {
    res.status(who.error).json({ error: who.message });
    return;
  }
  const k = key();
  if (!k) {
    res.status(503).json({ error: 'Speech recognition is not configured.' });
    return;
  }
  const audio = req.rawBody;
  if (!audio?.length || audio.length > 4_000_000) {
    res.status(400).json({ error: 'Send one clip under 4 MB.' });
    return;
  }
  const t0 = Date.now();
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('file', new Blob([new Uint8Array(audio)], { type: req.get('content-type') || 'audio/mp4' }), 'clip.m4a');
  const upstream = await fetch(`${BASE()}/v1/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': k }, body: form });
  if (!upstream.ok) {
    logger.error('stt upstream failed', { status: upstream.status, detail: (await upstream.text().catch(() => '')).slice(0, 300) });
    res.status(502).json({ error: 'Transcription unavailable.' });
    return;
  }
  const out = (await upstream.json()) as { text?: unknown };
  const text = typeof out.text === 'string' ? out.text.trim() : '';
  logger.info('stt', { uid: who.uid, bytes: audio.length, ms: Date.now() - t0 });
  res.json({ text });
});
