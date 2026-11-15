import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Image as SvgImage, Path } from 'react-native-svg';
import { speedPath } from './ink';
import { emblemFor, F } from '../lib/theme';
import { useStore } from '../state/store';

const EMBLEM_PX = { S: 260, M: 360, L: 460 } as const;
// The emblem is scenery: faint enough that text on top of it keeps its contrast.
const EMBLEM_OPACITY = { Subtle: 0.06, Medium: 0.1, Bold: 0.18 } as const;

/**
 * The page: flat ink. The world's emblem sits on it, faint and cropped off the right edge, and
 * a faint burst of speed lines in the accent comes from one corner (`glow` picks top or bottom).
 * "Arena lights" in Appearance (settings.fx) turns the speed lines off; the emblem has its own controls.
 */
export function Backdrop({ glow = 'top' }: { glow?: 'top' | 'bottom' }) {
  const accent = useStore(s => s.accent), world = useStore(s => s.theme.id), settings = useStore(s => s.settings);
  // Resolved here (not from the store's `emblem`) so an emblem id saved by an older version still shows its replacement.
  const emblem = emblemFor(world, settings.bgByTheme);
  const { width: W, height: H } = useWindowDimensions();
  const e = EMBLEM_PX[settings.emblemSize];
  const ey = settings.emblemPos === 'Top' ? 70 : settings.emblemPos === 'Bottom' ? H - 130 - e : (H - e) / 2;
  // Pushed right so the screen edge crops it: it reads as page art, not a centred logo.
  const ex = W - e * 0.68;
  const rays = useMemo(() => speedPath(46, 170, 1100, 21, 0.4), []);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: F.arena }]}>
      <Svg width={W} height={H}>
        {emblem ? <SvgImage href={emblem.source} x={ex} y={ey} width={e} height={e} opacity={EMBLEM_OPACITY[settings.bgStrength]} preserveAspectRatio="xMidYMid meet" /> : null}
        {settings.fx ? <Path d={rays} fill={accent} fillOpacity={0.06} transform={`translate(${W + 20} ${glow === 'bottom' ? H + 20 : -20})`} /> : null}
      </Svg>
    </View>
  );
}
