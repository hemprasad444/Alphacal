import { systemRules } from '../rei';
import { DEFAULT_VOICE, isVoice, stripTags, VOICES, VOICE_TAGS } from '../voices';

describe('voices', () => {
  it('only accepts listed voices', () => {
    expect(isVoice(DEFAULT_VOICE)).toBe(true);
    expect(isVoice(VOICES[0].id)).toBe(true);
    expect(isVoice('21m00Tcm4TlvDq8ikWAM')).toBe(false);
    expect(isVoice(undefined)).toBe(false);
  });

  it('strips audio tags for the screen', () => {
    expect(stripTags('[firm] Two sessions missed. [sighs] Go now.')).toBe('Two sessions missed. Go now.');
    expect(stripTags('[laughs]   Fine.')).toBe('Fine.');
    expect(stripTags('No tags here, 82.5 kg.')).toBe('No tags here, 82.5 kg.');
  });

  it('hides a tag that is still arriving', () => {
    expect(stripTags('Good. [lau')).toBe('Good.');
    expect(stripTags('Good. [laughs] ok')).toBe('Good. ok');
  });

  it('asks for tags only in voice mode', () => {
    expect(systemRules({ tough: true, nudge: true, tools: true, voice: true })).toContain('[laughs]');
    expect(systemRules({ tough: true, nudge: true, tools: true })).not.toContain('[laughs]');
    expect(VOICE_TAGS.length).toBeGreaterThan(3);
  });

  it('talks like a bro only when chosen', () => {
    const bro = systemRules({ tough: true, bro: true, nudge: true, tools: true });
    expect(bro).toContain('If they swear, swear back');
    expect(bro).toContain('never comment negatively on their body');
    expect(systemRules({ tough: true, nudge: true, tools: true })).not.toContain('swear back');
  });
});
