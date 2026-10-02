import { downsample } from '@rei/shared';
import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { C } from '../lib/theme';
import { Txt } from './ui';

/**
 * Small line chart: one value per point, oldest first, with the first and last labelled.
 * Long series are thinned to at most 120 points; dots are drawn only for short ones.
 */
export const LineChart = memo(function LineChart({ values, labels, color, height = 140, unit = '' }: { values: number[]; labels: string[]; color: string; height?: number; unit?: string }) {
  const [w, setW] = useState(320);
  const shape = useMemo(() => {
    if (!values.length) return null;
    const idx = downsample(values, 120);
    const vs = idx.map(i => values[i]);
    const lo = Math.min(...vs), hi = Math.max(...vs);
    const span = hi - lo || Math.max(1, hi * 0.1);
    const padY = 14, padX = 8;
    const x = (k: number) => (vs.length === 1 ? w / 2 : padX + (k / (vs.length - 1)) * (w - 2 * padX));
    const y = (v: number) => padY + (1 - (v - lo) / span) * (height - 2 * padY);
    return { pts: vs.map((v, k) => [x(k), y(v)] as const), padY };
  }, [values, w, height]);
  if (!shape) return null;
  const { pts, padY } = shape;
  const fmt = (v: number) => `${+v.toFixed(1)}${unit}`;
  const dots = pts.length <= 40 ? pts : pts.slice(-1);
  const last = pts.length - 1;
  return (
    <View onLayout={e => setW(Math.max(120, e.nativeEvent.layout.width))}>
      <Svg width={w} height={height}>
        {[0, 0.5, 1].map(f => (
          <Line key={f} x1={0} x2={w} y1={padY + f * (height - 2 * padY)} y2={padY + f * (height - 2 * padY)} stroke={C.line2} strokeWidth={1} />
        ))}
        {pts.length > 1 ? <Polyline points={pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {dots.map(([cx, cy], k) => {
          const isLast = dots.length === 1 || k === dots.length - 1;
          return <Circle key={k} cx={cx} cy={cy} r={isLast ? 4 : 2.5} fill={isLast ? color : C.ink} stroke={color} strokeWidth={1.5} />;
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Txt face="mono" size={10} color={C.dim}>{`${labels[0] ?? ''} · ${fmt(values[0])}`}</Txt>
        {last > 0 ? <Txt face="mono" size={10} color={color}>{`${labels[labels.length - 1] ?? ''} · ${fmt(values[values.length - 1])}`}</Txt> : null}
      </View>
    </View>
  );
});
