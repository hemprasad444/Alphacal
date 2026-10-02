const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const pad = (n: number) => String(n).padStart(2, '0');

export function hhmm(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7;
}

export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d.getTime()) ? null : d;
}

export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Week number of the program, counting the week of `startedOn` as week 1. */
export function programWeek(startedOn: string, now: Date = new Date()): number {
  const start = parseIsoDate(startedOn) ?? now;
  const startMonday = new Date(start);
  startMonday.setDate(start.getDate() - weekdayIndex(start));
  return Math.max(1, Math.floor(daysBetween(startMonday, now) / 7) + 1);
}

/** e.g. "FRI 02 OCT". */
export function dayStamp(d: Date = new Date()): string {
  return `${DAYS[d.getDay()]} ${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

/** e.g. "MAR 22". */
export function monthDay(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())}`;
}

/** Minutes from now until today's `HH:MM`, negative once it has passed. */
export function minutesUntil(time: string, now: Date = new Date()): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m - (now.getHours() * 60 + now.getMinutes());
}

export function longDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * The current wall-clock time in an IANA time zone, as a Date whose local fields
 * (getHours, getDate, ...) read as that zone. For servers running in UTC.
 */
export function zonedNow(timeZone: string, now: Date = new Date()): Date {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
        .formatToParts(now)
        .map(p => [p.type, p.value]),
    );
    return new Date(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  } catch {
    return now;
  }
}
