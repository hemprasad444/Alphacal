import { distanceKcal, MOVEMENTS, movementKcal, movements, runMet, searchMovements } from '../activities';

describe('activities', () => {
  it('has unique ids and sane MET values', () => {
    expect(new Set(MOVEMENTS.map(m => m[0])).size).toBe(MOVEMENTS.length);
    expect(movements().every(m => m.met >= 1 && m.met <= 20)).toBe(true);
    expect(MOVEMENTS.length).toBeGreaterThan(60);
  });

  it('finds activities by name or other names', () => {
    expect(searchMovements('badminton')[0].id).toBe('badminton');
    expect(searchMovements('zumba')[0].id).toBe('aerobics');
    expect(searchMovements('bharatanatyam')[0].id).toBe('classical-dance');
    expect(searchMovements('cricket')[0].name).toBe('Cricket');
    expect(searchMovements('zzz')).toEqual([]);
  });

  it('works out calories from MET, weight and minutes', () => {
    expect(movementKcal(5.5, 80, 60)).toBe(440);
    expect(movementKcal(5.5, 80, 0)).toBe(0);
  });

  it('interpolates the running MET from pace, and estimates distance sessions', () => {
    expect(runMet(10, 3600)).toBeCloseTo(9.9, 0);
    expect(runMet(5, 3600)).toBe(6.0);
    expect(distanceKcal('run', 5, 1660, 80)).toBeGreaterThan(330);
    expect(distanceKcal('run', 5, 1660, 80)).toBeLessThan(420);
    expect(distanceKcal('walk', 3, 2400, 80)).toBe(160); // 4.5 km/h: MET 3.0 × 80 kg × 40 min
  });
});
