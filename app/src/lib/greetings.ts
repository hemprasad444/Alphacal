// Partner greetings: each character says hello with the user's name ("Hey, Hem! Fear not, for I am
// here!"). Made in the background as soon as the name is known and kept on the phone, so picking a
// partner plays at once. Without the backend voice (demo, offline) it falls back to the iPhone's voice.
import { CHARACTERS, characterOf, greeting, hasVoice, speakVoice } from '@rei/shared';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { fb, functionsUrl } from './firebase';
import { premiumVoice, previewVoice } from './voice';

/** In-flight and finished clips, by file name. A failed one is forgotten so the next tap retries. */
const clips = new Map<string, Promise<File | null>>();

/** Short stable hash, so a changed name or line makes a new file. */
const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

async function make(id: string, text: string, name: string): Promise<File | null> {
  // No file storage in the web preview: it streams the greeting instead.
  if (Platform.OS === 'web') return null;
  try {
    if (!(await premiumVoice())) return null;
    const file = new File(Paths.cache, name);
    if (file.exists && (file.size ?? 0) > 2000) return file;
    const token = await fb().auth.currentUser?.getIdToken();
    if (!token) return null;
    const url = `${functionsUrl('tts')}?t=${encodeURIComponent(text)}&v=${encodeURIComponent(`c:${id}`)}`;
    return await File.downloadFileAsync(url, file, { headers: { Authorization: `Bearer ${token}` }, idempotent: true });
  } catch (e) {
    console.warn('REI: greeting clip failed', id, e);
    return null;
  }
}

/** This character's greeting for this name, made once. */
export function greetingClip(id: string, userName: string): Promise<File | null> {
  const c = characterOf(id);
  if (!hasVoice(c)) return Promise.resolve(null);
  const text = greeting(c, userName);
  const name = `greet-${c.id}-${hash(text)}.mp3`;
  let job = clips.get(name);
  if (!job) {
    job = make(c.id, text, name).then(f => {
      if (!f) clips.delete(name);
      return f;
    });
    clips.set(name, job);
  }
  return job;
}

/** Make every character's greeting for this name, two at a time, in the background. */
export async function prefetchGreetings(userName: string): Promise<void> {
  const ids = CHARACTERS.filter(hasVoice).map(c => c.id);
  let next = 0;
  const worker = async () => {
    while (next < ids.length) await greetingClip(ids[next++], userName);
  };
  await Promise.all([worker(), worker()]);
}

/**
 * Plays the character's greeting: the ready clip if there is one, otherwise it is spoken as it
 * streams (or by the iPhone's voice). `onDone` runs when it finishes; `stop()` cuts it off.
 */
export async function playGreeting(id: string, userName: string, voice: string, onDone: () => void): Promise<{ stop: () => void; premium: boolean }> {
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  const file = await greetingClip(id, userName);
  if (!file) {
    const { speaker, premium } = await previewVoice(speakVoice({ character: id, voice }), onDone, greeting(characterOf(id), userName));
    return { stop: () => speaker.stop(), premium };
  }
  const player = createAudioPlayer({ uri: file.uri });
  let ended = false;
  const end = (notify: boolean) => {
    if (ended) return;
    ended = true;
    sub.remove();
    player.remove();
    if (notify) onDone();
  };
  const sub = player.addListener('playbackStatusUpdate', s => {
    if (s.didJustFinish) end(true);
  });
  player.play();
  return { stop: () => end(false), premium: true };
}
