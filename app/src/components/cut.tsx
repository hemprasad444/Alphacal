// The cut: Fight Night's one slanted edge. Shapes are drawn with SVG polygons, not view transforms,
// so the edge is always smooth and the angle is the same at any size.
import { useCallback, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { CUT, cutDx, SHADOW } from '../lib/theme';

/** Which ends are slanted. */
export type CutEnds = 'both' | 'left' | 'right' | 'none';

/** Polygon points for a `w`×`h` parallelogram leaning right at the cut angle, moved by (`ox`,`oy`) and shrunk by `inset`. */
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

/** A cut shape of a known size, on its own (section tabs, pips, tab indicators). */
export function CutShape({ width, height, fill, stroke, strokeWidth = 2, ends = 'both', style }: { width: number; height: number; fill: string; stroke?: string; strokeWidth?: number; ends?: CutEnds; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width, height }, style]}>
      <Svg width={width} height={height}>
        <Polygon points={cutPoints(width, height, { ends, inset: stroke ? strokeWidth / 2 : 0 })} fill={fill} stroke={stroke} strokeWidth={stroke ? strokeWidth : 0} />
      </Svg>
    </View>
  );
}

/**
 * A box whose ends are cut at the angle, sized by its content like any View. `shadow` adds the
 * hard offset shadow. Children sit on top; give them horizontal padding to clear the slants
 * (about a third of the height).
 */
export function CutBox({ fill, stroke, strokeWidth = 2, shadow, offset = SHADOW, ends = 'both', style, children }: { fill: string; stroke?: string; strokeWidth?: number; shadow?: string; offset?: number; ends?: CutEnds; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const [size, onLayout] = useSize();
  return (
    <View onLayout={onLayout} style={style}>
      {size ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: size.w + offset, height: size.h + offset }}>
          <Svg width={size.w + offset} height={size.h + offset}>
            {shadow ? <Polygon points={cutPoints(size.w, size.h, { ends, ox: offset, oy: offset })} fill={shadow} /> : null}
            <Polygon points={cutPoints(size.w, size.h, { ends, inset: stroke ? strokeWidth / 2 : 0 })} fill={fill} stroke={stroke} strokeWidth={stroke ? strokeWidth : 0} />
          </Svg>
        </View>
      ) : null}
      {children}
    </View>
  );
}
