import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Image as SvgImage, LinearGradient, Rect, Stop } from 'react-native-svg';
import { PaperTexture } from './ink';
import { emblemFor, F } from '../lib/theme';
import { useStore } from '../state/store';

const EMBLEM_PX = { S: 260, M: 360, L: 460 } as const;
// The emblem is scenery: a watermark in the paper, faint enough that text on top of it keeps its contrast.
const EMBLEM_OPACITY = { Subtle: 0.035, Medium: 0.06, Bold: 0.1 } as const;

/**
 * The page: night washi. A charcoal ground a shade lighter at the top, with paper fibres so
 * faint they are felt more than seen, and the world's emblem as a watermark cropped off the
 * right edge. "Paper texture" in Appearance (settings.fx) turns the fibres off; the emblem has
 * its own controls. `glow` is accepted for old callers and not used.
 */
export function Backdrop(_: { glow?: 'top' | 'bottom' }) {
  const world = useStore(s => s.theme.id), settings = useStore(s => s.settings);
  // Resolved here (not from the store's `emblem`) so an emblem id saved by an older version still shows its replacement.
  const emblem = emblemFor(world, settings.bgByTheme);
  const { width: W, height: H } = useWindowDimensions();
  const e = EMBLEM_PX[settings.emblemSize];
  const ey = settings.emblemPos === 'Top' ? 70 : settings.emblemPos === 'Bottom' ? H - 130 - e : (H - e) / 2;
  // Pushed right so the screen edge crops it: it reads as a watermark, not a centred logo.
  const ex = W - e * 0.68;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: F.arena }]}>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="washiGround" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#171513" />
            <Stop offset="0.4" stopColor={F.arena} />
            <Stop offset="1" stopColor="#100F0E" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill="url(#washiGround)" />
        {emblem ? <SvgImage href={emblem.source} x={ex} y={ey} width={e} height={e} opacity={EMBLEM_OPACITY[settings.bgStrength]} preserveAspectRatio="xMidYMid meet" /> : null}
      </Svg>
      {settings.fx ? <PaperTexture /> : null}
    </View>
  );
}
