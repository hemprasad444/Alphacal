// Premium voice: REI's replies spoken sentence by sentence as they stream in, and your
// speech transcribed by the backend. Falls back to the iPhone's voice (expo-speech) and
// keyboard dictation when the backend voice isn't configured or can't be reached.
import { takeSentences } from '@rei/shared';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { fb, functionsUrl } from './firebase';

let available: Promise<boolean> | null = null;

/** Whether the backend voice is set up (cached for the session). */
export function premiumVoice(): Promise<boolean> {
  available ??= (async () => {
    try {
      const token = await fb().auth.currentUser?.getIdToken();
      if (!token) return false;
      const res = await fetch(`${functionsUrl('tts')}?probe=1`, { headers: { Authorization: `Bearer ${token}` } });
      return res.status === 204;
    } catch {
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

/**
 * Speaks streamed text one sentence at a time. Feed it with push(), then end().
 * Each sentence's audio starts downloading as soon as the sentence is complete, so
 * playback runs back to back.
 */
export class Speaker {
  private buffer = '';
  private queue: { text: string; player: AudioPlayer | null }[] = [];
  private playing = false;
  private stopped = false;
  private ended = false;
  private premiumBroken = false;

  constructor(
    private readonly premium: boolean,
    private readonly token: string | null,
    private readonly onIdle: () => void,
  ) {}

  push(delta: string) {
    if (this.stopped) return;
    this.buffer += delta;
    const { sentences, rest } = takeSentences(this.buffer);
    this.buffer = rest;
    sentences.forEach(s => this.enqueue(s));
  }

  /** The reply is complete: speak whatever is left. */
  end() {
    if (this.stopped) return;
    if (this.buffer.trim()) this.enqueue(this.buffer.trim());
    this.buffer = '';
    this.ended = true;
    if (!this.playing && !this.queue.length) this.onIdle();
  }

  stop() {
    this.stopped = true;
    this.queue.forEach(q => q.player?.remove());
    this.queue = [];
    this.current?.remove();
    this.current = null;
    Speech.stop();
  }

  private current: AudioPlayer | null = null;

  private enqueue(text: string) {
    const player = this.premium && this.token && !this.premiumBroken
      ? createAudioPlayer({ uri: `${functionsUrl('tts')}?t=${encodeURIComponent(text)}`, headers: { Authorization: `Bearer ${this.token}` } })
      : null;
    this.queue.push({ text, player });
    if (!this.playing) this.next();
  }

  private next() {
    const item = this.queue.shift();
    if (!item || this.stopped) {
      this.playing = false;
      if (this.ended && !this.stopped) this.onIdle();
      return;
    }
    this.playing = true;
    if (!item.player) {
      Speech.speak(item.text, { rate: 1.02, pitch: 1.05, onDone: () => this.next(), onStopped: () => this.next(), onError: () => this.next() });
      return;
    }
    const player = item.player;
    this.current = player;
    let started = false;
    let settled = false;
    const finish = (failed: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(startTimer);
      clearTimeout(endTimer);
      sub.remove();
      player.remove();
      this.current = null;
      if (failed && !this.stopped) {
        // The premium voice didn't play: say this sentence and the rest with the iPhone's voice.
        this.premiumBroken = true;
        this.queue.forEach(q => {
          q.player?.remove();
          q.player = null;
        });
        Speech.speak(item.text, { rate: 1.02, pitch: 1.05, onDone: () => this.next(), onStopped: () => this.next(), onError: () => this.next() });
        return;
      }
      this.next();
    };
    const sub = player.addListener('playbackStatusUpdate', status => {
      if (status.playing) started = true;
      if (status.didJustFinish) finish(false);
    });
    // There's no error event: if audio hasn't started in 5 s, or runs far past its length, move on.
    const startTimer = setTimeout(() => !started && finish(true), 5000);
    const endTimer = setTimeout(() => finish(false), 8000 + item.text.length * 120);
    player.play();
  }
}

export async function newSpeaker(onIdle: () => void): Promise<Speaker> {
  const premium = await premiumVoice();
  const token = premium ? (await fb().auth.currentUser?.getIdToken()) ?? null : null;
  return new Speaker(premium, token, onIdle);
}
