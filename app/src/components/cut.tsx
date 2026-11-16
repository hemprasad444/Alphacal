// Plain shapes kept from the earlier systems under their old names, drawn in Sumi & Hanko:
// `CutBox` is a softly rounded box with a quiet border, `CutShape` a small pill (set pips, a
// switch) and `SkewBox` a rounded box sized by its content. Nothing leans and nothing casts a shadow.
import { useCallback, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { F, RADIUS } from '../lib/theme';

/** Kept so old callers compile: ends no longer lean. */
export type CutEnds = 'both' | 'left' | 'right' | 'none';

/** Polygon points for a `w`×`h` rectangle, moved by (`ox`,`oy`) and shrunk by `inset`. */
export function cutPoints(w: number, h: number, { inset = 0, ox = 0, oy = 0 }: { ends?: CutEnds; inset?: number; ox?: number; oy?: number; angle?: number } = {}): string {
  const x0 = ox + inset, x1 = ox + w - inset, y0 = oy + inset, y1 = oy + h - inset;
  return `${x0},${y0} ${x1},${y0} ${x1},${y1} ${x0},${y1}`;
}

/** Measures a view: `[size, onLayout]`. Size is null until the first layout. */
export function useSize(): [{ w: number; h: number } | null, (e: LayoutChangeEvent) => void] {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize(p => (p && p.w === w && p.h === h ? p : { w, h }));
  }, []);
  return [size, onLayout];
}

/** A small pill of a known size (a set pip, a switch and its thumb). */
export function CutShape({ width, height, fill, stroke, strokeWidth = 1, style }: { width: number; height: number; fill: string; stroke?: string; strokeWidth?: number; ends?: CutEnds; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width, height, borderRadius: Math.min(width, height) / 2, backgroundColor: fill, borderWidth: stroke ? strokeWidth : 0, borderColor: stroke }, style]} />;
}

/** A rounded box sized by its content, filled and (when asked) outlined. */
export function SkewBox({ fill, stroke, strokeWidth = 1, style, children }: { fill: string; stroke?: string; strokeWidth?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <View style={[{ backgroundColor: fill, borderWidth: stroke ? strokeWidth : 0, borderColor: stroke, borderRadius: RADIUS.sm }, style]}>{children}</View>;
}

/**
 * A box sized by its content like any View: `fill` inside a quiet `stroke`, softly rounded.
 * `shadow`, `offset` and `ends` are accepted for old callers and ignored.
 */
export function CutBox({ fill, stroke = F.line, strokeWidth = 1, style, children }: { fill: string; stroke?: string; strokeWidth?: number; shadow?: string; offset?: number; ends?: CutEnds; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <View style={[{ backgroundColor: fill, borderWidth: strokeWidth, borderColor: stroke, borderRadius: RADIUS.sm }, style]}>{children}</View>;
}
