// A plain request to change a target, read without a model: "change my protein target to 160", "move
// my deadline to this coming Friday", "set bedtime to 10:30 pm". The fast chat model answers these in
// words without calling update_vow about one time in three ("Protein target set to 160 g." and nothing
// changes), so the request itself is parsed here and the change is made either way. Only an explicit
// instruction with its value counts; anything unclear is left to REI.
import { isoDate } from './time';
import type { ProfileKey } from './types';

const VERB = /\b(change|set|update|make|move|shift|push|bump|raise|increase|lower|drop|reduce|cut|switch|adjust|extend|bring|keep)\b/i;
/** A question or a "don't" is not an instruction. */
const NOT_AN_ORDER = /\?|^\s*(should|can|could|would|what|how|is|are|do|does|why|when|will)\b|\b(don'?t|do not|never|not sure|thinking (of|about)|maybe|might|what if)\b/i;

const POLITE = /^\s*(?:(?:hey|ok|okay|yo|rei|bro|please)[,! ]+)*(?:can|could|would|will) you (?:please )?/;

/** [field, how it's named, lowest and highest believable value, the units it may be given in (to a factor), decimals kept]. */
const NUMERIC: [ProfileKey, RegExp, number, number, Record<string, number>, number][] = [
  ['protein', /\bprotein\b/, 20, 400, { g: 1, gm: 1, gms: 1, gram: 1, grams: 1 }, 0],
  ['kcal', /\b(calories?|kcal|cals?)\b/, 800, 6000, { kcal: 1, cal: 1, cals: 1, calorie: 1, calories: 1, k: 1000 }, 0],
  ['carbs', /\bcarb(?:s|ohydrates?)?\b/, 20, 800, { g: 1, gm: 1, gms: 1, gram: 1, grams: 1 }, 0],
  ['fat', /(?<!body )\bfat\b(?! %| percent)/, 10, 300, { g: 1, gm: 1, gms: 1, gram: 1, grams: 1 }, 0],
  ['steps', /\bsteps?\b/, 1000, 50000, { steps: 1, step: 1, k: 1000 }, 0],
  ['sleep', /\bsleep\b(?! time)/, 3, 12, { h: 1, hr: 1, hrs: 1, hour: 1, hours: 1 }, 2],
  ['sessions', /\b(sessions?|workouts?|training days?)\b(?=[^.]*\b(week|weekly)\b)/, 1, 14, { sessions: 1, session: 1, days: 1, day: 1, times: 1, workouts: 1, a: 1, per: 1 }, 0],
  // Pounds are converted; any other unit (stone) is left to REI.
  ['targetWeight', /\b(target|goal) weight\b/, 30, 250, { kg: 1, kgs: 1, kilo: 1, kilos: 1, kilograms: 1, lb: 0.45359237, lbs: 0.45359237, pound: 0.45359237, pounds: 0.45359237 }, 1],
];

/**
 * A change said relative to now ("reduce protein by 20", "10% more", "double my steps") needs the current
 * value and a judgement about what was meant: none of the message is read by rule then.
 */
const RELATIVE = /\bby\s+\d|\d\s*%|\bpercent\b|\b(half|halve|double|twice|more|less|another|extra|fewer|higher|lower than)\b/;

/** Anything that reads as a unit of measure. */
const UNIT_WORDS = /^(g|gm|gms|grams?|kg|kgs|kilos?|kilograms?|lbs?|pounds?|stones?|st|oz|ounces?|kj|kcal|cals?|calories?|k|h|hr|hrs|hours?|min|mins|minutes?|m|km|miles?|steps?|%|percent)$/;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const day = (now: Date, plus: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + plus);

/**
 * The date a phrase names, from today: "2026-12-20", "20th December", "December 20", "tomorrow", "Friday",
 * "this coming Friday" (the first one after today), "next Friday" (the one in the week after this
 * Monday-to-Sunday week), "in 3 weeks", "end of the month". Null when it isn't one of these.
 */
export function dateFromWords(phrase: string, now: Date): string | null {
  const s = phrase.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    return isoDate(d) === iso[0] ? iso[0] : null;
  }
  const month = `(${MONTHS.join('|')}|${MONTHS.map(m => m.slice(0, 3)).join('|')})`;
  const dm = new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?(?: of)? ${month}\.?(?: (\d{4}))?\b`).exec(s) ?? null;
  const md = dm ? null : new RegExp(String.raw`\b${month}\.? (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?\b`).exec(s);
  if (dm || md) {
    const dd = +(dm ? dm[1] : md![2]), mName = dm ? dm[2] : md![1], yy = dm ? dm[3] : md![3];
    const mm = MONTHS.findIndex(m => m.startsWith(mName.slice(0, 3)));
    let d = new Date(yy ? +yy : now.getFullYear(), mm, dd);
    if (d.getMonth() !== mm || d.getDate() !== dd) return null;
    // No year said: the next time that date comes round.
    if (!yy && d < day(now, 0)) d = new Date(now.getFullYear() + 1, mm, dd);
    return isoDate(d);
  }
  if (/\bday after tomorrow\b/.test(s)) return isoDate(day(now, 2));
  if (/\btomorrow\b/.test(s)) return isoDate(day(now, 1));
  const rel = /\bin (\d{1,3}|a|an|one|two|three|four|six|eight) (day|week|month)s?\b/.exec(s);
  if (rel) {
    const n = /^\d/.test(rel[1]) ? +rel[1] : ({ a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, six: 6, eight: 8 } as Record<string, number>)[rel[1]];
    if (rel[2] === 'month') return isoDate(new Date(now.getFullYear(), now.getMonth() + n, now.getDate()));
    return isoDate(day(now, rel[2] === 'week' ? n * 7 : n));
  }
  if (/\bend of (the |this )?month\b/.test(s)) return isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  if (/\bend of (the |this )?year\b/.test(s)) return `${now.getFullYear()}-12-31`;
  const wd = new RegExp(String.raw`\b(?:(next|this coming|this|coming) )?(${WEEKDAYS.join('|')})\b`).exec(s);
  if (wd) {
    const ahead = (WEEKDAYS.indexOf(wd[2]) - now.getDay() + 7) % 7 || 7;
    // "next Friday" said on a Monday is the Friday of next week; said on a Sunday, the coming one already is.
    const daysToSunday = (7 - now.getDay()) % 7;
    return isoDate(day(now, wd[1] === 'next' && ahead <= daysToSunday ? ahead + 7 : ahead));
  }
  return null;
}

/** "10:30 pm", "11pm", "22:30", "06:30": a clock time that can only be read one way, as HH:MM. Else null. */
export function clockFromWords(phrase: string): string | null {
  const m = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?![\d:])/i.exec(phrase);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0, half = m[3]?.toLowerCase().replace(/\./g, '');
  if (min > 59 || h > 23) return null;
  if (half) {
    if (h < 1 || h > 12) return null;
    h = half === 'pm' ? (h % 12) + 12 : h % 12;
  } else if (!(m[2] && (h >= 13 || m[1].startsWith('0')))) {
    // "7" or "7:30" with no am/pm could be either: leave it to REI.
    return null;
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * The profile changes a message plainly orders, or null. `now` is their wall clock (for dates).
 * Numbers must sit in a believable range for the field, so "set protein to 2" does nothing here.
 */
export function vowFromText(message: string, now: Date): Partial<Record<ProfileKey, string>> | null {
  const raw = message.toLowerCase().replace(/[’']/g, "'");
  // "Can you change my protein to 160?" is an order said politely; "should I change it?" is a question.
  const polite = POLITE.test(raw);
  const s = polite ? raw.replace(POLITE, '').replace(/\?\s*$/, '') : raw;
  if (s.length > 200 || !VERB.test(s) || NOT_AN_ORDER.test(s)) return null;
  const out: Partial<Record<ProfileKey, string>> = {};
  if (RELATIVE.test(s)) return null;
  // What follows a field's name up to its own "to <value>": nothing in between but its describing words
  // (or "from 150"), so "reduce protein … and set carbs to 200" gives protein no value. A decimal point
  // between digits is part of the value, not the end of the sentence.
  const after = (field: RegExp): string | null => {
    const m = new RegExp(String.raw`${field.source}(?:(?!\b(?:and|but|then|or|by)\b)[^.;!\n,\d]){0,30}?(?:\bfrom\s+\d[\d.,]*\s*[a-z%]*\s+)?\bto\b\s*((?:[^.;!\n]|(?<=\d)\.(?=\d)){1,40})`, 'i').exec(s);
    return m ? m[m.length - 1] : null;
  };
  for (const [key, re, lo, hi, units, decimals] of NUMERIC) {
    const v = after(re);
    const n = v ? /^(?:about |around |just )?(\d+(?:\.\d+)?)(?![:\d])\s*([a-z%]+)?/.exec(v.replace(/(\d),(\d{3})/g, '$1$2')) : null;
    if (!n) continue;
    // A unit this field isn't given in ("150 stone", "8 minutes"): not ours to convert. Words that aren't units pass.
    const unit = n[2] ?? '';
    if (unit && !(unit in units) && UNIT_WORDS.test(unit)) continue;
    const scale = Math.pow(10, decimals);
    const value = Math.round(parseFloat(n[1]) * (units[unit] ?? 1) * scale) / scale;
    if (value >= lo && value <= hi) out[key] = String(value);
  }
  const deadline = after(/\bdeadline\b/);
  const date = deadline ? dateFromWords(deadline, now) : null;
  if (date && date >= isoDate(now)) out.deadline = date;
  const bed = after(/\b(bed ?time|sleep time)\b/);
  const bedAt = bed ? clockFromWords(bed) : null;
  if (bedAt) {
    out.bedtime = bedAt;
    delete out.sleep;
  }
  const train = after(/\b(training|workout|session|gym) time\b/);
  const trainAt = train ? clockFromWords(train) : null;
  if (trainAt) out.sessionTime = trainAt;
  return Object.keys(out).length ? out : null;
}
