// Premium voice: REI's replies spoken sentence by sentence as they stream in, and your
// speech transcribed by the backend. Falls back to the iPhone's voice (expo-speech) and
// keyboard dictation when the backend voice isn't configured or can't be reached.
import { DEFAULT_VOICE, isVoice, stripTags, takeSentences, VOICE_PREVIEW } from '@rei/shared';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { fetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { fb, functionsUrl } from './firebase';

let available: Promise<boolean> | null = null;
let lastReason = '';

/** Why premium voice is off, from the last check; '' when it's on or unchecked. */
export function voiceOffReason(): string {
  return lastReason;
}

const REASONS: Record<number, string> = {
  401: 'Sign-in expired. Sign out and back in.',
  403: 'This account isn’t activated as a tester yet.',
  503: 'The voice key isn’t set on the server (TTS_API_KEY).',
};

/** Whether the backend voice is set up (cached for the session). */
export function premiumVoice(): Promise<boolean> {
  available ??= (async () => {
    try {
      const token = await fb().auth.currentUser?.getIdToken();
      if (!token) {
        lastReason = 'Not signed in.';
        return false;
      }
      const res = await fetch(`${functionsUrl('tts')}?probe=1`, { headers: { Authorization: `Bearer ${token}` } });
      lastReason = res.status === 204 ? '' : (REASONS[res.status] ?? `Voice check failed (${res.status}).`);
      return res.status === 204;
    } catch {
      lastReason = 'Can’t reach the REI server.';
      return false;
    }
  })();
  const p = available;
  // Retry next time if it failed; keep a positive answer.
  void p.then(ok => {
    if (!ok) available = null;
  });
  return p;
}

/** Send a recorded clip to the backend and get the words back. */
export async function transcribe(uri: string): Promise<string> {
  const token = await fb().auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not signed in.');
  const body = new Uint8Array(await new File(uri).arrayBuffer());
  const res = await fetch(functionsUrl('stt'), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'audio/mp4' }, body });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}).`);
  return ((await res.json()) as { text?: string }).text?.trim() ?? '';
}

/** Times one voice turn, from tapping to send until REI is heard. Logs to the dev server console. */
export const stopwatch = {
  t0: 0,
  lag: null as ReturnType<typeof setInterval> | null,
  start() {
    this.t0 = Date.now();
    if (!__DEV__) return;
    // Logs any stretch where JavaScript was too busy to run: responses can't be picked up then.
    if (this.lag) clearInterval(this.lag);
    let last = Date.now();
    const tick = setInterval(() => {
      const now = Date.now();
      if (now - last > 250) console.log(`REI⏱ +${now - this.t0}ms JS was blocked for ${now - last - 50}ms`);
      last = now;
      if (now - this.t0 > 40_000) clearInterval(tick);
    }, 50);
    this.lag = tick;
  },
  mark(label: string) {
    if (__DEV__ && this.t0) console.log(`REI⏱ +${Date.now() - this.t0}ms ${label}`);
  },
};

/** Characters per spoken piece after the first: long enough for a natural flow. */
const CHUNK = 180;

let seq = 0;

function deleteQuietly(file: File) {
  try {
    file.delete();
  } catch {
    // already gone
  }
}

/** Wakes the voice servers while the user is still talking, so the reply doesn't wait on a cold start. */
export async function warmVoice() {
  try {
    const token = await fb().auth.currentUser?.getIdToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    void fetch(`${functionsUrl('tts')}?probe=1`, { headers }).catch(() => {});
    void fetch(functionsUrl('stt'), { headers }).catch(() => {});
  } catch {
    // best effort
  }
}

interface Piece {
  text: string;
  /** The downloaded clip; null for the iPhone's voice. Resolves to null if the download failed. */
  audio: Promise<File | null> | null;
}

/**
 * Speaks streamed text. Feed it with push(), then end(). The first sentence is sent
 * alone so REI starts talking fast; later sentences are grouped so the delivery flows
 * instead of restarting every sentence.
 *
 * Each piece is downloaded once, as soon as its text is ready, and played from disk.
 * (Streaming a URL into the iOS player made it fetch every clip twice, seconds apart.)
 * A piece that fails is skipped; its words are already on screen. The iPhone's voice is
 * only used when premium voice isn't available at all, so the two never mix.
 */
export class Speaker {
  private buffer = '';
  private pending = '';
  private sentAny = false;
  private queue: Piece[] = [];
  private playing = false;
  private stopped = false;
  private ended = false;
  private current: AudioPlayer | null = null;
  private files: File[] = [];

  constructor(
    private readonly premium: boolean,
    private readonly token: string | null,
    private readonly onIdle: () => void,
    private readonly voice: string,
  ) {}

  push(delta: string) {
    if (this.stopped) return;
    this.buffer += delta;
    const { sentences, rest } = takeSentences(this.buffer);
    this.buffer = rest;
    sentences.forEach(s => this.add(s));
  }

  private add(sentence: string) {
    if (!this.sentAny) {
      this.sentAny = true;
      // Start on the first clause of a long first sentence: a short clip is ready sooner.
      const cut = sentence.length > 50 ? sentence.indexOf(', ', 12) : -1;
      if (cut > 0 && cut < sentence.length - 10) {
        this.enqueue(sentence.slice(0, cut + 1));
        this.pending = sentence.slice(cut + 2);
      } else {
        this.enqueue(sentence);
      }
      return;
    }
    this.pending = this.pending ? `${this.pending} ${sentence}` : sentence;
    if (this.pending.length >= CHUNK || !this.playing) this.flush();
  }

  private flush() {
    if (!this.pending) return;
    const text = this.pending;
    this.pending = '';
    this.enqueue(text);
  }

  /** The reply is complete: speak whatever is left. */
  end() {
    if (this.stopped) return;
    const tail = this.buffer.trim();
    this.buffer = '';
    if (tail) this.pending = this.pending ? `${this.pending} ${tail}` : tail;
    this.flush();
    this.ended = true;
    if (!this.playing && !this.queue.length) this.onIdle();
  }

  stop() {
    this.stopped = true;
    this.pending = '';
    this.queue = [];
    this.current?.remove();
    this.current = null;
    Speech.stop();
    this.files.forEach(deleteQuietly);
    this.files = [];
  }

  private enqueue(text: string) {
    this.queue.push({ text, audio: this.premium && this.token ? this.download(text) : null });
    if (!this.playing) void this.next();
  }

  private async download(text: string): Promise<File | null> {
    const url = `${functionsUrl('tts')}?t=${encodeURIComponent(text)}&v=${encodeURIComponent(this.voice)}`;
    stopwatch.mark(`clip requested (${text.length} chars)`);
    try {
      const file = await File.downloadFileAsync(url, new File(Paths.cache, `rei-voice-${Date.now()}-${seq++}.mp3`), {
        headers: { Authorization: `Bearer ${this.token}` },
        idempotent: true,
      });
      if (this.stopped) {
        deleteQuietly(file);
        return null;
      }
      this.files.push(file);
      stopwatch.mark(`clip ready (${text.length} chars)`);
      return file;
    } catch (e) {
      console.warn('REI: voice clip failed', e);
      return null;
    }
  }

  private async next() {
    // A short last piece waits for company; once the queue runs dry, send it as is.
    if (!this.queue.length) this.flush();
    const item = this.queue.shift();
    if (!item || this.stopped) {
      this.playing = false;
      if (this.ended && !this.stopped) this.onIdle();
      return;
    }
    this.playing = true;
    if (!item.audio) {
      Speech.speak(stripTags(item.text), { rate: 1.02, pitch: 1.05, onDone: () => void this.next(), onStopped: () => void this.next(), onError: () => void this.next() });
      return;
    }
    const file = await item.audio;
    if (this.stopped) return;
    if (!file) {
      void this.next();
      return;
    }
    const player = createAudioPlayer({ uri: file.uri });
    this.current = player;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub.remove();
      player.remove();
      if (this.current === player) this.current = null;
      deleteQuietly(file);
      this.files = this.files.filter(f => f !== file);
      void this.next();
    };
    const sub = player.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) finish();
    });
    // Safety net in case the finish event never arrives.
    const timer = setTimeout(finish, 6000 + item.text.length * 120);
    player.play();
    stopwatch.mark(`playing (${item.text.length} chars)`);
  }
}

export async function newSpeaker(onIdle: () => void, voice: string): Promise<Speaker> {
  const premium = await premiumVoice();
  const token = premium ? (await fb().auth.currentUser?.getIdToken()) ?? null : null;
  return new Speaker(premium, token, onIdle, isVoice(voice) ? voice : DEFAULT_VOICE);
}

/** Says a short sample line in this voice; `premium` is false when the iPhone's voice was used instead. */
export async function previewVoice(voice: string, onDone: () => void): Promise<{ speaker: Speaker; premium: boolean }> {
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  const speaker = await newSpeaker(onDone, voice);
  speaker.push(VOICE_PREVIEW);
  speaker.end();
  return { speaker, premium: await premiumVoice() };
}
