import { ACCENT_EXTRAS, C, colorDistance, contrast, cutDx, DEFAULT_EMBLEM, displaySize, emblemFor, emblemIdFor, EMBLEMS, F, fontFamily, medalColors, onColor, THEMES, warnColor } from '../theme';

describe('Manga Panel tokens', () => {
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

  it('maps every face, old and new, onto the two loaded families', () => {
    expect(fontFamily('display')).toBe('DelaGothicOne_400Regular');
    expect(fontFamily('label', 600)).toBe('ZenMaruGothic_700Bold');
    expect(fontFamily('labelItalic', 400)).toBe('ZenMaruGothic_900Black');
    expect(fontFamily('mono', 400)).toBe('ZenMaruGothic_700Bold');
    expect(fontFamily('Geist', 400)).toBe('ZenMaruGothic_500Medium');
    expect(fontFamily('Zen Kaku', 600)).toBe('ZenMaruGothic_700Bold');
    expect(fontFamily('jp', 300)).toBe('ZenMaruGothic_500Medium');
    expect(fontFamily('body', 700)).toBe('ZenMaruGothic_900Black');
  });

  it('leans tags at 10 degrees and never sets display type under 13pt', () => {
    expect(cutDx(100)).toBeCloseTo(17.63, 1);
    expect(displaySize(64)).toBeCloseTo(37.1, 1);
    expect(displaySize(14)).toBe(13);
  });

  it('uses the Manga Panel palette', () => {
    expect([F.arena, F.canvas, F.chalk, F.smoke, F.rival, F.bronze, F.silver, F.gold]).toEqual(['#0E0E10', '#17171B', '#F4F1EA', '#B8B2A7', '#FF4D6D', '#C77B3F', '#C9D1D9', '#F2C230']);
  });

  it('gives every world two emblems and never names one after a series', () => {
    for (const t of THEMES) {
      expect(EMBLEMS[t.id]).toHaveLength(2);
      expect(EMBLEMS[t.id]!.map(e => e.id)).toContain(DEFAULT_EMBLEM[t.id]);
    }
    expect(Object.values(EMBLEMS).flat().map(e => e!.id).join(' ')).not.toMatch(/naruto/i);
  });

  it('resolves a saved emblem: default when unset, none when turned off, the replacement for an old id, the default for an unknown one', () => {
    expect(emblemIdFor('shinobi', {})).toBe('seed-blaze-1');
    expect(emblemIdFor('shinobi', undefined)).toBe('seed-blaze-1');
    expect(emblemIdFor('shinobi', { shinobi: null })).toBeNull();
    expect(emblemFor('shinobi', { shinobi: null })).toBeNull();
    expect(emblemIdFor('shinobi', { shinobi: 'seed-blaze-2' })).toBe('seed-blaze-2');
    expect(emblemIdFor('shinobi', { shinobi: 'seed-naruto-1' })).toBe('seed-blaze-1');
    expect(emblemIdFor('shinobi', { shinobi: 'seed-naruto-2' })).toBe('seed-blaze-2');
    expect(emblemIdFor('shinobi', { shinobi: 'something-gone' })).toBe('seed-blaze-1');
    expect(emblemIdFor('cursed', { cursed: 'seed-cursed-2', shinobi: null })).toBe('seed-cursed-2');
    expect(emblemFor('zero', { zero: 'seed-naruto-1' })?.id).toBe('seed-zero-1');
  });

  it('keeps medals and the warn colour apart from every accent, and readable', () => {
    for (const acc of [...THEMES.map(t => t.acc), ...ACCENT_EXTRAS]) {
      const m = medalColors(acc), warn = warnColor(acc);
      // Bronze beside Blaze orange and gold in the gold world were the collisions; both now stand clear.
      expect(colorDistance(m.bronze, acc)).toBeGreaterThanOrEqual(40);
      expect(colorDistance(m.gold, acc)).toBeGreaterThanOrEqual(30);
      expect(colorDistance(warn, acc)).toBeGreaterThanOrEqual(40);
      expect(colorDistance(warn, F.rival)).toBeGreaterThanOrEqual(40);
      for (const c of [m.bronze, m.silver, m.gold, warn]) expect(contrast(c, F.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(new Set([m.bronze, m.silver, m.gold]).size).toBe(3);
    }
    // Worlds that never collided keep the usual colours.
    expect(medalColors('#9BE7F2')).toEqual({ bronze: F.bronze, silver: F.silver, gold: F.gold });
    expect(warnColor('#9BE7F2')).toBe(C.warn);
    expect(warnColor('not-a-colour')).toBe(C.warn);
  });
});
