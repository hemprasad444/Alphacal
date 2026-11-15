// Inked shapes. `CutBox` is an ink box: a rectangle with a paper stroke and, when asked, a hard
// offset shadow (it used to be a diagonal-cut slab; the name and props are kept so every caller
// still works). `CutShape` and `SkewBox` are the one slanted thing left: the leaning tag.
// Tags are drawn with SVG polygons, not view transforms, so the edge is smooth on iOS at any size.
import { useCallback, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { CUT, cutDx, F, SHADOW } from '../lib/theme';

/** Which ends lean. */
export type CutEnds = 'both' | 'left' | 'right' | 'none';

/** Polygon points for a `w`×`h` tag leaning right, moved by (`ox`,`oy`) and shrunk by `inset`. */
export function cutPoints(w: number, h: number, { ends = 'both', inset = 0, ox = 0, oy = 0, angle = CUT }: { ends?: CutEnds; inset?: number; ox?: number; oy?: number; angle?: number } = {}): string {
  const dx = Math.min(cutDx(h - inset * 2, angle), Math.max(0, w - inset * 2));
  const l = ends === 'both' || ends === 'left' ? dx : 0, r = ends === 'both' || ends === 'right' ? dx : 0;
  const x0 = ox + inset, x1 = ox + w - inset, y0 = oy + inset, y1 = oy + h - inset;
  return `${x0 + l},${y0} ${x1},${y0} ${x1 - r},${y1} ${x0},${y1}`;
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

/** A leaning tag of a known size, on its own (section tags, pips, the switch). */
export function CutShape({ width, height, fill, stroke, strokeWidth = 2, ends = 'both', style }: { width: number; height: number; fill: string; stroke?: string; strokeWidth?: number; ends?: CutEnds; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
        <Polygon points={cutPoints(width, height, { ends, inset: stroke ? strokeWidth / 2 : 0 })} fill={fill} stroke={stroke} strokeWidth={stroke ? strokeWidth : 0} strokeLinejoin="miter" />
      </Svg>
    </View>
  );
}

/**
 * A leaning tag sized by its content (the tag in a section heading, the current tab). Give the
 * children horizontal padding to clear the slants (about a fifth of the height).
 */
export function SkewBox({ fill, stroke = F.chalk, strokeWidth = 2, style, children }: { fill: string; stroke?: string; strokeWidth?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const [size, onLayout] = useSize();
  return (
    <View onLayout={onLayout} style={style}>
      {size ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: size.w, height: size.h }}>
          <Svg width={size.w} height={size.h}>
            <Polygon points={cutPoints(size.w, size.h, { inset: strokeWidth / 2 })} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="miter" />
          </Svg>
        </View>
      ) : null}
      {children}
    </View>
  );
}

/**
 * An ink box, sized by its content like any View: `fill` inside a `stroke` (paper unless said
 * otherwise), with a hard offset `shadow` when given. Plain views, no measuring. `ends` is
 * accepted for old callers and ignored: the box is square.
 */
export function CutBox({ fill, stroke = F.chalk, strokeWidth = 2, shadow, offset = SHADOW, style, children }: { fill: string; stroke?: string; strokeWidth?: number; shadow?: string; offset?: number; ends?: CutEnds; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <View style={[{ backgroundColor: fill, borderWidth: strokeWidth, borderColor: stroke }, shadow ? { boxShadow: `${offset}px ${offset}px 0px ${shadow}` } : null, style]}>
      {children}
    </View>
  );
}
