// The shared HUD parts every screen is assembled from, drawn as manga panels.
//
// Every day is a chapter, you vs. your excuses. So: gauges fill toward full (never count down), a
// met target gets a stamp, the streak is a combo counter, XP is a power level, the weekly board is
// a ranking, sets are a move list, badges are trading cards and REI speaks through a jagged bubble.
//
// Rules of the system (tokens in lib/theme.ts, drawing parts in ink.tsx):
// - Every block is an ink panel: panel fill inside a paper stroke. Controls inside a panel use 2pt.
// - Hard offset shadows (SHADOW), no blur, no glow. Hero panels only: screentone, accent shadow, a tilt under 1°.
// - Ink, paper and pop (F.rival) never change; the world accent is the only variable colour.
// - One primary CutButton per screen.
//
// Every part takes an optional `accent`; it defaults to the current world's.
import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { ClipPath, Defs, G, Line, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { CutBox, cutPoints, CutShape, useSize } from './cut';
import { Icon, type IconKey } from './icons';
import { HalftoneDef, ReiAvatar, ShoutBubble, SkewTag, speedPath } from './ink';
import { Tap, Txt } from './ui';
import { cutDx, F, HIT, medalColors, mix, onColor, SHADOW, STROKE, warnColor } from '../lib/theme';
import { useStore } from '../state/store';

const useAccent = (accent?: string) => {
  const world = useStore(s => s.accent);
  return accent ?? world;
};

/** Medal colours in the current world: bronze and gold step aside where the accent would be mistaken for them. */
export const useTierColors = (accent?: string) => medalColors(useAccent(accent));
/** The "watch out" colour in the current world (never the accent, never the rival red). */
export const useWarn = (accent?: string) => warnColor(useAccent(accent));

const num = (n: number) => Math.round(n).toLocaleString('en-US');

/* ───────────────────────────── Section heading ───────────────────────────── */

/**
 * The heading above every block: a leaning accent tag, a heavy display title, an ink rule to the
 * edge and a small meta label on the right. `onMeta` makes the meta a link (in the accent).
 */
export function SectionHeader({ title, meta, onMeta, accent, style }: { title: string; meta?: string; onMeta?: () => void; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const metaText = meta ? <Txt face="label" size={12} color={onMeta ? acc : F.smoke} numberOfLines={1}>{meta}</Txt> : null;
  // The title keeps its room: a long meta gives way first.
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 }, style]}>
      <SkewTag color={acc} />
      <View accessibilityRole="header" style={{ flexShrink: 1 }}>
        <Txt face="display" exact size={16} lh={1.3} fit>{title.toUpperCase()}</Txt>
      </View>
      <View style={{ flex: 1, minWidth: 10, height: STROKE, backgroundColor: F.chalk }} />
      {meta ? <View style={{ flexShrink: 1000, minWidth: 0 }}>{onMeta ? <Tap onPress={onMeta} hitSlop={14} accessibilityLabel={meta}>{metaText}</Tap> : metaText}</View> : null}
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
  /** Bar height in points. */
  height?: number;
  /** Draw as this many cells instead of one bar (the big energy meter). */
  segments?: number;
  /** Fraction over the target (0.1 = 10% over): the far end is capped in chalk. */
  over?: number;
  /** Colour of the over cap (chalk unless said otherwise). */
  overColor?: string;
  accent?: string;
  /** Read by screen readers, e.g. "Protein 96 of 185 grams". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** How far the leading edge of a gauge fill leans (degrees). */
const GAUGE_LEAN = 20;

/**
 * Just the bar, as a power gauge: an ink track inside a paper stroke, screentone showing through
 * the empty part, filling from the left in the accent with a leaning leading edge.
 */
export function MeterBar({ pct, height = 16, segments, over = 0, overColor = F.chalk, accent, accessibilityLabel, style }: MeterBarProps) {
  const acc = useAccent(accent);
  const [size, onLayout] = useSize();
  const id = 'gauge' + useId().replace(/[^a-zA-Z0-9]/g, '');
  // A missing target (a division by zero upstream) draws as empty, never as full.
  if (!Number.isFinite(pct)) pct = 0;
  const p = useFill(Math.max(0, Math.min(1, pct)));
  const full = pct >= 1;
  // Never thinner than 10pt: the stroke needs room to leave a readable fill.
  const h = Math.max(10, height), b = h >= 14 ? STROKE : 2;
  let shapes: ReactNode = null;
  if (size && size.w > b * 2) {
    const w = size.w, iw = w - b * 2, ih = h - b * 2, lean = cutDx(ih, GAUGE_LEAN);
    const right = b + iw, clamp = (x: number) => Math.max(b, Math.min(right, x));
    const fw = iw * p, top = full ? right : clamp(b + fw + lean / 2), bottom = full ? right : clamp(b + fw - lean / 2);
    const cap = full && over > 0 ? Math.min(0.25, over) * iw : 0;
    const cells = segments && segments > 1 ? Array.from({ length: segments - 1 }, (_, i) => b + (iw * (i + 1)) / segments) : [];
    shapes = (
      <>
        <Defs>
          <HalftoneDef id={id} size={5} dot={0.9} opacity={0.3} />
        </Defs>
        <Rect x={b / 2} y={b / 2} width={w - b} height={h - b} fill={F.arena} stroke={cap > 0 ? overColor : F.chalk} strokeWidth={b} />
        {h >= 14 ? <Rect x={b} y={b} width={iw} height={ih} fill={`url(#${id})`} /> : null}
        {fw > 0.5 ? <Polygon points={`${b},${b} ${top},${b} ${bottom},${b + ih} ${b},${b + ih}`} fill={acc} /> : null}
        {cap > 0 ? <Rect x={right - cap} y={b} width={cap} height={ih} fill={overColor} /> : null}
        {cells.map(x => <Line key={x} x1={x + lean / 2} y1={b} x2={x - lean / 2} y2={b + ih} stroke={x < b + fw ? F.arena : F.rope} strokeWidth={2} />)}
      </>
    );
  }
  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, Math.max(0, pct)) * 100) }}
      style={[{ height: h, alignSelf: 'stretch' }, style]}
    >
      {size ? <Svg width={size.w} height={h}>{shapes}</Svg> : null}
    </View>
  );
}

export interface MeterProps {
  /** What is being filled: "ENERGY", "PROTEIN". Shown beside the target (md) or above the number (sm). */
  label?: string;
  value: number;
  target: number;
  /** "kcal", "g", "XP". */
  unit?: string;
  /** `lg`: the hero meter (big number, remaining on the right). `md`: a full-width row. `sm`: a narrow column (three macros side by side). */
  size?: 'lg' | 'md' | 'sm';
  /** Cells for the bar (lg only looks right with these, e.g. one per 100 kcal). */
  segments?: number;
  /**
   * What going past the target means. `win` (default): still a round won (protein, steps, XP).
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
 * The power gauge: number, target, how much is left "to full", and a bar that fills toward full.
 * At the target it locks full and gets a stamp; with `past="flag"` it shows the overflow instead.
 * Without a target (0 or missing) it shows the value alone over an empty bar and asks for one.
 */
export function Meter({ label, value, target, unit = '', size = 'md', segments, past = 'win', wonAt = 1, wonLabel = 'ROUND WON', accent, style }: MeterProps) {
  const acc = useAccent(accent);
  const unset = !(target > 0);
  // Compared as shown (whole numbers), so the stamp never disagrees with the digits.
  const v = Math.round(value), t = unset ? 0 : Math.round(target);
  const safe = Math.max(1, t), pct = unset ? 0 : value / safe;
  const won = !unset && v >= t * wonAt, overBy = unset ? 0 : Math.max(0, v - t), flagged = past === 'flag' && overBy > 0;
  const left = Math.max(0, t - v);
  const units = unit ? ` ${unit}` : '';
  const say = unset
    ? `${label ?? 'Progress'} ${num(value)}${units}, no target set`
    : `${label ?? 'Progress'} ${num(value)} of ${num(target)}${units}${flagged ? `, ${num(overBy)} over` : won ? `, ${wonLabel.toLowerCase()}` : ''}`;
  const over = flagged ? overBy / safe : 0;
  const targetText = unset ? unit : `/ ${num(target)}${units}`;

  if (size === 'sm') {
    return (
      <View style={[{ flex: 1, gap: 4 }, style]}>
        {label ? <Txt face="label" size={12} color={F.smoke} numberOfLines={1}>{label.toUpperCase()}</Txt> : null}
        <Txt face="display" exact size={18} lh={1.25} color={won && !flagged ? acc : F.chalk} fit>{num(value)}</Txt>
        <Txt face="label" size={12} color={F.smoke} numberOfLines={1}>{targetText || ' '}</Txt>
        <MeterBar pct={pct} over={over} height={10} accent={acc} accessibilityLabel={say} />
        {unset ? <Txt face="label" size={12} color={F.smoke} numberOfLines={1}>SET TARGET</Txt> : null}
      </View>
    );
  }

  const big = size === 'lg';
  const status = unset ? (
    <Txt face="label" size={12} color={F.smoke}>SET YOUR TARGET</Txt>
  ) : flagged ? (
    <Txt face="labelItalic" size={12} color={F.chalk}>{`${num(overBy)} OVER`}</Txt>
  ) : won ? (
    <RoundStamp label={wonLabel} size={big ? 'md' : 'sm'} />
  ) : big ? (
    <View style={{ alignItems: 'flex-end' }}>
      <Txt face="display" exact size={20} lh={1.2} color={acc}>{num(left)}</Txt>
      <Txt face="label" size={12} color={F.smoke}>TO FULL</Txt>
    </View>
  ) : (
    <Txt face="label" size={12} color={F.smoke}>{`${num(left)} TO FULL`}</Txt>
  );

  return (
    <View style={[{ gap: 8 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 }}>
          <Txt face="display" exact size={big ? 40 : 20} lh={big ? 1.15 : 1.25}>{num(value)}</Txt>
          <Txt face="label" size={big ? 14 : 12} color={F.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{label && !big ? `${targetText} ${label.toUpperCase()}`.trim() : targetText}</Txt>
        </View>
        <View style={{ paddingBottom: big ? 6 : 4 }}>{status}</View>
      </View>
      <MeterBar pct={pct} over={over} segments={segments} height={big ? 22 : 16} accent={acc} accessibilityLabel={say} />
    </View>
  );
}

/* ───────────────────────────── Stamps and tags ───────────────────────────── */

/**
 * A manga stamp. `chalk` (default) is the won stamp: paper, pressed on at a slight angle;
 * `accent` is a filled tag in the accent; `outline` is a quiet status ("ROUND OPEN"); `rival`
 * is the pop-red seal (the unlock's GET!).
 */
export function RoundStamp({ label = 'ROUND WON', tone = 'chalk', size = 'md', accent, style }: { label?: string; tone?: 'chalk' | 'accent' | 'outline' | 'rival'; size?: 'md' | 'sm'; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const fill = tone === 'chalk' ? F.chalk : tone === 'accent' ? acc : F.arena;
  const ink = tone === 'outline' ? F.chalk : tone === 'rival' ? F.rival : onColor(fill);
  const edge = tone === 'rival' ? F.rival : tone === 'chalk' ? F.arena : F.chalk;
  const h = size === 'md' ? 28 : 24;
  return (
    // Two rules, like a rubber stamp: the outer one in the stamp's colour, a thin one inside it.
    <View style={[{ alignSelf: 'flex-start', backgroundColor: fill, borderWidth: 2, borderColor: tone === 'chalk' ? F.chalk : edge, padding: tone === 'chalk' || tone === 'rival' ? 2 : 0, transform: tone === 'chalk' || tone === 'rival' ? [{ rotate: '-3deg' }] : undefined }, style]}>
      <View style={{ minHeight: h - 8, paddingHorizontal: 8, justifyContent: 'center', borderWidth: tone === 'chalk' || tone === 'rival' ? 1.5 : 0, borderColor: edge }}>
        {tone === 'outline' ? (
          <Txt face="labelItalic" size={12} lh={1.3} color={ink} numberOfLines={1}>{label.toUpperCase()}</Txt>
        ) : (
          <Txt face="display" exact size={size === 'md' ? 13 : 12} lh={1.3} color={ink} numberOfLines={1}>{label.toUpperCase()}</Txt>
        )}
      </View>
    </View>
  );
}

/* ───────────────────────────── Combo ───────────────────────────── */

/** The streak as a combo counter: speed lines, the count in the accent, a two-line label. A broken streak (0) goes quiet. */
export function Combo({ count, top = 'DAY', bottom = 'COMBO', size = 'md', accent, style }: { count: number; top?: string; bottom?: string; size?: 'md' | 'sm'; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const col = count > 0 ? acc : F.smoke, md = size === 'md';
  const word = (t: string) => (md
    ? <Txt face="display" exact size={13} lh={1.2} color={count > 0 ? F.chalk : F.smoke}>{t.toUpperCase()}</Txt>
    : <Txt face="labelItalic" size={12} lh={1.25} color={count > 0 ? F.chalk : F.smoke}>{t.toUpperCase()}</Txt>);
  return (
    <View accessible accessibilityLabel={`${count} ${top.toLowerCase()} ${bottom.toLowerCase()}`} style={[{ flexDirection: 'row', alignItems: 'center', gap: md ? 8 : 5 }, style]}>
      <Svg width={md ? 20 : 12} height={md ? 24 : 16} viewBox="0 0 20 24">
        <Rect x={6} y={4} width={14} height={3} fill={col} />
        <Rect x={0} y={10.5} width={20} height={3} fill={col} />
        <Rect x={9} y={17} width={11} height={3} fill={col} />
      </Svg>
      <Txt face="display" exact size={md ? 36 : 22} lh={1.2} color={col}>{num(count)}</Txt>
      <View>
        {word(top)}
        {word(bottom)}
      </View>
    </View>
  );
}

/* ───────────────────────────── Ladder ───────────────────────────── */

export interface LadderRow {
  /** Stable key (uid). Falls back to rank + name. */
  id?: string;
  rank: number;
  name: string;
  score: number;
  you?: boolean;
  /** A quiet second line under the name (their rank, say). */
  tag?: string;
  /** Rungs left out just above this one: drawn as a break in the ladder ("2 more"). */
  skipped?: number;
}

/** What it takes to climb: the gap from your row to the one above, or null when you lead or aren't on the board. */
export function ladderGap(rows: LadderRow[]): { gap: number; to: LadderRow } | null {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const i = sorted.findIndex(r => r.you);
  return i > 0 ? { gap: Math.max(1, sorted[i - 1].score - sorted[i].score + 1), to: sorted[i - 1] } : null;
}

/** The climb in words: what it takes to pass the next rung, and (from third place down) to take the top. Empty when you aren't on it. */
export function ladderLines(rows: LadderRow[], unit = 'XP'): { next: string; top?: string } | null {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const i = sorted.findIndex(r => r.you);
  if (i < 0) return null;
  if (i === 0) return { next: 'TOP OF THE LADDER. HOLD IT.' };
  const me = sorted[i], above = sorted[i - 1], first = sorted[0];
  const next = `${num(Math.max(1, above.score - me.score + 1))} ${unit} TO PASS ${above.name.toUpperCase()}`;
  return above === first && !me.skipped ? { next: `${num(Math.max(1, first.score - me.score + 1))} ${unit} TO THE TOP` } : { next, top: `${num(Math.max(1, first.score - me.score + 1))} ${unit} TO THE TOP` };
}

/**
 * The weekly board as a ranking: one ink row per place. Each row's length follows its score;
 * yours is filled in the accent on a hard paper shadow, and the line under the board says what
 * it takes to pass the next one.
 */
export function Ladder({ rows, unit = 'XP', showGap = true, accent, style }: { rows: LadderRow[]; unit?: string; showGap?: boolean; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const top = Math.max(1, ...sorted.map(r => r.score));
  const lines = ladderLines(sorted, unit);
  return (
    <View style={[{ gap: 8 }, style]}>
      {sorted.map(r => {
        const ink = r.you ? onColor(acc) : F.chalk;
        // Never shorter than 72%, so the name and score always fit.
        const width = `${Math.round((0.72 + 0.28 * (r.score / top)) * 100)}%` as const;
        return (
          <Fragment key={r.id ?? `${r.rank}-${r.name}`}>
          {r.skipped ? (
            <View accessible accessibilityLabel={`${r.skipped} more ${r.skipped === 1 ? 'place' : 'places'} in between`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 12, minHeight: 16 }}>
              {[0, 1, 2].map(k => <CutShape key={k} width={8} height={10} fill={F.rope} />)}
              <Txt face="label" size={12} color={F.smoke} style={{ marginLeft: 6 }}>{`${r.skipped} MORE`}</Txt>
            </View>
          ) : null}
          <View accessible accessibilityLabel={`Place ${r.rank}, ${r.name}${r.you ? ', you' : ''}${r.tag ? `, ${r.tag}` : ''}, ${num(r.score)} ${unit}`} style={{ width, paddingRight: SHADOW, paddingBottom: r.you ? SHADOW : 0 }}>
            <CutBox fill={r.you ? acc : F.canvas} stroke={r.you || r.rank === 1 ? F.chalk : F.smoke} strokeWidth={r.you ? STROKE : 2} shadow={r.you ? F.chalk : undefined} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'stretch' }}>
              <View style={{ width: 34, alignItems: 'center', justifyContent: 'center', borderRightWidth: 2, borderRightColor: r.you ? F.arena : r.rank === 1 ? F.chalk : F.smoke }}>
                <Txt face="display" exact size={15} lh={1.25} color={ink}>{r.rank}</Txt>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <View style={{ flexShrink: 1 }}>
                  <Txt size={15} w={r.you ? 700 : 600} lh={1.3} color={ink} numberOfLines={1}>{r.name}</Txt>
                  {r.tag ? <Txt face="label" size={12} lh={1.25} color={r.you ? ink : F.smoke} numberOfLines={1}>{r.tag.toUpperCase()}</Txt> : null}
                </View>
                {r.you ? <Txt face="labelItalic" size={12} color={ink}>YOU</Txt> : null}
                <View style={{ flex: 1 }} />
                <Txt face="display" exact size={14} lh={1.25} color={ink}>{num(r.score)}</Txt>
                <Txt face="labelItalic" size={12} color={r.you ? ink : F.smoke}>{unit}</Txt>
              </View>
            </CutBox>
          </View>
          </Fragment>
        );
      })}
      {showGap && lines ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, marginTop: 2 }}>
          <Txt face="labelItalic" size={12} color={acc}>{lines.next}</Txt>
          {lines.top ? <Txt face="label" size={12} color={F.smoke}>{lines.top}</Txt> : null}
        </View>
      ) : null}
    </View>
  );
}

/* ───────────────────────────── Move list ───────────────────────────── */

export interface MoveRowProps {
  /** Left column: a move number ("01") or a time ("08:10"). */
  index?: string | number;
  /** Width of the left column, so a list lines up (20 for numbers, 44 for times). */
  indexWidth?: number;
  name: string;
  /** Quiet note before the value ("P 39", "62.5 kg"). */
  detail?: string;
  /** Set pips: `done` of `total` filled. */
  pips?: { total: number; done: number };
  /** The loud number on the right ("4 × 8", "+380"). */
  value?: string;
  /** Finished: the row gets your corner tab and its value turns chalk. */
  done?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Extra content at the far right (a chevron, a button). */
  right?: ReactNode;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * One row of a move list or hit log: an ink strip in a paper stroke. A move number sits in a
 * paper cell at the left (the accent once done); a time is a quiet label. At least 46pt tall.
 */
export function MoveRow({ index, indexWidth = 22, name, detail, pips, value, done, onPress, onLongPress, right, accent, style }: MoveRowProps) {
  const acc = useAccent(accent);
  const numbered = typeof index === 'number' || (typeof index === 'string' && /^\d{1,2}$/.test(index));
  const cell = done ? acc : F.chalk;
  const body = (
    <View style={[{ minHeight: 46, backgroundColor: F.canvas, borderWidth: 2, borderColor: F.chalk, flexDirection: 'row', alignItems: 'stretch' }, style]}>
      {numbered ? (
        <View style={{ width: 30, backgroundColor: cell, alignItems: 'center', justifyContent: 'center' }}>
          <Txt face="display" exact size={14} lh={1.25} color={onColor(cell)}>{Number(index)}</Txt>
        </View>
      ) : done ? <View style={{ width: 5, backgroundColor: acc }} /> : null}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
        {index !== undefined && !numbered ? <Txt face="label" size={12} color={F.smoke} style={{ minWidth: indexWidth }}>{index}</Txt> : null}
        <Txt size={15} w={500} lh={1.3} numberOfLines={2} style={{ flex: 1 }}>{name}</Txt>
        {pips ? (
          <View accessible accessibilityLabel={`${pips.done} of ${pips.total} sets`} style={{ flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: Math.min(pips.total, 8) }, (_, i) => <CutShape key={i} width={9} height={12} fill={i < pips.done ? F.chalk : F.rope} />)}
          </View>
        ) : null}
        {detail ? <Txt face="label" size={12} color={F.smoke}>{detail}</Txt> : null}
        {value ? <Txt face="display" exact size={14} lh={1.25} color={done ? F.chalk : acc} align="right" style={{ minWidth: 40 }}>{value}</Txt> : null}
        {right}
      </View>
    </View>
  );
  return onPress || onLongPress ? <Tap onPress={onPress} onLongPress={onLongPress}>{body}</Tap> : body;
}

/* ───────────────────────────── Special move card ───────────────────────────── */

export type MoveTier = 'bronze' | 'silver' | 'gold';
/** The usual medal colours. On screen use `useTierColors()`: it keeps them apart from the world's accent. */
export const TIER_COLOR: Record<MoveTier, string> = { bronze: F.bronze, silver: F.silver, gold: F.gold };

/** Card height for a card `width` wide. */
export const cardHeight = (width: number) => Math.round(width * 1.36);

/**
 * The card itself, as a trading card: a rarity frame (bronze, silver or gold foil) around a
 * screentone window holding the badge's art, with one diagonal band of light across it, on a
 * hard paper shadow. Locked, it is a dashed outline around a silhouette.
 */
export function MoveCardArt({ tier, earned, icon, width = 48 }: { tier: MoveTier; earned: boolean; icon?: IconKey; width?: number }) {
  const tiers = useTierColors(), acc = useAccent();
  const id = 'card' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const h = cardHeight(width), sh = earned ? Math.max(2, Math.round(width / 18)) : 0;
  const line = width >= 96 ? 3 : 2, frame = Math.max(4, Math.round(width * 0.085));
  const big = width >= 96;
  const rays = useMemo(() => (big ? speedPath(22, width * 0.34, width * 1.2, 11) : ''), [big, width]);
  const foil = tiers[tier];
  return (
    <View style={{ width: width + sh, height: h + sh }}>
      <Svg width={width + sh} height={h + sh}>
        <Defs>
          <LinearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={mix('#FFFFFF', foil, 0.4)} />
            <Stop offset="0.42" stopColor={mix('#000000', foil, 0.18)} />
            <Stop offset="0.66" stopColor={mix('#FFFFFF', foil, 0.5)} />
            <Stop offset="1" stopColor={mix('#000000', foil, 0.38)} />
          </LinearGradient>
          <HalftoneDef id={`${id}t`} size={width >= 96 ? 7 : 5} dot={width >= 96 ? 1.1 : 0.8} opacity={0.22} />
          <ClipPath id={`${id}w`}>
            <Rect x={frame} y={frame} width={width - frame * 2} height={h - frame * 2} />
          </ClipPath>
        </Defs>
        {earned ? (
          <>
            <Rect x={sh} y={sh} width={width} height={h} fill={F.chalk} />
            <Rect x={line / 2} y={line / 2} width={width - line} height={h - line} fill={`url(#${id}f)`} stroke={F.arena} strokeWidth={line} />
            <Rect x={frame} y={frame} width={width - frame * 2} height={h - frame * 2} fill={F.canvas} stroke={F.arena} strokeWidth={line} />
            <G clipPath={`url(#${id}w)`}>
              {big ? <Path d={rays} fill={acc} fillOpacity={0.35} transform={`translate(${width / 2} ${h / 2})`} /> : null}
              <Rect x={frame} y={frame} width={width - frame * 2} height={h - frame * 2} fill={`url(#${id}t)`} />
              {/* holo: one diagonal band of light */}
              <Polygon points={`${width * 0.56},0 ${width * 0.8},0 ${width * 0.42},${h} ${width * 0.18},${h}`} fill="#FFFFFF" fillOpacity={0.2} />
            </G>
          </>
        ) : (
          <>
            <Rect x={1} y={1} width={width - 2} height={h - 2} fill={F.arena} stroke={F.smoke} strokeWidth={2} strokeDasharray="5 4" />
            <Rect x={frame} y={frame} width={width - frame * 2} height={h - frame * 2} fill={F.canvas} />
          </>
        )}
      </Svg>
      <View style={{ position: 'absolute', left: 0, top: 0, width, height: h, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={earned ? icon ?? 'badge' : icon ?? 'lock'} size={width * 0.5} color={earned ? acc : F.locked} tint={earned ? 0.25 : 1} strokeWidth={earned ? 2 : 1.9} />
      </View>
    </View>
  );
}

export interface SpecialMoveCardProps {
  title: string;
  /** Rarity: bronze, silver or gold. */
  tier: MoveTier;
  earned: boolean;
  icon?: IconKey;
  /** How it is done ("Log + 1 meal"). Shown in the `row` layout. */
  hint?: string;
  /** Locked progress, 0..1: a thin meter under the card. */
  progress?: number;
  /** `stack`: card over its name, for a grid. `row`: card beside name, rarity and hint. */
  layout?: 'stack' | 'row';
  /** Card width in points (height follows). */
  width?: number;
  onPress?: () => void;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A badge as a trading card: earned, its rarity frame, name and star; locked, a "???" silhouette
 * with the hint for how to earn it and how close it is.
 */
export function SpecialMoveCard({ title, tier, earned, icon, hint, progress, layout = 'stack', width = 48, onPress, accent, style }: SpecialMoveCardProps) {
  const acc = useAccent(accent);
  const tiers = useTierColors(accent), scale = useStore(s => s.settings.textSize);
  const say = `${title}, ${earned ? `${tier}, unlocked` : `locked${progress ? `, ${Math.round(progress * 100)} percent` : ''}`}${hint ? `. ${hint}` : ''}`;
  const rarity = <Txt face="labelItalic" size={12} lh={1.25} color={earned ? tiers[tier] : F.smoke} numberOfLines={1}>{earned ? `${tier.toUpperCase()} \u2605` : 'LOCKED'}</Txt>;
  const meter = !earned && progress !== undefined && progress > 0 ? <MeterBar pct={progress} height={10} accent={acc} style={{ alignSelf: undefined, width: layout === 'row' ? undefined : Math.max(width, 44) }} /> : null;
  const body = layout === 'row' ? (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HIT }, style]}>
      <MoveCardArt tier={tier} earned={earned} icon={icon} width={width} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt face="display" exact size={15} lh={1.3} color={earned ? F.chalk : F.smoke} numberOfLines={1}>{earned ? title.toUpperCase() : '???'}</Txt>
        {rarity}
        {hint ? <Txt face="label" size={12} color={F.smoke} numberOfLines={2}>{hint}</Txt> : null}
        {meter}
      </View>
    </View>
  ) : (
    <View style={[{ alignItems: 'center', gap: 4, minHeight: HIT }, style]}>
      <MoveCardArt tier={tier} earned={earned} icon={icon} width={width} />
      {/* Two title lines and the meter are always given their room, so a row of cards lines up whatever each one holds. */}
      <View style={{ minHeight: 2 * 12 * 1.25 * scale, marginTop: 2, justifyContent: 'center' }}>
        {earned
          ? <Txt face="labelItalic" size={12} lh={1.25} align="center" color={F.chalk} numberOfLines={2}>{title}</Txt>
          : <Txt face="display" exact size={13} lh={1.25} align="center" color={F.smoke}>???</Txt>}
      </View>
      {rarity}
      <View style={{ height: 10, width: Math.max(width, 44) }}>{meter}</View>
    </View>
  );
  return onPress ? <Tap onPress={onPress} accessibilityLabel={say}>{body}</Tap> : <View accessible accessibilityLabel={say}>{body}</View>;
}

/* ───────────────────────────── Versus ───────────────────────────── */

export interface VersusHeaderProps {
  /** You. */
  name: string;
  /** Under your name, in the accent ("ROOKIE · 220 XP"). */
  sub?: string;
  /** The rival. Always the excuses. */
  rivalName?: string;
  /** Under the rival's name, in pop red ("2 SESSIONS TAKEN THIS WEEK"). */
  rivalSub?: string;
  /** The plate on the split: a big line ("00:48") and a small one ("TO THE BELL · 18:30"). */
  plate?: { big: string; small?: string };
  height?: number;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The versus splash panel: your side on the left with speed lines in the accent, Excuses on the
 * right in pop red, split by a lightning bolt, all under screentone. No characters: the names,
 * the lines and the plate carry it. The hero of Today.
 */
export function VersusHeader({ name, sub, rivalName = 'EXCUSES', rivalSub, plate, height = 208, accent, style }: VersusHeaderProps) {
  const acc = useAccent(accent);
  const [size, onLayout] = useSize();
  const id = 'vs' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const rays = useMemo(() => speedPath(34, 70, 420, 5), []);
  const say = `${name} versus ${rivalName}.${sub ? ` ${sub}.` : ''}${rivalSub ? ` ${rivalSub}.` : ''}${plate ? ` ${plate.big}${plate.small ? `, ${plate.small}` : ''}.` : ''}`;
  let art: ReactNode = null;
  if (size) {
    const w = size.w - STROKE * 2, h = size.h - STROKE * 2;
    // The split runs from a little right of centre at the top to a little left at the bottom.
    const c = (t: number) => w * (0.56 - 0.12 * t);
    const bolt = [
      [c(0) + 7, 0], [c(0.52) + 1, h * 0.52], [c(0.52) + 14, h * 0.45], [c(1) + 5, h],
      [c(1) - 7, h], [c(0.48) - 1, h * 0.48], [c(0.48) - 14, h * 0.55], [c(0) - 5, 0],
    ].map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const left = `0,0 ${c(0)},0 ${c(1)},${h} 0,${h}`, right = `${c(0)},0 ${w},0 ${w},${h} ${c(1)},${h}`;
    art = (
      <Svg width={w} height={h}>
        <Defs>
          <HalftoneDef id={`${id}t`} opacity={0.16} />
          <ClipPath id={`${id}l`}><Polygon points={left} /></ClipPath>
          <ClipPath id={`${id}r`}><Polygon points={right} /></ClipPath>
        </Defs>
        <Polygon points={left} fill={F.cornerField} />
        <Polygon points={right} fill={F.rivalField} />
        <G clipPath={`url(#${id}l)`}><Path d={rays} fill={acc} fillOpacity={0.4} transform={`translate(${w * 0.5} ${h * 0.5})`} /></G>
        <G clipPath={`url(#${id}r)`}><Path d={rays} fill={F.rival} fillOpacity={0.4} transform={`translate(${w * 0.5} ${h * 0.5}) rotate(9)`} /></G>
        <Rect x={0} y={0} width={w} height={h} fill={`url(#${id}t)`} />
        <Polygon points={bolt} fill={F.chalk} stroke={F.arena} strokeWidth={2} strokeLinejoin="miter" />
      </Svg>
    );
  }
  return (
    <View onLayout={onLayout} accessible accessibilityRole="header" accessibilityLabel={say} style={[{ height, borderWidth: STROKE, borderColor: F.chalk, backgroundColor: F.cornerField, boxShadow: `${SHADOW}px ${SHADOW}px 0px ${acc}` }, style]}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden' }}>{art}</View>

      <View style={{ position: 'absolute', left: 10, right: 10, top: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
        <SkewTag text="You" color={acc} />
        <SkewTag text="Rival" color={F.rival} />
      </View>

      {plate ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 34, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ minWidth: 112, maxWidth: '72%', paddingHorizontal: 12, paddingVertical: 5, alignItems: 'center', backgroundColor: F.chalk, borderWidth: 2, borderColor: F.arena, boxShadow: `${SHADOW}px ${SHADOW}px 0px ${F.arena}` }}>
            <Txt face="display" exact size={24} lh={1.2} color={F.arena} fit>{plate.big}</Txt>
            {plate.small ? <Txt face="labelItalic" size={12} lh={1.3} color={F.arena} numberOfLines={1}>{plate.small}</Txt> : null}
          </View>
        </View>
      ) : null}

      <View style={{ position: 'absolute', left: 10, right: 10, bottom: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, alignItems: 'flex-start', gap: 2 }}>
          <Txt face="display" exact size={22} lh={1.2} fit>{name.toUpperCase()}</Txt>
          {sub ? <Txt face="labelItalic" size={12} lh={1.3} color={acc} fit style={{ backgroundColor: F.cornerField, paddingHorizontal: 3 }}>{sub}</Txt> : null}
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
          <Txt face="display" exact size={20} lh={1.2} fit>{rivalName.toUpperCase()}</Txt>
          {rivalSub ? <Txt face="labelItalic" size={12} lh={1.3} color={F.rival} align="right" numberOfLines={2} style={{ backgroundColor: F.rivalField, paddingHorizontal: 3 }}>{rivalSub}</Txt> : null}
        </View>
      </View>
    </View>
  );
}

/** A divider between blocks: an ink rule with three leaning marks (accent, paper, pop). */
export function Slash({ accent, style }: { accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const h = 14, dx = cutDx(h);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, height: h }, style]}>
      <View style={{ flex: 1, height: STROKE, backgroundColor: F.chalk }} />
      <Svg width={24 + dx} height={h}>
        <Polygon points={cutPoints(8 + dx, h)} fill={acc} />
        <Polygon points={cutPoints(8 + dx, h, { ox: 8 })} fill={F.chalk} />
        <Polygon points={cutPoints(8 + dx, h, { ox: 16 })} fill={F.rival} />
      </Svg>
      <View style={{ flex: 1, height: STROKE, backgroundColor: F.chalk }} />
    </View>
  );
}

/* ───────────────────────────── Primary action ───────────────────────────── */

export interface CutButtonProps {
  label: string;
  /** Quiet detail on the right ("45 MIN · 4 MOVES"). */
  meta?: string;
  icon?: IconKey;
  onPress: () => void;
  disabled?: boolean;
  /** `lg` 56pt (the screen's one primary action), `md` 48pt. */
  size?: 'lg' | 'md';
  /** `accent`: the accent on a paper shadow (primary). `chalk`: paper on an accent shadow. `quiet`: an outlined ink strip, the secondary action (same shape as QuietButton). */
  tone?: 'accent' | 'chalk' | 'quiet';
  accent?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** The arrow at the end of a primary action. */
function GoArrow({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** The primary action: a chunky inked button in the accent, in a paper stroke on a hard paper shadow. It sinks into the shadow when pressed. */
export function CutButton({ label, meta, icon, onPress, disabled, size = 'lg', tone = 'accent', accent, accessibilityLabel, style }: CutButtonProps) {
  const acc = useAccent(accent);
  const h = size === 'lg' ? 56 : 48;
  if (tone === 'quiet') {
    const ink = disabled ? F.smoke : F.chalk;
    return (
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (meta ? `${label}, ${meta}` : label)}
        accessibilityState={{ disabled: !!disabled }}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        style={({ pressed }) => [{ minHeight: h === 56 ? 52 : HIT, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 2, borderColor: disabled ? F.rope : F.smoke, backgroundColor: F.arena, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.7 : 1 }, style]}
      >
        {icon ? <Icon name={icon} size={18} color={ink} tint={0} strokeWidth={2} /> : null}
        <Txt face="labelItalic" size={14} color={ink} align="center" style={{ flexShrink: 1 }}>{label.toUpperCase()}</Txt>
        {meta ? <Txt face="label" size={12} color={F.smoke} numberOfLines={1}>{meta.toUpperCase()}</Txt> : null}
      </Pressable>
    );
  }
  const fill = disabled ? F.canvas2 : tone === 'accent' ? acc : F.chalk;
  const shadow = disabled ? undefined : tone === 'accent' ? F.chalk : acc;
  const ink = disabled ? F.smoke : onColor(fill);
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (meta ? `${label}, ${meta}` : label)}
      accessibilityState={{ disabled: !!disabled }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      style={[{ paddingRight: SHADOW, paddingBottom: SHADOW }, style]}
    >
      {({ pressed }) => (
        <CutBox
          fill={fill}
          stroke={disabled ? F.rope : tone === 'accent' ? F.chalk : F.arena}
          strokeWidth={STROKE}
          shadow={pressed ? undefined : shadow}
          style={{ minHeight: h, paddingHorizontal: 14, paddingVertical: 5, alignItems: 'center', justifyContent: 'center', transform: pressed && shadow ? [{ translateX: SHADOW - 1 }, { translateY: SHADOW - 1 }] : undefined }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
            {icon ? <Icon name={icon} size={20} color={ink} tint={0} strokeWidth={2.4} /> : null}
            <Txt face="display" exact size={size === 'lg' ? 16 : 15} lh={1.3} color={ink} fit style={{ flexShrink: 1 }}>{label.toUpperCase()}</Txt>
            {!icon && !disabled ? <GoArrow color={ink} /> : null}
          </View>
          {/* The detail sits under the label, so neither squeezes the other on a narrow phone. */}
          {meta ? <Txt face="labelItalic" size={12} lh={1.3} color={ink} numberOfLines={1}>{meta.toUpperCase()}</Txt> : null}
        </CutBox>
      )}
    </Pressable>
  );
}

/* ───────────────────────────── REI speaks ───────────────────────────── */

/** REI's avatar (see `ReiAvatar` in ink.tsx), in the world's accent. */
export function CoachPortrait({ size = 56, accent }: { size?: number; accent?: string }) {
  const acc = useAccent(accent);
  return <ReiAvatar size={size} accent={acc} />;
}

/** `after` lines this short are set as an ink chip under the shout ("Push day, 18:30."). */
const CHIP_MAX = 30;

/**
 * REI speaking: the avatar, then a jagged paper speech bubble on a hard shadow in the accent.
 * `shout` is the loud line (display type); `before` and `after` are plain sentences.
 * The paper bubble is REI's alone: nothing else in the app is paper-filled at this size.
 */
export function CoachShout({ before, shout, after, children, onPress, portrait = 52, accent, style }: { before?: string; shout?: string; after?: string; children?: ReactNode; onPress?: () => void; portrait?: number; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const body = (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingRight: SHADOW + 2, paddingBottom: SHADOW + 2 }, style]}>
      <View style={{ alignItems: 'center', gap: 2, paddingTop: 4 }}>
        <CoachPortrait size={portrait} accent={acc} />
        <Txt face="display" exact size={12} lh={1.3}>REI</Txt>
      </View>
      <ShoutBubble accent={acc} tailY={portrait / 2 + 4} style={{ flex: 1, gap: 6 }}>
        {before ? <Txt size={15} w={500} lh={1.4} color={F.arena}>{before}</Txt> : null}
        {shout ? <Txt face="display" exact size={16} lh={1.3} color={F.arena}>{shout}</Txt> : null}
        {after ? (
          after.length <= CHIP_MAX ? (
            <View style={{ alignSelf: 'flex-start', backgroundColor: F.arena, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Txt face="display" exact size={13} lh={1.3} color={F.chalk}>{after}</Txt>
            </View>
          ) : <Txt size={15} w={600} lh={1.4} color={F.arena}>{after}</Txt>
        ) : null}
        {children}
      </ShoutBubble>
    </View>
  );
  return onPress ? <Tap onPress={onPress} accessibilityHint="Talk to REI">{body}</Tap> : body;
}
