/** ElevenLabs voices REI can speak with. `id` is the ElevenLabs voice id; the server only accepts ids on this list. */
export interface VoiceOption {
  id: string;
  name: string;
  note: string;
}

export const VOICES: VoiceOption[] = [
  { id: 'udXRFzRfXobdelcZJasr', name: 'REI', note: 'REI’s signature voice' },
];

export const DEFAULT_VOICE = VOICES[0].id;

export const isVoice = (id: unknown): id is string => typeof id === 'string' && VOICES.some(v => v.id === id);

export const VOICE_PREVIEW = 'This is how I sound. Now stop scrolling and go train.';

/** Delivery cues REI may put in voice replies; ElevenLabs performs them, the screen never shows them. */
export const VOICE_TAGS = ['firm', 'serious', 'encouraging', 'excited', 'warmly', 'laughs', 'chuckles', 'sighs', 'whispers', 'sarcastic'];

/** Removes [audio tags] from text meant to be read, including one still arriving at the end. */
export function stripTags(text: string): string {
  return text.replace(/\[\s*[a-z][a-z '?-]{0,24}\]\s*/gi, '').replace(/\[\s*[a-z '?-]{0,24}$/i, '').replace(/\s{2,}/g, ' ').trim();
}

/** Fast models write tags loosely ("[ warm? ]"); the voice needs "[warm]" or it reads them out. */
export function tidyTags(text: string): string {
  return text.replace(/\[\s*([a-z][a-z '-]{0,24}?)[\s?]*\]/gi, '[$1]').replace(/\[\s*[?\s]*\]\s*/g, '');
}
