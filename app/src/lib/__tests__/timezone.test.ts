import { deviceTimeZone, zoneToStore } from '../timezone';

describe('zoneToStore', () => {
  it('writes the device zone when the record has another one, or none', () => {
    expect(zoneToStore('Asia/Kolkata', 'Europe/London')).toBe('Europe/London');
    expect(zoneToStore(undefined, 'Europe/London')).toBe('Europe/London');
  });
  it('writes nothing when they match or the device zone is unknown', () => {
    expect(zoneToStore('Europe/London', 'Europe/London')).toBeNull();
    expect(zoneToStore('Asia/Kolkata', null)).toBeNull();
  });
});

describe('deviceTimeZone', () => {
  it('names a zone Intl accepts', () => {
    const tz = deviceTimeZone();
    expect(typeof tz).toBe('string');
    expect(() => new Intl.DateTimeFormat('en-US', { timeZone: tz! })).not.toThrow();
  });
  it('is null when the platform reports no usable zone', () => {
    const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((() => ({ resolvedOptions: () => ({ timeZone: undefined }) })) as never);
    expect(deviceTimeZone()).toBeNull();
    spy.mockRestore();
  });
});
