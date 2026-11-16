import { downsample } from '@rei/shared';
import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { F } from '../lib/theme';
import { Txt } from './ui';

/**
 * A small, quiet line chart: a thin line over three hairlines, a dot per point and a rice-paper dot on
 * the latest. One value per point, oldest first, with the first and last labelled in mono.
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
          <Line key={f} x1={0} x2={w} y1={padY + f * (height - 2 * padY)} y2={padY + f * (height - 2 * padY)} stroke={f === 1 ? F.rope : F.line} strokeWidth={1} />
        ))}
        {pts.length > 1 ? <Polyline points={pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {dots.map(([cx, cy], k) => {
          // The last dot is rice paper inside a ring of the card, so today's value stands out from the line.
          const isLast = dots.length === 1 || k === dots.length - 1;
          return isLast
            ? <Circle key={k} cx={cx} cy={cy} r={4} fill={F.chalk} stroke={F.canvas} strokeWidth={2} />
            : <Circle key={k} cx={cx} cy={cy} r={2} fill={color} />;
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
        <Txt face="mono" size={12} lh={1.35} color={F.smoke} numberOfLines={1}>{`${labels[0] ?? ''} · ${fmt(values[0])}`}</Txt>
        {last > 0 ? <Txt face="mono" size={12} lh={1.35} color={F.chalk} numberOfLines={1}>{`${labels[labels.length - 1] ?? ''} · ${fmt(values[values.length - 1])}`}</Txt> : null}
      </View>
    </View>
  );
});
