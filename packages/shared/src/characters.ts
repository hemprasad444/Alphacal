// Voice characters: who REI sounds like. Picked in onboarding (the VOICE chapter) and in Settings,
// separately from the theme. Live calls and spoken replies use the character's Fish Audio voice;
// a character without one yet falls back to REI's own voice, so nothing breaks while voices arrive.
import type { IconKey } from './icons';
import type { ThemeId } from './types';
import { isVoice } from './voices';

export interface VoiceCharacter {
  id: string;
  name: string;
  /** Where they're from. */
  series: string;
  /** One line in their spirit, shown on the card. */
  line: string;
  /**
   * What they say when picked, in their own voice. `{name}` becomes the user's name (see greeting).
   * Never start with the name: a voice swallows the first word of a clip, so lead in with "Hey,".
   */
  intro: string;
  /** The world (theme) that goes with them, suggested when they're picked in onboarding. */
  theme: ThemeId;
  icon: IconKey;
  /** Card colours. */
  acc: string;
  acc2: string;
  /** Fish Audio voice model id (`reference_id`); '' until the voice is added. */
  fish: string;
}

export const CHARACTERS: VoiceCharacter[] = [
  { id: 'rei', name: 'REI', series: 'Original', line: 'Zero excuses. Talk to me.', intro: 'Hey, {name}. I’m REI. Zero excuses, zero fluff. From today I’m in your corner, every single day.', theme: 'zero', icon: 'rei', acc: '#9BE7F2', acc2: '#3A6FF2', fish: '6870e7b6e1f54a0a9d6a4c29b7ac7105' },
  { id: 'naruto', name: 'Naruto', series: 'Naruto', line: 'I never go back on my word. Neither do you.', intro: 'Hey, {name}! Naruto Uzumaki here! I’m your training partner now, and I never go back on my word. Believe it!', theme: 'shinobi', icon: 'kunai', acc: '#FF7A1A', acc2: '#2B4CC9', fish: 'd34183dcf4a041f5a82aa3dd19644329' },
  { id: 'rem', name: 'Rem', series: 'Re:Zero', line: 'Let’s start from zero. Together.', intro: 'Welcome, {name}… it’s Rem. Let’s start from zero, together. Rem will be right beside you, every step of the way.', theme: 'zero', icon: 'look', acc: '#7EA8FF', acc2: '#C9D8FF', fish: '380f5c79a37a4ec39d3c0934ebc42222' },
  { id: 'tanjiro', name: 'Tanjiro', series: 'Demon Slayer', line: 'Breathe. Focus. One more rep.', intro: 'Hello, {name}! I’m Tanjiro Kamado. Breathe deep, stay focused, and give it everything you’ve got. We’ll get stronger together!', theme: 'slayer', icon: 'flame', acc: '#2FC4A5', acc2: '#E0303F', fish: '67e3beeea1fa4533bd1bedc412c8b448' },
  { id: 'gojo', name: 'Gojo', series: 'Jujutsu Kaisen', line: 'Throughout the gym and the kitchen, you alone are the honored one.', intro: 'Yo, {name}. Gojo here. Relax, you’re training with the strongest now. Try to keep up.', theme: 'cursed', icon: 'eye', acc: '#6E8BFF', acc2: '#9B3CF5', fish: '7a1fb7ae8aa04fe1a5f9f63bd247d43b' },
  { id: 'luffy', name: 'Luffy', series: 'One Piece', line: 'Eat meat. Train hard. Be king.', intro: 'Hey, {name}! I’m Luffy! [laughs] Eat lots of meat, train super hard, and let’s go on an adventure together!', theme: 'voyager', icon: 'strawhat', acc: '#F5C542', acc2: '#D7263D', fish: '5a989a2c6f284d87b83b9c2fcf0deeb1' },
  { id: 'allmight', name: 'All Might', series: 'My Hero Academia', line: 'Go beyond! Plus Ultra!', intro: 'Hey, {name}! Fear not, for I am here! From today, you and I go beyond. Plus Ultra!', theme: 'hero', icon: 'fist', acc: '#2FE08A', acc2: '#E8463B', fish: 'fed7d9345e0247ad9d93685e056fa29c' },
  { id: 'asta', name: 'Asta', series: 'Black Clover', line: 'Not giving up is my magic.', intro: 'Yo, {name}! I’m Asta! I don’t have any magic, so I train like crazy. Not giving up is my magic! Let’s go!', theme: 'hero', icon: 'sword', acc: '#E5484D', acc2: '#3DDC84', fish: '5e81a3b1051c4f6486b254b08dff2439' },
  { id: 'toji', name: 'Toji', series: 'Jujutsu Kaisen', line: 'No shortcuts. Just the work.', intro: 'So you’re {name}. Toji Fushiguro. No cursed energy, no shortcuts, just a body built the hard way. Show me what you’ve got.', theme: 'cursed', icon: 'strength', acc: '#C0C8D2', acc2: '#7C3AED', fish: 'b1904740d741498192b181b332eb93fc' },
];

export const DEFAULT_CHARACTER = 'rei';

export const characterOf = (id: unknown): VoiceCharacter => CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];

/** A name as it should be spoken: letters, spaces, hyphens and apostrophes, first letter capitalised. */
export function spokenName(name: string | null | undefined): string {
  const n = (name ?? '').normalize('NFC').replace(/[^\p{L}\p{M}' -]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24).trim();
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
}

/** The character's hello to this user, e.g. "Hey, Hem! Fear not, for I am here!…"; "friend" when there's no name. */
export function greeting(c: VoiceCharacter, name?: string | null): string {
  const n = spokenName(name);
  return c.intro.replace(/\{name\}/g, n || 'friend');
}

/**
 * Text as a voice should read it: "REI" is a name ("Rei"), not three letters, and units are words
 * ("160 kcal" was read as "160 k sale", "13 g" as "13 gs").
 */
export const forSpeech = (text: string) =>
  text
    .replace(/\bREI\b/g, 'Rei')
    .replace(/(\d)\s?kcal\b/gi, '$1 calories')
    .replace(/(\d)\s?kgs?\b/gi, '$1 kilos')
    .replace(/(\d)\s?g\b/g, '$1 grams');

/** True once the character's own voice has been added. */
export const hasVoice = (c: VoiceCharacter) => !!c.fish;

/** What the app asks the voice endpoint for: the character ("c:naruto") once it has a voice, else the ElevenLabs voice. */
export const speakVoice = (s: { character?: string; voice: string }) => {
  const c = characterOf(s.character);
  return hasVoice(c) ? `c:${c.id}` : s.voice;
};

/** A voice the app may ask the voice endpoint for: an ElevenLabs voice, or a character that has its own voice. */
export const isSpeakVoice = (v: unknown): v is string =>
  isVoice(v) || (typeof v === 'string' && v.startsWith('c:') && CHARACTERS.some(c => c.id === v.slice(2) && hasVoice(c)));
