// The server files chat and photo meals under the day in users.timezone; the phone files its own
// under the device's day. Keeping the stored zone on the device's means both use the same day.

/** The device's IANA zone ("Europe/London"), or null when the platform can't say or names one Intl can't use. */
export function deviceTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof tz !== 'string' || !tz) return null;
    // Throws for a name the server's Intl wouldn't accept either.
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** The zone to write to the user's record, or null when it already matches the device (or the device's is unknown). */
export function zoneToStore(stored: unknown, device: string | null): string | null {
  if (!device) return null;
  return stored === device ? null : device;
}
