import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { C } from '../lib/theme';
import { Txt } from './ui';

/** Small line chart: one value per point, oldest first, with the first and last labelled. */
export function LineChart({ values, labels, color, height = 140, unit = '' }: { values: number[]; labels: string[]; color: string; height?: number; unit?: string }) {
  const [w, setW] = useState(320);
  if (!values.length) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || Math.max(1, hi * 0.1);
  const padY = 14, padX = 8;
  const x = (i: number) => (values.length === 1 ? w / 2 : padX + (i / (values.length - 1)) * (w - 2 * padX));
  const y = (v: number) => padY + (1 - (v - lo) / span) * (height - 2 * padY);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const fmt = (v: number) => `${+v.toFixed(1)}${unit}`;
  return (
    <View onLayout={e => setW(Math.max(120, e.nativeEvent.layout.width))}>
      <Svg width={w} height={height}>
        {[0, 0.5, 1].map(f => (
          <Line key={f} x1={0} x2={w} y1={padY + f * (height - 2 * padY)} y2={padY + f * (height - 2 * padY)} stroke={C.line2} strokeWidth={1} />
        ))}
        {values.length > 1 ? <Polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {values.map((v, i) => (
          <Circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4 : 2.5} fill={i === values.length - 1 ? color : C.ink} stroke={color} strokeWidth={1.5} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Txt face="mono" size={10} color={C.dim}>{`${labels[0] ?? ''} · ${fmt(values[0])}`}</Txt>
        {values.length > 1 ? <Txt face="mono" size={10} color={color}>{`${labels[labels.length - 1] ?? ''} · ${fmt(values[values.length - 1])}`}</Txt> : null}
      </View>
    </View>
  );
}
