// ElevenLabs speech, by model family:
//  - eleven_v4*: only served over the Text to Dialogue WebSocket, so open one per piece
//    of text and pass its audio chunks straight through.
//  - everything else (eleven_v3, flash): the HTTP streaming endpoint.
// No Firebase imports, so scripts/tts-check.mjs can run exactly this code locally.

export class TtsError extends Error {
  constructor(readonly status: number, readonly detail: string) {
    super(`ElevenLabs ${status}: ${detail}`);
  }
}

export interface SpeakOpts {
  key: string;
  model: string;
  voice: string;
  text: string;
  /** Receives MP3 audio as it's generated. */
  onAudio: (chunk: Buffer) => void;
  base?: string;
}

const FORMAT = 'mp3_44100_128';

export function speak(o: SpeakOpts): Promise<void> {
  return o.model.startsWith('eleven_v4') ? speakDialogue(o) : speakHttp(o);
}

async function speakHttp(o: SpeakOpts): Promise<void> {
  const base = o.base ?? 'https://api.elevenlabs.io';
  const res = await fetch(`${base}/v1/text-to-speech/${encodeURIComponent(o.voice)}/stream?output_format=${FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': o.key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    // Mid stability: varied, human delivery that still sounds like the same person.
    body: JSON.stringify({ text: o.text, model_id: o.model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (!res.ok || !res.body) throw new TtsError(res.status, (await res.text().catch(() => '')).slice(0, 300));
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) o.onAudio(Buffer.from(chunk));
}

function speakDialogue(o: SpeakOpts): Promise<void> {
  const base = (o.base ?? 'https://api.elevenlabs.io').replace(/^http/, 'ws');
  const url = `${base}/v1/text-to-dialogue/stream-input?model_id=${encodeURIComponent(o.model)}&output_format=${FORMAT}`;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // already closed
      }
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => done(new TtsError(504, 'No audio within 30 s')), 30_000);
    ws.onopen = () => {
      ws.send(JSON.stringify({ voices: [o.voice], xi_api_key: o.key }));
      ws.send(JSON.stringify({ inputs: [{ text: o.text, voice_id: o.voice, new_turn: true }] }));
      // Speak whatever is buffered, then end the stream.
      ws.send(JSON.stringify({ close_socket: true }));
    };
    ws.onmessage = ev => {
      let m: { audio?: string; is_final?: boolean; error?: unknown; message?: unknown };
      try {
        m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data as ArrayBuffer).toString());
      } catch {
        return;
      }
      if (m.error) return done(new TtsError(502, String(m.message ?? m.error).slice(0, 300)));
      if (m.audio) o.onAudio(Buffer.from(m.audio, 'base64'));
      if (m.is_final) done();
    };
    ws.onerror = () => done(new TtsError(502, 'WebSocket error'));
    ws.onclose = ev => done(ev.code === 1000 || ev.code === 1005 ? undefined : new TtsError(502, `Closed ${ev.code} ${ev.reason}`.slice(0, 300)));
  });
}
