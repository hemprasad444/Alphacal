// Premium voice through ElevenLabs: text → streamed speech, and speech → text.
// The key stays in Secret Manager. Until it's set (any value shorter than 20
// characters counts as unset), both endpoints answer 503 and the app falls back
// to the iPhone's own voice and keyboard dictation.
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { DEFAULT_VOICE, isVoice } from '@rei/shared';
import { verify } from './http';

/** Set with: firebase functions:secrets:set TTS_API_KEY (enter "none" until you have one). */
export const TTS_API_KEY = defineSecret('TTS_API_KEY');
/** REI's voice when the app doesn't pick one (from VOICES). */
const VOICE_ID = defineString('TTS_VOICE_ID', { default: DEFAULT_VOICE });

const BASE = () => process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';
const key = () => {
  const k = TTS_API_KEY.value();
  return k && k.length >= 20 ? k : null;
};

/**
 * GET /tts?t=<sentence>[&v=<voice id>]  → audio/mpeg, streamed as it's generated.
 * GET /tts?probe=1       → 204 when the premium voice is configured, 503 when not.
 * GET (not POST) so the phone's audio player can stream it directly with an auth header.
 */
export const tts = onRequest({ secrets: [TTS_API_KEY], timeoutSeconds: 60, concurrency: 40, cors: true }, async (req, res) => {
  const who = await verify(req);
  if ('error' in who) {
    res.status(who.error).json({ error: who.message });
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
  const text = typeof req.query.t === 'string' ? req.query.t.trim().slice(0, 600) : '';
  if (!text) {
    res.status(400).json({ error: 'Missing text.' });
    return;
  }
  const voice = isVoice(req.query.v) ? req.query.v : VOICE_ID.value();
  const t0 = Date.now();
  const upstream = await fetch(`${BASE()}/v1/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': k, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5' }),
  });
  if (!upstream.ok || !upstream.body) {
    logger.error('tts upstream failed', { status: upstream.status, voice, detail: (await upstream.text().catch(() => '')).slice(0, 300) });
    res.status(502).json({ error: 'Voice unavailable.' });
    return;
  }
  res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' });
  let first = 0;
  for await (const chunk of upstream.body) {
    if (!first) first = Date.now() - t0;
    res.write(chunk);
  }
  res.end();
  logger.info('tts', { uid: who.uid, chars: text.length, firstByteMs: first, totalMs: Date.now() - t0 });
});

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
