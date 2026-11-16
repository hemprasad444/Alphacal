// The shared parts every screen is assembled from, drawn in Sumi & Hanko.
//
// The voice is calm: a target met gets a small red stamp ("Kept"), progress is a brush stroke,
// calories close an ensō, the streak is a plain count, the weekly board is a quiet list, badges
// are hanko seals and REI speaks in Mincho beside a red seal.
//
// Rules of the system (tokens in lib/theme.ts, drawing parts in ink.tsx):
// - One heading pattern: a small boxed tag, a Mincho heading, a tapered brush rule, a mono meta label.
// - Cards are sumi on night washi with a quiet line and a 6pt corner. No shadows, no glow, nothing leans.
// - Ground, rice paper and vermilion never change; the world accent is the second colour (data,
//   REI's verdict line, the active tab). Red belongs to REI and the seals.
// - One primary button per screen: rice paper with ink text.
//
// The file and its exports keep their old names so every screen switches through them.
// Every part takes an optional `accent`; it defaults to the current world's.
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { Icon, type IconKey } from './icons';
import { BrushBar, BrushRule, Enso, HankoSeal, InkDot, ReiSeal, SealTag, sealShapeFor } from './ink';
import { Tap, Txt } from './ui';
import { C, F, HIT, medalColors, RADIUS, soften, STROKE, warnColor } from '../lib/theme';
import { useStore } from '../state/store';

const useAccent = (accent?: string) => {
  const world = useStore(s => s.accent);
  return accent ?? world;
};

/** Tier colours in the current world: bronze and gold step aside where the accent would be mistaken for them. Text only: a seal is always red. */
export const useTierColors = (accent?: string) => medalColors(useAccent(accent));
/** The "watch out" colour in the current world (never the accent, never the seal red). */
export const useWarn = (accent?: string) => warnColor(useAccent(accent));

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Loud labels from the earlier systems, and the calm word each one becomes. */
const CALM: Record<string, string> = {
  'round won': 'Kept',
  'round open': 'Open',
  'round lost': 'Missed',
  'round over': 'Done',
  won: 'Kept',
  'k.o.': 'Done',
  ko: 'Done',
  'get!': 'Earned',
  'target hit': 'Kept',
  full: 'Kept',
};
/** A stamp or status label in the system's voice: known loud constants are swapped, capitals are quietened. */
export const calmLabel = (label: string): string => CALM[label.trim().toLowerCase()] ?? soften(label);

/* ───────────────────────────── Section heading ───────────────────────────── */

/**
 * The heading above every block, always the same four parts: a small boxed tag, the heading in
 * Mincho, a tapered brush rule to the edge and a mono meta label on the right. The tag shows
 * `tag` (a short word or number), an `icon`, or the heading's initial. `onMeta` makes the meta a link.
 */
export function SectionHeader({ title, meta, onMeta, tag, icon, accent, style }: { title: string; meta?: string; onMeta?: () => void; tag?: string; icon?: IconKey; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const shown = soften(title);
  const metaText = meta ? <Txt face="mono" size={12} lh={1.35} color={onMeta ? acc : F.smoke} numberOfLines={1}>{meta}</Txt> : null;
  // The title keeps its room: a long meta gives way first.
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 }, style]}>
      <SealTag text={tag ?? shown.trim().charAt(0).toUpperCase()} icon={icon} />
      <View accessibilityRole="header" style={{ flexShrink: 1 }}>
        <Txt face="heading" size={20} lh={1.4} fit>{shown}</Txt>
      </View>
      <BrushRule style={{ flex: 1, minWidth: 16 }} />
      {meta ? <View style={{ flexShrink: 1000, minWidth: 0, maxWidth: '50%' }}>{onMeta ? <Tap onPress={onMeta} hitSlop={14} accessibilityLabel={meta}>{metaText}</Tap> : metaText}</View> : null}
    </View>
  );
}

/* ───────────────────────────── Meter ───────────────────────────── */

/** Eases a number toward `to` (0.5 s), or jumps there when Reduce Motion is on. */
function useFill(to: number): number {
  const [v, setV] = useState(0);
  const at = useRef(0);
  useEffect(() => {
    let raf = 0, live = true;
    const from = at.current, start = Date.now();
    const land = (x: number) => {
      at.current = x;
      setV(x);
    };
    const tick = () => {
      if (!live) return;
      const t = Math.min(1, (Date.now() - start) / 500);
      land(from + (to - from) * (1 - (1 - t) ** 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => (reduce ? live && land(to) : tick())).catch(() => live && land(to));
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return v;
}

export interface MeterBarProps {
  /** How full, 0..1 (values above 1 are drawn as full). */
  pct: number;
  /** Asked height in points. The stroke is drawn 6 to 10pt thick. */
  height?: number;
  /** No longer drawn (cells). Kept so old callers compile. */
  segments?: number;
  /** Fraction over the target (0.1 = 10% over): the far end is marked in rice paper. */
  over?: number;
  /** Colour of the over mark (rice paper unless said otherwise). */
  overColor?: string;
  accent?: string;
  /** Read by screen readers, e.g. "Protein 96 of 185 grams". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Just the bar, as brush progress: a dry-brush track with a tapered stroke of the accent laid over it from the left. */
export function MeterBar({ pct, height = 16, over = 0, overColor = F.chalk, accent, accessibilityLabel, style }: MeterBarProps) {
  const acc = useAccent(accent);
  // A missing target (a division by zero upstream) draws as empty, never as full.
  if (!Number.isFinite(pct)) pct = 0;
  const p = useFill(Math.max(0, Math.min(1, pct)));
  const h = Math.max(6, Math.min(10, Math.round(height * 0.55)));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, Math.max(0, pct)) * 100) }}
      style={[{ height: h, alignSelf: 'stretch' }, style]}
    >
      <BrushBar pct={p} color={acc} height={h} cap={pct >= 1 && over > 0 ? Math.min(0.25, over) : 0} capColor={overColor} />
    </View>
  );
}

export interface MeterProps {
  /** What is being filled: "Energy", "Protein". */
  label?: string;
  value: number;
  target: number;
  /** "kcal", "g", "XP". */
  unit?: string;
  /** `lg`: the hero (an ensō with what is left beside it). `md`: a full-width row. `sm`: a narrow column (three macros side by side). */
  size?: 'lg' | 'md' | 'sm';
  /** No longer drawn. Kept so old callers compile. */
  segments?: number;
  /**
   * What going past the target means. `win` (default): still kept (protein, steps, XP).
   * `flag`: show how far over instead (energy when cutting).
   */
  past?: 'win' | 'flag';
  /** The share of the target that already counts as met (default 1). Energy passes ENERGY_WON_AT, so the stamp agrees with its status. */
  wonAt?: number;
  /** The stamp shown when the target is met. */
  wonLabel?: string;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Progress toward a target. `lg` is the ensō: the circle closes as you get there, with what is
 * left set large beside it. `md` and `sm` are a label, the numbers and a brush stroke. At the
 * target it gets a small red stamp; with `past="flag"` it says how far over instead. Without a
 * target (0 or missing) it shows the value alone and asks for one.
 */
export function Meter({ label, value, target, unit = '', size = 'md', past = 'win', wonAt = 1, wonLabel = 'Kept', accent, style }: MeterProps) {
  const acc = useAccent(accent), warn = useWarn(accent);
  const unset = !(target > 0);
  // Compared as shown (whole numbers), so the stamp never disagrees with the digits.
  const v = Math.round(value), t = unset ? 0 : Math.round(target);
  const safe = Math.max(1, t), pct = unset ? 0 : value / safe;
  const won = !unset && v >= t * wonAt, overBy = unset ? 0 : Math.max(0, v - t), flagged = past === 'flag' && overBy > 0;
  const left = Math.max(0, t - v);
  const units = unit ? ` ${unit}` : '';
  const stamp = calmLabel(wonLabel);
  const say = unset
    ? `${label ?? 'Progress'} ${num(value)}${units}, no target set`
    : `${label ?? 'Progress'} ${num(value)} of ${num(target)}${units}${flagged ? `, ${num(overBy)} over` : won ? `, ${stamp.toLowerCase()}` : ''}`;
  const over = flagged ? overBy / safe : 0;
  const ring = useFill(Math.max(0, Math.min(1, pct)));

  if (size === 'sm') {
    return (
      <View style={[{ flex: 1, gap: 4 }, style]}>
        {label ? <Txt face="label" size={12} color={F.smoke} numberOfLines={1}>{label}</Txt> : null}
        <Txt face="num" size={17} lh={1.2} color={won && !flagged ? acc : F.chalk} fit>
          {num(value)}
          <Txt face="mono" size={12} lh={1.2} color={F.smoke}>{unset ? units : ` / ${num(target)}${units}`}</Txt>
        </Txt>
        <MeterBar pct={pct} over={over} height={14} accent={acc} accessibilityLabel={say} />
        {unset ? <Txt face="label" size={12} color={F.smoke} numberOfLines={1}>Set a target</Txt> : null}
      </View>
    );
  }

  if (size === 'lg') {
    const big = unset ? null : flagged ? num(overBy) : num(left);
    return (
      <View accessible accessibilityLabel={say} style={[{ flexDirection: 'row', alignItems: 'center', gap: 24 }, style]}>
        <Enso pct={ring} size={132} color={acc}>
          <Txt face="num" size={26} lh={1.2} fit style={{ maxWidth: 88 }}>{num(value)}</Txt>
          <Txt face="label" w={400} size={12} color={F.smoke} numberOfLines={1}>{unset ? unit : `of ${num(target)}${units}`}</Txt>
        </Enso>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt face="label" size={12} color={F.smoke}>{unset ? (label ?? 'Today') : flagged ? 'Over today' : 'Left today'}</Txt>
          {big !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <View style={{ flexShrink: 1 }}><Txt face="display" exact size={44} lh={1.1} ls={-0.02} color={flagged ? warn : F.chalk} fit>{big}</Txt></View>
              {unit ? <Txt size={14} lh={1.4} color={F.smoke}>{unit}</Txt> : null}
            </View>
          ) : <Txt face="heading" size={20} lh={1.4}>No target yet</Txt>}
          <BrushRule style={{ marginVertical: 4 }} />
          {unset ? (
            <Txt size={13} lh={1.5} color={F.smoke}>Set your target to see what is left.</Txt>
          ) : flagged ? (
            <Txt size={13} lh={1.5} color={F.smoke}>{`Past ${num(target)}${units}. Ease off for the day.`}</Txt>
          ) : won ? (
            <RoundStamp label={stamp} size="sm" />
          ) : (
            <Txt size={13} lh={1.5} color={F.smoke}>{`${Math.round(Math.min(1, pct) * 100)}% of today's ${label ? label.toLowerCase() : 'target'}.`}</Txt>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[{ gap: 6 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          {label ? <Txt size={14} w={500} lh={1.4} numberOfLines={1}>{cap(soften(label))}</Txt> : null}
          {unset ? <Txt face="label" size={12} color={F.smoke}>Set a target</Txt> : flagged ? <Txt face="label" size={12} color={warn}>{`${num(overBy)} over`}</Txt> : won ? <RoundStamp label={stamp} size="sm" /> : null}
        </View>
        <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>
          <Txt face="num" size={14} lh={1.2} color={won && !flagged ? acc : F.chalk}>{num(value)}</Txt>
          {unset ? units : ` / ${num(target)}${units}`}
        </Txt>
      </View>
      <MeterBar pct={pct} over={over} height={16} accent={acc} accessibilityLabel={say} />
    </View>
  );
}

/* ───────────────────────────── Stamps and tags ───────────────────────────── */

/**
 * A small stamp. `chalk` (default) is the one that marks a target met: the outline of a red seal,
 * pressed on a few degrees off square ("Kept", "Done"). `accent` is a live status in the accent,
 * `outline` a quiet status, `rival` REI's red without the tilt. Known loud labels are swapped for
 * calm ones (see `calmLabel`).
 */
export function RoundStamp({ label = 'Kept', tone = 'chalk', size = 'md', accent, style }: { label?: string; tone?: 'chalk' | 'accent' | 'outline' | 'rival'; size?: 'md' | 'sm'; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const seal = tone === 'chalk';
  const ink = seal || tone === 'rival' ? F.rival : tone === 'accent' ? acc : F.smoke;
  const edge = seal || tone === 'rival' ? F.seal : tone === 'accent' ? acc : F.rule;
  const h = size === 'md' ? 28 : 24;
  return (
    <View style={[{ alignSelf: 'flex-start', minHeight: h, paddingHorizontal: seal ? 2 : 8, paddingVertical: seal ? 2 : 0, justifyContent: 'center', borderWidth: seal ? 1.5 : 1, borderColor: edge, borderRadius: RADIUS.tag, transform: seal ? [{ rotate: '-3deg' }] : undefined }, style]}>
      {seal ? (
        // Two rules, like the edge of a carved seal.
        <View style={{ flex: 1, minHeight: h - 7, paddingHorizontal: 7, justifyContent: 'center', borderWidth: 0.75, borderColor: edge, borderRadius: 1.5 }}>
          <Txt face="heading" size={size === 'md' ? 13 : 12} lh={1.25} color={ink} numberOfLines={1}>{calmLabel(label)}</Txt>
        </View>
      ) : (
        <Txt face="label" size={12} lh={1.3} color={ink} numberOfLines={1}>{calmLabel(label)}</Txt>
      )}
    </View>
  );
}

/* ───────────────────────────── Streak ───────────────────────────── */

/**
 * The streak, as a plain count: "3 days" over "Streak". `top` is what is counted ("Day",
 * "Week") and `bottom` what the run is called; the old "Combo" reads as "Streak". A broken
 * streak (0) goes quiet. `sm` sets it on one line.
 */
export function Combo({ count, top = 'Day', bottom = 'Streak', size = 'md', accent, style }: { count: number; top?: string; bottom?: string; size?: 'md' | 'sm'; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const unit = soften(top).toLowerCase(), name = /^combo$/i.test(bottom) ? 'Streak' : cap(soften(bottom).toLowerCase());
  const units = count === 1 ? unit : `${unit}s`;
  const live = count > 0;
  if (size === 'sm') {
    return (
      <View accessible accessibilityLabel={`${name}: ${count} ${units}`} style={[{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }, style]}>
        <Txt face="heading" size={17} lh={1.4} color={live ? acc : F.smoke}>{num(count)}</Txt>
        <Txt face="label" size={12} color={F.smoke} numberOfLines={1}>{`${unit} ${name.toLowerCase()}`}</Txt>
      </View>
    );
  }
  return (
    <View accessible accessibilityLabel={`${name}: ${count} ${units}`} style={[{ gap: 2 }, style]}>
      <Txt face="heading" size={20} lh={1.2} color={live ? F.chalk : F.smoke}>{`${num(count)} ${units}`}</Txt>
      <Txt face="label" w={400} size={12} color={F.smoke}>{name}</Txt>
    </View>
  );
}

/* ───────────────────────────── Weekly board ───────────────────────────── */

export interface LadderRow {
  /** Stable key (uid). Falls back to rank + name. */
  id?: string;
  rank: number;
  name: string;
  score: number;
  you?: boolean;
  /** A quiet second line under the name (their rank, say). */
  tag?: string;
  /** Places left out just above this one: drawn as a gap in the list ("2 more"). */
  skipped?: number;
}

/** What it takes to move up: the gap from your row to the one above, or null when you lead or aren't on the board. */
export function ladderGap(rows: LadderRow[]): { gap: number; to: LadderRow } | null {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const i = sorted.findIndex(r => r.you);
  return i > 0 ? { gap: Math.max(1, sorted[i - 1].score - sorted[i].score + 1), to: sorted[i - 1] } : null;
}

/** The climb in words: what it takes to pass the next place, and (from third place down) to take the top. Empty when you aren't on it. */
export function ladderLines(rows: LadderRow[], unit = 'XP'): { next: string; top?: string } | null {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const i = sorted.findIndex(r => r.you);
  if (i < 0) return null;
  if (i === 0) return { next: 'Top of the board. Hold it.' };
  const me = sorted[i], above = sorted[i - 1], first = sorted[0];
  const next = `${num(Math.max(1, above.score - me.score + 1))} ${unit} to pass ${above.name}`;
  return above === first && !me.skipped ? { next: `${num(Math.max(1, first.score - me.score + 1))} ${unit} to the top` } : { next, top: `${num(Math.max(1, first.score - me.score + 1))} ${unit} to the top` };
}

/**
 * The weekly board: a quiet list, one line per place, the place in Mincho and the score in mono.
 * Your row is a card with the accent down its left edge, and the line under the board says what
 * it takes to pass the next one.
 */
export function Ladder({ rows, unit = 'XP', showGap = true, accent, style }: { rows: LadderRow[]; unit?: string; showGap?: boolean; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const lines = ladderLines(sorted, unit);
  return (
    <View style={style}>
      {sorted.map((r, i) => {
        const next = sorted[i + 1];
        // A divider under every plain row, except beside your card (it has its own edge).
        const ruled = !r.you && !!next && !next.you && !next.skipped;
        return (
          <Fragment key={r.id ?? `${r.rank}-${r.name}`}>
            {r.skipped ? (
              <View accessible accessibilityLabel={`${r.skipped} more ${r.skipped === 1 ? 'place' : 'places'} in between`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, minHeight: 28 }}>
                <View style={{ width: 20, flexDirection: 'row', justifyContent: 'center', gap: 3 }}>
                  {[0, 1, 2].map(k => <InkDot key={k} size={4} color={F.rule} />)}
                </View>
                <Txt face="label" w={400} size={12} color={F.smoke}>{`${r.skipped} more`}</Txt>
              </View>
            ) : null}
            <View
              accessible
              accessibilityLabel={`Place ${r.rank}, ${r.name}${r.you ? ', you' : ''}${r.tag ? `, ${r.tag}` : ''}, ${num(r.score)} ${unit}`}
              style={[
                { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HIT, paddingHorizontal: 12, paddingVertical: 4 },
                r.you
                  ? { backgroundColor: F.canvas, borderWidth: STROKE, borderColor: F.line, borderLeftWidth: 3, borderLeftColor: acc, borderRadius: RADIUS.sm, paddingLeft: 10 }
                  : { borderBottomWidth: ruled ? 1 : 0, borderBottomColor: C.line },
              ]}
            >
              <Txt face={r.you ? 'display' : 'heading'} exact size={17} lh={1.2} color={r.you ? acc : F.smoke} align="center" style={{ width: 20 }}>{r.rank}</Txt>
              <View style={{ flex: 1 }}>
                <Txt size={15} w={r.you ? 700 : 500} lh={1.35} numberOfLines={1}>
                  {r.name}
                  {r.you && r.name.toLowerCase() !== 'you' ? <Txt size={12} w={500} lh={1.35} color={F.smoke}>{'  · you'}</Txt> : null}
                </Txt>
                {r.tag ? <Txt face="label" w={400} size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{r.tag}</Txt> : null}
              </View>
              <Txt face={r.you ? 'num' : 'mono'} size={14} lh={1.4} color={r.you ? acc : F.chalk}>{num(r.score)}</Txt>
            </View>
          </Fragment>
        );
      })}
      {showGap && lines ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, marginTop: 8, paddingHorizontal: 12 }}>
          <Txt face="label" size={12} color={acc}>{lines.next}</Txt>
          {lines.top ? <Txt face="label" w={400} size={12} color={F.smoke}>{lines.top}</Txt> : null}
        </View>
      ) : null}
    </View>
  );
}

/* ───────────────────────────── Rows ───────────────────────────── */

export interface MoveRowProps {
  /** Left column: a number ("01") or a time ("08:10"). */
  index?: string | number;
  /** Width of the left column, so a list lines up (20 for numbers, 44 for times). */
  indexWidth?: number;
  name: string;
  /** Quiet note before the value ("P 39", "62.5 kg"). */
  detail?: string;
  /** Set pips: `done` of `total` filled. */
  pips?: { total: number; done: number };
  /** The number on the right ("4 × 8", "380 kcal"). */
  value?: string;
  /** Finished: its number and value take the accent. */
  done?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Extra content at the far right (a chevron, a button). */
  right?: ReactNode;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * One row of a list (a lift, a meal): no box, just a hairline underneath. A number sits at the
 * left in Mincho; a time is set in mono before a dab of ink. At least 52pt tall.
 */
export function MoveRow({ index, indexWidth = 22, name, detail, pips, value, done, onPress, onLongPress, right, accent, style }: MoveRowProps) {
  const acc = useAccent(accent);
  const numbered = typeof index === 'number' || (typeof index === 'string' && /^\d{1,2}$/.test(index));
  const body = (
    <View style={[{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }, style]}>
      {numbered ? (
        <Txt face="heading" size={17} lh={1.2} color={done ? acc : F.smoke} align="center" style={{ minWidth: Math.max(20, indexWidth) }}>{Number(index)}</Txt>
      ) : index !== undefined ? (
        <>
          <Txt face="mono" size={13} lh={1.25} color={F.smoke} style={{ minWidth: indexWidth }}>{index}</Txt>
          <InkDot color={done ? acc : F.chalk} />
        </>
      ) : done ? <InkDot color={acc} /> : null}
      <Txt size={15} w={500} lh={1.35} numberOfLines={2} style={{ flex: 1 }}>{name}</Txt>
      {pips ? (
        <View accessible accessibilityLabel={`${pips.done} of ${pips.total} sets`} style={{ flexDirection: 'row', gap: 4 }}>
          {Array.from({ length: Math.min(pips.total, 8) }, (_, i) => <InkDot key={i} size={8} color={i < pips.done ? acc : F.rope} />)}
        </View>
      ) : null}
      {detail && value ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Txt face="num" size={14} lh={1.3} color={F.chalk}>{value}</Txt>
          <Txt face="mono" size={12} lh={1.35} color={done ? acc : F.smoke}>{detail}</Txt>
        </View>
      ) : (
        <>
          {detail ? <Txt face="mono" size={12} lh={1.35} color={F.smoke}>{detail}</Txt> : null}
          {value ? <Txt face="num" size={14} lh={1.3} color={done ? acc : F.chalk} align="right" style={{ minWidth: 40 }}>{value}</Txt> : null}
        </>
      )}
      {right}
    </View>
  );
  return onPress || onLongPress ? <Tap onPress={onPress} onLongPress={onLongPress}>{body}</Tap> : body;
}

/* ───────────────────────────── Seals (badges) ───────────────────────────── */

export type MoveTier = 'bronze' | 'silver' | 'gold';
/** The usual tier colours. On screen use `useTierColors()`: it keeps them apart from the world's accent. */
export const TIER_COLOR: Record<MoveTier, string> = { bronze: F.bronze, silver: F.silver, gold: F.gold };

/** Height of a badge's art for a given width. A seal is square. */
export const cardHeight = (width: number) => Math.round(width);

/**
 * A badge's art: a hanko seal. Earned, it is inked in vermilion with the badge's symbol carved
 * in white; locked, it is a faint embossed outline. Round or square by the symbol, always the
 * same for the same badge. The tier is said in words beside it, never by the seal's colour.
 */
export function MoveCardArt({ earned, icon, width = 48 }: { tier: MoveTier; earned: boolean; icon?: IconKey; width?: number }) {
  return <HankoSeal size={width} shape={sealShapeFor(icon)} earned={earned} icon={icon ?? (earned ? 'badge' : 'lock')} />;
}

export interface SpecialMoveCardProps {
  title: string;
  /** Tier: bronze, silver or gold. */
  tier: MoveTier;
  earned: boolean;
  icon?: IconKey;
  /** How it is earned ("Log one meal"). Shown in the `row` layout. */
  hint?: string;
  /** Locked progress, 0..1: a brush stroke under the seal. */
  progress?: number;
  /** `stack`: seal over its name, for a grid. `row`: seal beside name, tier and hint. */
  layout?: 'stack' | 'row';
  /** Seal size in points. */
  width?: number;
  onPress?: () => void;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A badge as a hanko seal: earned, the red seal with its name and tier; locked, the embossed
 * outline with its name, the hint for how to earn it and how close it is.
 */
export function SpecialMoveCard({ title, tier, earned, icon, hint, progress, layout = 'stack', width = 48, onPress, accent, style }: SpecialMoveCardProps) {
  const acc = useAccent(accent);
  const tiers = useTierColors(accent), scale = useStore(s => s.settings.textSize);
  const say = `${title}, ${earned ? `${tier}, earned` : `locked${progress ? `, ${Math.round(progress * 100)} percent` : ''}`}${hint ? `. ${hint}` : ''}`;
  const rarity = <Txt face="label" w={400} size={12} lh={1.35} color={earned ? tiers[tier] : F.smoke} numberOfLines={1}>{earned ? cap(tier) : 'Locked'}</Txt>;
  const meter = !earned && progress !== undefined && progress > 0 ? <MeterBar pct={progress} height={12} accent={acc} style={{ alignSelf: undefined, width: layout === 'row' ? undefined : Math.max(width, 44) }} /> : null;
  const body = layout === 'row' ? (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: HIT }, style]}>
      <MoveCardArt tier={tier} earned={earned} icon={icon} width={width} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt face="heading" size={17} lh={1.4} color={earned ? F.chalk : F.smoke} numberOfLines={1}>{title}</Txt>
        {rarity}
        {hint ? <Txt size={13} lh={1.4} color={F.smoke} numberOfLines={2}>{hint}</Txt> : null}
        {meter}
      </View>
    </View>
  ) : (
    <View style={[{ alignItems: 'center', gap: 6, minHeight: HIT }, style]}>
      <MoveCardArt tier={tier} earned={earned} icon={icon} width={width} />
      {/* Two title lines and the stroke are always given their room, so a row of seals lines up whatever each one holds. */}
      <View style={{ minHeight: 2 * 12 * 1.35 * scale, justifyContent: 'flex-start' }}>
        <Txt face="label" w={earned ? 700 : 500} size={12} lh={1.35} align="center" color={earned ? F.chalk : F.smoke} numberOfLines={2}>{title}</Txt>
      </View>
      <View style={{ height: 7, width: Math.max(width, 44) }}>{meter}</View>
    </View>
  );
  return onPress ? <Tap onPress={onPress} accessibilityLabel={say}>{body}</Tap> : <View accessible accessibilityLabel={say}>{body}</View>;
}

/* ───────────────────────────── Today's hero ───────────────────────────── */

export interface VersusHeaderProps {
  /** You. */
  name: string;
  /** Under your name, in the accent ("Rookie · 220 XP"). */
  sub?: string;
  /** No longer shown: there is no rival. Kept so old callers compile. */
  rivalName?: string;
  /** The honest note of the week, in ash ("2 sessions missed this week"). */
  rivalSub?: string;
  /** The key number: a big line ("18:30") and a small one ("Push day"). */
  plate?: { big: string; small?: string };
  /** No longer used: the card is as tall as its content. */
  height?: number;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The hero card: who you are and where you stand, then the one number that matters today set
 * large in the accent. It used to be a versus splash; there is no rival now, only the day.
 */
export function VersusHeader({ name, sub, rivalSub, plate, accent, style }: VersusHeaderProps) {
  const acc = useAccent(accent);
  const say = `${name}.${sub ? ` ${sub}.` : ''}${plate ? ` ${plate.big}${plate.small ? `, ${plate.small}` : ''}.` : ''}${rivalSub ? ` ${rivalSub}.` : ''}`;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={say} style={[{ backgroundColor: F.canvas, borderWidth: STROKE, borderColor: F.line, borderRadius: RADIUS.card, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 12 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flexShrink: 1 }}><Txt face="heading" size={20} lh={1.4} fit>{soften(name)}</Txt></View>
        <BrushRule style={{ flex: 1, minWidth: 16 }} />
        {sub ? <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{soften(sub)}</Txt> : null}
      </View>
      {plate ? (
        <View style={{ gap: 2 }}>
          <Txt face="display" exact size={34} lh={1.2} color={acc} fit>{plate.big}</Txt>
          {plate.small ? <Txt size={15} w={500} lh={1.35} color={F.chalk}>{soften(plate.small)}</Txt> : null}
        </View>
      ) : null}
      {rivalSub ? <Txt face="voice" size={15} lh={1.5} color={F.smoke}>{soften(rivalSub)}</Txt> : null}
    </View>
  );
}

/** A divider between blocks: one tapered brush rule. */
export function Slash({ style }: { accent?: string; style?: StyleProp<ViewStyle> }) {
  return <BrushRule long height={6} style={style} />;
}

/* ───────────────────────────── Buttons ───────────────────────────── */

export interface CutButtonProps {
  label: string;
  /** Quiet detail under the label ("45 min · 4 lifts"). */
  meta?: string;
  icon?: IconKey;
  onPress: () => void;
  disabled?: boolean;
  /** `lg` 52pt (the screen's one primary action), `md` 48pt. */
  size?: 'lg' | 'md';
  /** `accent` and `chalk`: the main button, rice paper with ink text. `quiet`: an outlined sumi button, the secondary action (same shape as QuietButton). */
  tone?: 'accent' | 'chalk' | 'quiet';
  /** Not used: the main button is rice paper in every world. */
  accent?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** The arrow at the end of a primary action. */
function GoArrow({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path d="M3 8H13M9 4L13 8L9 12" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** The main button: rice paper with ink text in Mincho, softly rounded. `quiet` is the outlined secondary. */
export function CutButton({ label, meta, icon, onPress, disabled, size = 'lg', tone = 'accent', accessibilityLabel, style }: CutButtonProps) {
  const quiet = tone === 'quiet';
  const h = size === 'lg' ? 52 : 48;
  const fill = quiet ? F.canvas : disabled ? F.canvas2 : F.chalk;
  const ink = disabled ? C.faint : quiet ? F.chalk : F.arena;
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (meta ? `${label}, ${meta}` : label)}
      accessibilityState={{ disabled: !!disabled }}
      onPress={() => {
        (quiet ? Haptics.selectionAsync() : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [{ minHeight: h, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: fill, borderWidth: 1, borderColor: quiet ? (disabled ? F.rope : F.rule) : fill, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 }, style]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
        {icon ? <Icon name={icon} size={18} color={ink} tint={0} strokeWidth={1.75} /> : null}
        <Txt face="heading" size={16} lh={1.25} color={ink} fit style={{ flexShrink: 1 }}>{label}</Txt>
        {!icon && !disabled && !quiet ? <GoArrow color={ink} /> : null}
      </View>
      {/* The detail sits under the label, so neither squeezes the other on a narrow phone. */}
      {meta ? <Txt face="mono" size={12} lh={1.35} color={quiet ? F.smoke : ink} numberOfLines={1}>{meta}</Txt> : null}
    </Pressable>
  );
}

/* ───────────────────────────── REI speaks ───────────────────────────── */

/** REI's seal (see `ReiSeal` in ink.tsx). `accent` is not used: the seal is always vermilion. */
export function CoachPortrait({ size = 36 }: { size?: number; accent?: string }) {
  return <ReiSeal size={size} />;
}

/** An `after` line this short is REI's verdict, set large in the accent ("Push day, 18:30."). */
const VERDICT_MAX = 30;

/**
 * REI speaking: a card that opens with REI's red seal and "REI says", then the words in Mincho.
 * `before` is the lead-in, `shout` the line that matters (a little heavier, never loud) and
 * `after` the verdict: short, it is set large in the accent. `meta` is a mono note on the right.
 */
export function CoachShout({ before, shout, after, meta, children, onPress, portrait = 36, accent, style }: { before?: string; shout?: string; after?: string; meta?: string; children?: ReactNode; onPress?: () => void; portrait?: number; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const seal = Math.min(36, Math.max(28, portrait));
  const body = (
    <View style={[{ backgroundColor: F.canvas, borderWidth: STROKE, borderColor: F.line, borderRadius: RADIUS.card, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 12 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 }}>
        <ReiSeal size={seal} />
        <Txt face="heading" size={16} lh={1.5} color={F.rival}>REI says</Txt>
        <BrushRule style={{ flex: 1, minWidth: 16 }} />
        {meta ? <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{meta}</Txt> : null}
      </View>
      {before ? <Txt face="voice" size={17} lh={1.53}>{before}</Txt> : null}
      {shout ? <Txt face="voice" w={before ? 600 : 500} size={17} lh={1.53}>{shout}</Txt> : null}
      {after ? (
        after.length <= VERDICT_MAX
          ? <Txt face="display" exact size={after.length <= 18 ? 28 : 24} lh={1.2} color={acc}>{after}</Txt>
          : <Txt face="voice" w={600} size={17} lh={1.53} color={acc}>{after}</Txt>
      ) : null}
      {children}
    </View>
  );
  return onPress ? <Tap onPress={onPress} accessibilityHint="Talk to REI">{body}</Tap> : body;
}
