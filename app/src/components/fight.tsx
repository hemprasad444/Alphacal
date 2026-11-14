// Fight Night primitives: the shared HUD parts every screen is assembled from.
//
// Every day is a match, you vs. your excuses. So: meters fill toward full (never count down), a
// met target is a ROUND WON, the streak is a combo, the weekly board is a ladder, sets are a move
// list, badges are special-move cards and REI shouts from your corner.
//
// Rules of the system (tokens in lib/theme.ts):
// - Flat colour only. One cut angle (CUT) for every slanted edge; display type leans (LEAN).
// - Hard offset shadows (SHADOW), no blur, no glow.
// - Two lights: your corner is the world accent; the far corner (F.rival) is only ever "Excuses".
// - One CutButton per screen.
//
// Every part takes an optional `accent`; it defaults to the current world's.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Polygon, Rect } from 'react-native-svg';
import { CutBox, cutPoints, CutShape, useSize } from './cut';
import { Icon, type IconKey } from './icons';
import { Tap, Txt } from './ui';
import { cutDx, F, hard, HIT, onColor, SHADOW } from '../lib/theme';
import { useStore } from '../state/store';

const useAccent = (accent?: string) => {
  const world = useStore(s => s.accent);
  return accent ?? world;
};

const num = (n: number) => Math.round(n).toLocaleString('en-US');

/* ───────────────────────────── Section heading ───────────────────────────── */

/**
 * The heading above every block: cut tab, leaning label, a rope to the edge, quiet meta on the right.
 * `onMeta` makes the meta a link (in your corner colour).
 */
export function SectionHeader({ title, meta, onMeta, accent, style }: { title: string; meta?: string; onMeta?: () => void; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const metaText = meta ? <Txt face="label" w={400} size={12} ls={0.12} color={onMeta ? acc : F.smoke}>{meta.toUpperCase()}</Txt> : null;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 20 }, style]}>
      <CutShape width={18} height={12} fill={acc} />
      <View accessibilityRole="header" style={{ flexShrink: 1 }}>
        <Txt face="labelItalic" w={600} size={14} ls={0.14} numberOfLines={1}>{title.toUpperCase()}</Txt>
      </View>
      <View style={{ flex: 1, minWidth: 12, height: 2, backgroundColor: F.rope }} />
      {onMeta ? <Tap onPress={onMeta} hitSlop={14} accessibilityLabel={meta}>{metaText}</Tap> : metaText}
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
  accent?: string;
  /** Read by screen readers, e.g. "Protein 96 of 185 grams". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Just the bar: a cut track that fills from the left in your corner colour, with a chalk leading edge. */
export function MeterBar({ pct, height = 16, segments, over = 0, accent, accessibilityLabel, style }: MeterBarProps) {
  const acc = useAccent(accent);
  const [size, onLayout] = useSize();
  const p = useFill(Math.max(0, Math.min(1, pct)));
  const full = pct >= 1;
  const border = height >= 14 ? 2 : 1;
  let shapes: ReactNode = null;
  if (size) {
    const w = size.w, h = height, dx = cutDx(h);
    if (segments && segments > 1) {
      const gap = 3, cw = (w - dx - gap * (segments - 1)) / segments, lit = p * segments;
      shapes = Array.from({ length: segments }, (_, i) => {
        const x = i * (cw + gap), f = Math.max(0, Math.min(1, lit - i));
        return (
          <Polygon key={i} points={cutPoints(cw + dx, h, { ox: x })} fill={f >= 1 ? acc : F.canvas} stroke={f >= 1 ? undefined : F.rope} strokeWidth={f >= 1 ? 0 : 1} />
        );
      }).concat(
        // The cell being filled right now.
        lit % 1 > 0.02 && lit < segments ? [<Polygon key="part" points={cutPoints(cw * (lit % 1) + dx, h, { ox: Math.floor(lit) * (cw + gap) })} fill={acc} />] : [],
      );
    } else {
      const inner = w - dx, fillW = inner * p, tick = Math.min(border + 1, 4);
      const cap = full && over > 0 ? Math.min(0.25, over) * inner : 0;
      shapes = (
        <>
          <Polygon points={cutPoints(w, h, { inset: border / 2 })} fill={full ? acc : F.canvas} stroke={full ? F.chalk : F.rope} strokeWidth={border} />
          {!full && fillW > 0.5 ? <Polygon points={cutPoints(fillW + dx - border, h, { inset: border })} fill={acc} /> : null}
          {!full && fillW > 0.5 ? <Polygon points={cutPoints(tick + cutDx(h - border * 2), h - border * 2, { ox: fillW - tick / 2, oy: border })} fill={F.chalk} /> : null}
          {cap > 0 ? <Polygon points={cutPoints(cap + dx, h, { ox: inner - cap, inset: border })} fill={F.chalk} /> : null}
        </>
      );
    }
  }
  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, Math.max(0, pct)) * 100) }}
      style={[{ height, alignSelf: 'stretch' }, style]}
    >
      {size ? <Svg width={size.w} height={height}>{shapes}</Svg> : null}
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
  /** The stamp shown when the target is met. */
  wonLabel?: string;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The energy meter: number, target, how much is left "to full", and a bar that fills toward full.
 * At the target it locks full and stamps ROUND WON; with `past="flag"` it shows the overflow instead.
 */
export function Meter({ label, value, target, unit = '', size = 'md', segments, past = 'win', wonLabel = 'ROUND WON', accent, style }: MeterProps) {
  const acc = useAccent(accent);
  const safe = Math.max(1, target), pct = value / safe;
  const won = value >= target && target > 0, overBy = Math.max(0, value - target), flagged = past === 'flag' && overBy > 0;
  const left = Math.max(0, target - value);
  const say = `${label ?? 'Progress'} ${num(value)} of ${num(target)}${unit ? ` ${unit}` : ''}${flagged ? `, ${num(overBy)} over` : won ? `, ${wonLabel.toLowerCase()}` : ''}`;
  const over = flagged ? overBy / safe : 0;
  const targetText = `/ ${num(target)}${unit ? ` ${unit}` : ''}`;

  if (size === 'sm') {
    return (
      <View style={[{ flex: 1, gap: 4 }, style]}>
        {label ? <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{label.toUpperCase()}</Txt> : null}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Txt face="display" size={28} lh={1.15} color={won && !flagged ? acc : F.chalk}>{num(value)}</Txt>
          <Txt face="label" size={14} color={F.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{targetText}</Txt>
        </View>
        <MeterBar pct={pct} over={over} height={8} accent={acc} accessibilityLabel={say} />
      </View>
    );
  }

  const big = size === 'lg';
  const status = flagged ? (
    <Txt face="label" w={600} size={12} ls={0.12} color={F.chalk}>{`${num(overBy)} OVER`}</Txt>
  ) : won ? (
    <RoundStamp label={wonLabel} size={big ? 'md' : 'sm'} />
  ) : big ? (
    <View style={{ alignItems: 'flex-end' }}>
      <Txt face="display" size={28} lh={1.15} color={acc}>{num(left)}</Txt>
      <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>TO FULL</Txt>
    </View>
  ) : (
    <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{`${num(left)} TO FULL`}</Txt>
  );

  return (
    <View style={[{ gap: 8 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: big ? 12 : 8, flexShrink: 1 }}>
          <Txt face="display" size={big ? 64 : 28} lh={big ? 1.08 : 1.15}>{num(value)}</Txt>
          <Txt face="label" size={big ? 18 : 14} ls={0.03} color={F.smoke} numberOfLines={1} style={{ flexShrink: 1 }}>{label && !big ? `${targetText} ${label.toUpperCase()}` : targetText}</Txt>
        </View>
        <View style={{ paddingBottom: big ? 6 : 4 }}>{status}</View>
      </View>
      <MeterBar pct={pct} over={over} segments={segments} height={big ? (segments ? 32 : 24) : 16} accent={acc} accessibilityLabel={say} />
    </View>
  );
}

/* ───────────────────────────── Stamps and tags ───────────────────────────── */

/**
 * A cut tag. `chalk` (default) is the ROUND WON stamp; `accent` is a filled tag in your colour;
 * `outline` is a quiet status ("ROUND OPEN"); `rival` is for Excuses only.
 */
export function RoundStamp({ label = 'ROUND WON', tone = 'chalk', size = 'md', accent, style }: { label?: string; tone?: 'chalk' | 'accent' | 'outline' | 'rival'; size?: 'md' | 'sm'; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const fill = tone === 'chalk' ? F.chalk : tone === 'accent' ? acc : tone === 'rival' ? F.rival : F.arena;
  const ink = tone === 'outline' ? F.chalk : onColor(fill);
  const h = size === 'md' ? 26 : 22;
  return (
    <CutBox fill={fill} stroke={tone === 'outline' ? F.chalk : undefined} style={[{ minHeight: h, paddingHorizontal: h * 0.5, justifyContent: 'center', alignSelf: 'flex-start' }, style]}>
      {tone === 'outline' ? (
        <Txt face="label" w={600} size={13} ls={0.14} color={ink}>{label.toUpperCase()}</Txt>
      ) : (
        <Txt face="display" lean={false} size={size === 'md' ? 16 : 14} ls={0.06} lh={1.25} color={ink}>{label.toUpperCase()}</Txt>
      )}
    </CutBox>
  );
}

/* ───────────────────────────── Combo ───────────────────────────── */

/** The streak as a combo counter: speed lines, the count, a two-line label. A broken streak (0) goes quiet. */
export function Combo({ count, top = 'DAY', bottom = 'COMBO', size = 'md', accent, style }: { count: number; top?: string; bottom?: string; size?: 'md' | 'sm'; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const col = count > 0 ? acc : F.smoke;
  const k = size === 'md' ? 1 : 0.7;
  return (
    <View accessible accessibilityLabel={`${count} ${top.toLowerCase()} ${bottom.toLowerCase()}`} style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 * k }, style]}>
      <Svg width={20 * k} height={24 * k} viewBox="0 0 20 24">
        <Rect x={6} y={5} width={14} height={3} fill={col} />
        <Rect x={0} y={11} width={20} height={3} fill={col} />
        <Rect x={9} y={17} width={11} height={3} fill={col} />
      </Svg>
      <Txt face="display" size={40 * k} lh={1.1} color={col}>{num(count)}</Txt>
      <View>
        <Txt face="labelItalic" w={600} size={13} ls={0.12} lh={1.1} color={count > 0 ? F.chalk : F.smoke}>{top.toUpperCase()}</Txt>
        <Txt face="labelItalic" w={600} size={13} ls={0.12} lh={1.1} color={count > 0 ? F.chalk : F.smoke}>{bottom.toUpperCase()}</Txt>
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
}

/** What it takes to climb: the gap from your row to the one above, or null when you lead or aren't on the board. */
export function ladderGap(rows: LadderRow[]): { gap: number; to: LadderRow } | null {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const i = sorted.findIndex(r => r.you);
  return i > 0 ? { gap: Math.max(1, sorted[i - 1].score - sorted[i].score + 1), to: sorted[i - 1] } : null;
}

/**
 * The weekly board as a ladder. Each rung's length follows its score; yours is filled in your
 * corner colour with a hard shadow, and the line under it says what it takes to pass the next one.
 */
export function Ladder({ rows, unit = 'XP', showGap = true, accent, style }: { rows: LadderRow[]; unit?: string; showGap?: boolean; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const top = Math.max(1, ...sorted.map(r => r.score));
  const gap = ladderGap(sorted);
  const leading = sorted[0]?.you;
  return (
    <View style={[{ gap: 6 }, style]}>
      {sorted.map(r => {
        const ink = r.you ? onColor(acc) : F.chalk;
        // Never shorter than 62%, so the name and score always fit.
        const width = `${Math.round((0.62 + 0.38 * (r.score / top)) * 100)}%` as const;
        return (
          <View key={r.id ?? `${r.rank}-${r.name}`} accessible accessibilityLabel={`Place ${r.rank}, ${r.name}${r.you ? ', you' : ''}${r.tag ? `, ${r.tag}` : ''}, ${num(r.score)} ${unit}`} style={{ width, paddingRight: SHADOW, paddingBottom: r.you ? SHADOW : 0 }}>
            <CutBox fill={r.you ? acc : F.canvas} stroke={r.you ? undefined : r.rank === 1 ? F.chalk : F.rope} shadow={r.you ? F.chalk : undefined} style={{ minHeight: 40, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Txt face="display" lean={false} size={22} lh={1.15} color={ink} style={{ minWidth: 18 }}>{r.rank}</Txt>
              <View style={{ flexShrink: 1, paddingVertical: r.tag ? 4 : 0 }}>
                <Txt size={15} w={600} color={ink} numberOfLines={1}>{r.name}</Txt>
                {r.tag ? <Txt face="label" w={600} size={12} ls={0.1} lh={1.1} color={r.you ? ink : F.smoke} numberOfLines={1}>{r.tag.toUpperCase()}</Txt> : null}
              </View>
              {r.you ? <Txt face="label" w={600} size={12} ls={0.12} color={ink}>YOU</Txt> : null}
              <View style={{ flex: 1 }} />
              <Txt face="display" lean={false} size={20} lh={1.15} color={ink}>{num(r.score)}</Txt>
              <Txt face="label" w={600} size={12} ls={0.12} color={r.you ? ink : F.smoke}>{unit}</Txt>
            </CutBox>
          </View>
        );
      })}
      {showGap && (gap || leading) ? (
        <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} style={{ marginTop: 2 }}>
          {gap ? `${num(gap.gap)} ${unit} TO PASS ${gap.to.name.toUpperCase()}` : 'TOP OF THE LADDER. HOLD IT.'}
        </Txt>
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

/** One row of a move list or hit log: canvas strip, index, name, pips, loud value. At least 44pt tall. */
export function MoveRow({ index, indexWidth = 22, name, detail, pips, value, done, onPress, onLongPress, right, accent, style }: MoveRowProps) {
  const acc = useAccent(accent);
  const idx = typeof index === 'number' ? String(index).padStart(2, '0') : index;
  const body = (
    <View style={[{ minHeight: HIT, backgroundColor: F.canvas, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 }, style]}>
      {done ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: acc }} /> : null}
      {idx !== undefined ? <Txt face="label" w={600} size={14} ls={0.07} color={F.smoke} style={{ minWidth: indexWidth }}>{idx}</Txt> : null}
      <Txt size={15} w={500} lh={1.3} numberOfLines={2} style={{ flex: 1 }}>{name}</Txt>
      {pips ? (
        <View accessible accessibilityLabel={`${pips.done} of ${pips.total} sets`} style={{ flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: Math.min(pips.total, 8) }, (_, i) => <CutShape key={i} width={9} height={12} fill={i < pips.done ? F.chalk : F.rope} />)}
        </View>
      ) : null}
      {detail ? <Txt face="label" w={600} size={14} ls={0.07} color={F.smoke}>{detail}</Txt> : null}
      {value ? <Txt face="display" size={22} lh={1.15} color={done ? F.chalk : acc} align="right" style={{ minWidth: 52 }}>{value}</Txt> : null}
      {right}
    </View>
  );
  return onPress || onLongPress ? <Tap onPress={onPress} onLongPress={onLongPress}>{body}</Tap> : body;
}

/* ───────────────────────────── Special move card ───────────────────────────── */

export type MoveTier = 'bronze' | 'silver' | 'gold';
export const TIER_COLOR: Record<MoveTier, string> = { bronze: F.bronze, silver: F.silver, gold: F.gold };

/** The card itself: a slanted plate in the tier colour with a hard chalk shadow; a rope outline when locked. */
export function MoveCardArt({ tier, earned, icon, width = 48 }: { tier: MoveTier; earned: boolean; icon?: IconKey; width?: number }) {
  const k = width / 48, h = 56 * k;
  return (
    <View style={{ width: width + 4 * k, height: h + 4 * k }}>
      <Svg width={width + 4 * k} height={h + 4 * k} viewBox="0 0 52 60">
        {earned ? (
          <>
            <Polygon points="12,4 52,4 44,60 4,60" fill={F.chalk} />
            <Polygon points="8,0 48,0 40,56 0,56" fill={TIER_COLOR[tier]} />
          </>
        ) : (
          <Polygon points="9,1 47,1 39,55 1,55" fill={F.canvas} stroke={F.rope} strokeWidth={2} />
        )}
      </Svg>
      <View style={{ position: 'absolute', left: 0, top: 0, width, height: h, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={earned ? icon ?? 'badge' : icon ?? 'lock'} size={width * 0.5} color={earned ? F.arena : F.locked} tint={earned ? 0.25 : 0} strokeWidth={earned ? 2.1 : 1.9} />
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

/** A badge as a special-move card: earned in its rarity colour, or locked and quiet with progress. */
export function SpecialMoveCard({ title, tier, earned, icon, hint, progress, layout = 'stack', width = 48, onPress, accent, style }: SpecialMoveCardProps) {
  const acc = useAccent(accent);
  const say = `${title}, ${earned ? `${tier}, unlocked` : `locked${progress ? `, ${Math.round(progress * 100)} percent` : ''}`}${hint ? `. ${hint}` : ''}`;
  const rarity = <Txt face="label" w={600} size={layout === 'row' ? 12 : 11} ls={0.1} color={earned ? TIER_COLOR[tier] : F.smoke}>{earned ? tier.toUpperCase() : 'LOCKED'}</Txt>;
  const meter = !earned && progress !== undefined && progress > 0 ? <MeterBar pct={progress} height={6} accent={acc} style={{ alignSelf: undefined, width }} /> : null;
  const body = layout === 'row' ? (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HIT }, style]}>
      <MoveCardArt tier={tier} earned={earned} icon={icon} width={width} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt face="display" size={18} lh={1.2} color={earned ? F.chalk : F.smoke} numberOfLines={1}>{title.toUpperCase()}</Txt>
        {rarity}
        {hint ? <Txt face="label" size={12} ls={0.08} color={F.smoke} numberOfLines={2}>{hint}</Txt> : null}
        {meter}
      </View>
    </View>
  ) : (
    <View style={[{ alignItems: 'center', gap: 4, minHeight: HIT }, style]}>
      <MoveCardArt tier={tier} earned={earned} icon={icon} width={width} />
      <Txt face="label" w={600} size={12} ls={0.04} lh={1.1} align="center" color={earned ? F.chalk : F.smoke} numberOfLines={2} style={{ marginTop: 2 }}>{title.toUpperCase()}</Txt>
      {rarity}
      {meter}
    </View>
  );
  return onPress ? <Tap onPress={onPress} accessibilityLabel={say}>{body}</Tap> : <View accessible accessibilityLabel={say}>{body}</View>;
}

/* ───────────────────────────── Versus ───────────────────────────── */

export interface VersusHeaderProps {
  /** Your corner. */
  name: string;
  /** Under your name, in your colour ("ROOKIE · 220 XP"). */
  sub?: string;
  /** The far corner. Always the excuses. */
  rivalName?: string;
  /** Under the rival's name, in rival red ("2 SESSIONS TAKEN THIS WEEK"). */
  rivalSub?: string;
  /** The plate on the slash: a big line ("00:48") and a small one ("TO THE BELL · 18:30"). */
  plate?: { big: string; small?: string };
  height?: number;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The versus poster: you on the left in your corner colour, Excuses on the right in rival red,
 * split by the three-colour slash. The hero of Today.
 */
export function VersusHeader({ name, sub, rivalName = 'EXCUSES', rivalSub, plate, height = 224, accent, style }: VersusHeaderProps) {
  const acc = useAccent(accent);
  const [size, onLayout] = useSize();
  const say = `${name} versus ${rivalName}.${sub ? ` ${sub}.` : ''}${rivalSub ? ` ${rivalSub}.` : ''}${plate ? ` ${plate.big}${plate.small ? `, ${plate.small}` : ''}.` : ''}`;
  return (
    <View onLayout={onLayout} accessible accessibilityRole="header" accessibilityLabel={say} style={[{ height, overflow: 'hidden', borderTopWidth: 2, borderBottomWidth: 2, borderColor: F.rope, backgroundColor: F.cornerField }, style]}>
      {size ? (
        <Svg width={size.w} height={height} viewBox="0 0 390 224" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', left: 0, top: -2 }}>
          {/* fields */}
          <Polygon points="-200,0 216,0 144,224 -200,224" fill={F.cornerField} />
          <Polygon points="248,0 590,0 590,224 176,224" fill={F.rivalField} />
          {/* team lights, flat */}
          <Polygon points="56,0 112,0 40,224 -16,224" fill={acc} opacity={0.1} />
          <Polygon points="330,0 372,0 300,224 258,224" fill={F.rival} opacity={0.12} />
          {/* the split */}
          <Polygon points="216,0 228,0 156,224 144,224" fill={acc} />
          <Polygon points="228,0 236,0 164,224 156,224" fill={F.chalk} />
          <Polygon points="236,0 248,0 176,224 164,224" fill={F.rival} />
          {/* speed lines */}
          <Rect x={0} y={34} width={40} height={3} fill={acc} opacity={0.8} />
          <Rect x={0} y={46} width={22} height={3} fill={acc} opacity={0.8} />
          <Rect x={128} y={140} width={28} height={3} fill={acc} opacity={0.8} />
          <Rect x={350} y={34} width={40} height={3} fill={F.rival} opacity={0.8} />
          <Rect x={368} y={46} width={22} height={3} fill={F.rival} opacity={0.8} />
          <Rect x={236} y={150} width={26} height={3} fill={F.rival} opacity={0.8} />
          {/* you: a cut-paper bust, facing right */}
          <Polygon points="8,224 30,152 62,136 106,136 136,152 150,224" fill="#2A303C" />
          <Polygon points="62,136 84,164 106,136 98,136 84,152 70,136" fill={acc} />
          <Polygon points="74,118 94,118 96,138 72,138" fill="#CFCABE" />
          <Polygon points="60,62 104,58 112,92 100,124 70,126 56,96" fill={F.chalk} />
          <Polygon points="100,124 112,92 105,108 94,125" fill="#BDB8AC" />
          <Polygon points="54,72 58,40 72,52 80,30 92,48 108,36 110,66 104,58 60,62" fill={acc} />
          <Polygon points="56,80 110,72 112,82 57,91" fill={F.arena} />
          <Polygon points="86,98 105,95 104,100 87,102" fill={F.arena} />
          <Polygon points="92,112 104,111 103,114 92,115" fill={F.arena} />
          {/* excuses: hooded, faceless */}
          <Polygon points="214,224 250,160 286,140 346,140 382,160 390,180 390,224" fill="#2A0F1A" />
          <Polygon points="276,150 284,74 316,44 348,74 356,150" fill={F.rival} />
          <Polygon points="316,44 348,74 356,150 338,150 340,118 334,86" fill={F.rivalDeep} />
          <Polygon points="298,86 334,86 340,118 316,138 292,118" fill={F.arena} />
          <Rect x={303} y={106} width={5} height={5} fill="#5A6070" />
          <Rect x={314} y={106} width={5} height={5} fill="#5A6070" />
          <Rect x={325} y={106} width={5} height={5} fill="#5A6070" />
        </Svg>
      ) : null}

      <View style={{ position: 'absolute', left: 16, right: 16, top: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt face="labelItalic" w={600} size={12} ls={0.16} color={acc}>YOUR CORNER</Txt>
        <Txt face="labelItalic" w={600} size={12} ls={0.16} color={F.rival}>FAR CORNER</Txt>
      </View>

      {plate ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 24, alignItems: 'center', justifyContent: 'center' }}>
          <CutBox fill={F.chalk} shadow={F.arena} style={{ minWidth: 124, paddingHorizontal: 22, paddingVertical: 6, alignItems: 'center' }}>
            <Txt face="display" lean={false} size={38} lh={1.12} ls={0.02} color={F.arena} fit>{plate.big}</Txt>
            {plate.small ? <Txt face="label" w={600} size={12} ls={0.12} color={F.arena} numberOfLines={1}>{plate.small.toUpperCase()}</Txt> : null}
          </CutBox>
        </View>
      ) : null}

      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <Txt face="display" size={44} lh={1.1} fit>{name.toUpperCase()}</Txt>
          {sub ? <Txt face="label" w={600} size={13} ls={0.11} color={acc} fit>{sub.toUpperCase()}</Txt> : null}
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Txt face="display" size={38} lh={1.15} fit>{rivalName.toUpperCase()}</Txt>
          {rivalSub ? <Txt face="label" w={600} size={13} ls={0.11} color={F.rival} align="right" numberOfLines={2}>{rivalSub.toUpperCase()}</Txt> : null}
        </View>
      </View>
    </View>
  );
}

/** The three-colour slash on a rope: a divider between blocks (your colour, chalk, rival). */
export function Slash({ accent, style }: { accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const h = 14, dx = cutDx(h);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, height: h }, style]}>
      <View style={{ flex: 1, height: 2, backgroundColor: F.rope }} />
      <Svg width={18 + dx} height={h}>
        <Polygon points={cutPoints(6 + dx, h)} fill={acc} />
        <Polygon points={cutPoints(6 + dx, h, { ox: 6 })} fill={F.chalk} />
        <Polygon points={cutPoints(6 + dx, h, { ox: 12 })} fill={F.rival} />
      </Svg>
      <View style={{ flex: 1, height: 2, backgroundColor: F.rope }} />
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
  /** `accent`: your colour on a chalk shadow (primary). `chalk`: chalk on your colour. `quiet`: outlined, no shadow (secondary). */
  tone?: 'accent' | 'chalk' | 'quiet';
  accent?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** The primary action: a cut slab in your corner colour on a hard chalk shadow. It sinks into the shadow when pressed. */
export function CutButton({ label, meta, icon, onPress, disabled, size = 'lg', tone = 'accent', accent, accessibilityLabel, style }: CutButtonProps) {
  const acc = useAccent(accent);
  const h = size === 'lg' ? 56 : 48;
  const fill = disabled ? F.canvas2 : tone === 'accent' ? acc : tone === 'chalk' ? F.chalk : F.canvas;
  const shadow = disabled || tone === 'quiet' ? undefined : tone === 'accent' ? F.chalk : acc;
  const ink = disabled ? F.smoke : tone === 'quiet' ? F.chalk : onColor(fill);
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
          stroke={tone === 'quiet' || disabled ? F.rope : undefined}
          shadow={pressed ? undefined : shadow}
          style={{ minHeight: h, paddingHorizontal: h * 0.42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, transform: pressed && shadow ? [{ translateX: SHADOW / 2 }, { translateY: SHADOW / 2 }] : undefined }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
            {icon ? <Icon name={icon} size={22} color={ink} tint={0} strokeWidth={2.2} /> : null}
            <Txt face="display" lean={false} size={size === 'lg' ? 24 : 21} ls={0.02} lh={1.2} color={ink} fit style={{ flexShrink: 1 }}>{label.toUpperCase()}</Txt>
          </View>
          {meta ? <Txt face="label" w={600} size={13} ls={0.11} color={ink} numberOfLines={1}>{meta.toUpperCase()}</Txt> : null}
        </CutBox>
      )}
    </Pressable>
  );
}

/* ───────────────────────────── Corner coach ───────────────────────────── */

/** REI's corner portrait: a cut-paper face in a square frame, in your corner colour. */
export function CoachPortrait({ size = 56, accent }: { size?: number; accent?: string }) {
  const acc = useAccent(accent);
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Rect x={1} y={1} width={54} height={54} fill={F.canvas} stroke={acc} strokeWidth={2} />
      <Polygon points="6,55 14,46 42,46 50,55" fill={F.rope} />
      <Polygon points="17,21 38,18 42,32 36,45 22,45 15,32" fill={F.chalk} />
      <Polygon points="13,21 39,13 48,19 40,22 16,25" fill={acc} />
      <Polygon points="24,28 41,26 41,30 24,32" fill={F.arena} />
      <Polygon points="29,36 39,34 37,42 30,41" fill={F.arena} />
      <Rect x={45} y={27} width={8} height={2} fill={acc} />
      <Rect x={46} y={34} width={6} height={2} fill={acc} />
      <Rect x={45} y={41} width={8} height={2} fill={acc} />
    </Svg>
  );
}

/**
 * REI shouting from your corner: portrait, then a chalk speech panel on a hard shadow in your
 * colour. `shout` is the loud line (display type); `before` and `after` are plain sentences.
 * The chalk panel is REI's alone: nothing else in the app is chalk-filled at this size.
 */
export function CoachShout({ before, shout, after, children, onPress, portrait = 56, accent, style }: { before?: string; shout?: string; after?: string; children?: ReactNode; onPress?: () => void; portrait?: number; accent?: string; style?: StyleProp<ViewStyle> }) {
  const acc = useAccent(accent);
  const body = (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingRight: SHADOW, paddingBottom: SHADOW }, style]}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <CoachPortrait size={portrait} accent={acc} />
        <Txt face="labelItalic" w={600} size={12} ls={0.12} color={F.smoke}>REI</Txt>
      </View>
      <View style={[{ flex: 1, backgroundColor: F.chalk, paddingVertical: 12, paddingHorizontal: 16, gap: 4 }, hard(acc)]}>
        <View style={{ position: 'absolute', left: -10, top: Math.min(20, portrait / 2 - 8) }}>
          <Svg width={10} height={16}><Polygon points="10,0 0,6 10,16" fill={F.chalk} /></Svg>
        </View>
        {before ? <Txt size={14} w={500} lh={1.4} color={F.arena}>{before}</Txt> : null}
        {shout ? <Txt face="display" size={22} lh={1.2} ls={0.01} color={F.arena} style={{ alignSelf: 'flex-start' }}>{shout.toUpperCase()}</Txt> : null}
        {after ? <Txt size={14} w={600} lh={1.4} color={F.arena}>{after}</Txt> : null}
        {children}
      </View>
    </View>
  );
  return onPress ? <Tap onPress={onPress} accessibilityHint="Talk to REI">{body}</Tap> : body;
}
