import { downsample } from '../chart';

describe('downsample', () => {
  it('keeps short series whole', () => {
    expect(downsample([3, 1, 2], 10)).toEqual([0, 1, 2]);
  });

  it('thins long series, keeping the ends and the extremes, in order', () => {
    const values = Array.from({ length: 1000 }, (_, i) => Math.sin(i / 30) * 10 + (i === 500 ? 50 : 0));
    const idx = downsample(values, 120);
    expect(idx.length).toBeLessThanOrEqual(120);
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(999);
    expect(idx).toContain(500);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(new Set(idx).size).toBe(idx.length);
  });
});
