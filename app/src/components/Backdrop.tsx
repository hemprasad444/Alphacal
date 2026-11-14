import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Image as SvgImage, Polygon } from 'react-native-svg';
import { cutDx, F } from '../lib/theme';
import { useStore } from '../state/store';

const EMBLEM_PX = { S: 260, M: 360, L: 460 } as const;
// The emblem is scenery now: faint enough that text on top of it keeps its contrast.
const EMBLEM_OPACITY = { Subtle: 0.06, Medium: 0.1, Bold: 0.18 } as const;

/**
 * The arena: flat ground lit by two beams, your corner's colour from the left and the far
 * corner's red from the right, both cut at the one angle. The world's emblem sits behind them,
 * faint and cropped off the right edge. `glow` picks which end the lights come from.
 * "Arena lights" in Appearance (settings.fx) turns the beams off; the emblem has its own controls.
 */
export function Backdrop({ glow = 'top' }: { glow?: 'top' | 'bottom' }) {
  const accent = useStore(s => s.accent), emblem = useStore(s => s.emblem), settings = useStore(s => s.settings);
  const { width: W, height: H } = useWindowDimensions();
  const e = EMBLEM_PX[settings.emblemSize];
  const ey = settings.emblemPos === 'Top' ? 70 : settings.emblemPos === 'Bottom' ? H - 130 - e : (H - e) / 2;
  // Pushed right so the screen edge crops it: it reads as arena art, not a centred logo.
  const ex = W - e * 0.68;
  const beamH = Math.min(H * 0.62, 520), dx = cutDx(beamH);
  // A beam is a band that leans at the cut angle; `x` is where its top edge starts.
  const beam = (x: number, w: number) => `${x},0 ${x + w},0 ${x + w - dx},${beamH} ${x - dx},${beamH}`;
  const flip = glow === 'bottom' ? `translate(0 ${H}) scale(1 -1)` : undefined;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: F.arena }]}>
      <Svg width={W} height={H}>
        {emblem ? <SvgImage href={emblem.source} x={ex} y={ey} width={e} height={e} opacity={EMBLEM_OPACITY[settings.bgStrength]} preserveAspectRatio="xMidYMid meet" /> : null}
        {settings.fx ? (
          <>
            <Polygon points={beam(W * 0.2, W * 0.3)} fill={accent} opacity={0.055} transform={flip} />
            <Polygon points={beam(W * 0.08, W * 0.07)} fill={accent} opacity={0.07} transform={flip} />
            <Polygon points={beam(W * 1.08, W * 0.16)} fill={F.rival} opacity={0.05} transform={flip} />
            <Polygon points={beam(W * 1.3, W * 0.05)} fill={F.rival} opacity={0.07} transform={flip} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
