import { C, contrast, cutDx, F, fontFamily, onColor, THEMES } from '../theme';

describe('Fight Night tokens', () => {
  it('keeps every text colour readable (4.5:1) on the arena and on canvas', () => {
    for (const key of ['text', 'textSoft', 'body', 'value', 'sub', 'muted', 'label', 'dim', 'faint', 'alert', 'warn'] as const) {
      expect(contrast(C[key], F.arena)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(C[key], F.canvas)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps every world readable: accent text on canvas, and ink on an accent button', () => {
    for (const t of THEMES) {
      expect(contrast(t.acc, F.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(onColor(t.acc), t.acc)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(F.arena, F.chalk)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(F.rival, F.rivalField)).toBeGreaterThanOrEqual(4.5);
  });

  it('has six worlds with their ids and accents unchanged, and plain English names', () => {
    expect(THEMES.map(t => [t.id, t.acc])).toEqual([['zero', '#9BE7F2'], ['shinobi', '#FF7A1A'], ['voyager', '#F5C542'], ['hero', '#2FE08A'], ['cursed', '#6E8BFF'], ['slayer', '#2FC4A5']]);
    for (const t of THEMES) expect(`${t.name} ${t.vibe} ${t.motto}`).toMatch(/^[\x20-\x7E·]+$/);
  });

  it('maps every face, old and new, onto the three loaded families', () => {
    expect(fontFamily('display')).toBe('Anton_400Regular');
    expect(fontFamily('label', 600)).toBe('BarlowCondensed_700Bold');
    expect(fontFamily('labelItalic', 400)).toBe('BarlowCondensed_600SemiBold_Italic');
    expect(fontFamily('mono', 400)).toBe('BarlowCondensed_600SemiBold');
    expect(fontFamily('Geist', 400)).toBe('Barlow_500Medium');
    expect(fontFamily('Zen Kaku', 600)).toBe('Barlow_700Bold');
    expect(fontFamily('jp', 300)).toBe('Barlow_400Regular');
  });

  it('cuts at 18 degrees', () => {
    expect(cutDx(100)).toBeCloseTo(32.49, 1);
  });
});
