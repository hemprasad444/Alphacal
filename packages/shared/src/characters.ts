// Voice characters: who REI sounds like. Picked in onboarding (the VOICE chapter) and in Settings,
// separately from the theme. Live calls and spoken replies use the character's Fish Audio voice;
// a character without one yet falls back to REI's own voice, so nothing breaks while voices arrive.
import type { IconKey } from './icons';

export interface VoiceCharacter {
  id: string;
  name: string;
  /** Where they're from. */
  series: string;
  /** One line in their spirit, shown on the card. */
  line: string;
  icon: IconKey;
  /** Card colours. */
  acc: string;
  acc2: string;
  /** Fish Audio voice model id (`reference_id`); '' until the voice is added. */
  fish: string;
}

export const CHARACTERS: VoiceCharacter[] = [
  { id: 'rei', name: 'REI', series: 'Original', line: 'Zero excuses. Talk to me.', icon: 'rei', acc: '#9BE7F2', acc2: '#3A6FF2', fish: '' },
  { id: 'naruto', name: 'Naruto', series: 'Naruto', line: 'I never go back on my word. Neither do you.', icon: 'kunai', acc: '#FF7A1A', acc2: '#2B4CC9', fish: 'd34183dcf4a041f5a82aa3dd19644329' },
  { id: 'rem', name: 'Rem', series: 'Re:Zero', line: 'Let’s start from zero. Together.', icon: 'look', acc: '#7EA8FF', acc2: '#C9D8FF', fish: '' },
  { id: 'tanjiro', name: 'Tanjiro', series: 'Demon Slayer', line: 'Breathe. Focus. One more rep.', icon: 'strength', acc: '#2FC4A5', acc2: '#E0303F', fish: '' },
  { id: 'gojo', name: 'Gojo', series: 'Jujutsu Kaisen', line: 'Throughout the gym and the kitchen, you alone are the honored one.', icon: 'eye', acc: '#6E8BFF', acc2: '#9B3CF5', fish: '' },
  { id: 'luffy', name: 'Luffy', series: 'One Piece', line: 'Eat meat. Train hard. Be king.', icon: 'strawhat', acc: '#F5C542', acc2: '#D7263D', fish: '' },
  { id: 'allmight', name: 'All Might', series: 'My Hero Academia', line: 'Go beyond! Plus Ultra!', icon: 'fist', acc: '#2FE08A', acc2: '#E8463B', fish: '' },
];

export const DEFAULT_CHARACTER = 'rei';

export const characterOf = (id: unknown): VoiceCharacter => CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];

/** True once the character's own voice has been added. */
export const hasVoice = (c: VoiceCharacter) => !!c.fish;

/** What the app asks the voice endpoint for: the character ("c:naruto") once it has a voice, else the ElevenLabs voice. */
export const speakVoice = (s: { character?: string; voice: string }) => {
  const c = characterOf(s.character);
  return hasVoice(c) ? `c:${c.id}` : s.voice;
};
