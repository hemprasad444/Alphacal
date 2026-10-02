import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Ellipse, Image as SvgImage, LinearGradient, Mask, Pattern, RadialGradient, Rect, Stop, Path } from 'react-native-svg';
import { useStore } from '../state/store';

const EMBLEM_PX = { S: 190, M: 270, L: 350 } as const;
const EMBLEM_OPACITY = { Subtle: 0.22, Medium: 0.38, Bold: 0.6 } as const;

/**
 * Screen background: theme color, accent glows, optional HUD grid, scanlines and
 * the theme's emblem watermark. `glow` picks where the accent light comes from.
 */
export function Backdrop({ glow = 'top' }: { glow?: 'top' | 'bottom' }) {
  const { theme, accent, emblem, settings } = useStore();
  const { width: W, height: H } = useWindowDimensions();
  const e = EMBLEM_PX[settings.emblemSize];
  const ey = settings.emblemPos === 'Top' ? 120 : settings.emblemPos === 'Bottom' ? H - 150 - e : (H - e) / 2 - 15;
  const ex = (W - e) / 2;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]}>
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="bgTop" cx="50%" cy="0%" rx="55%" ry="27%" gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor={accent} stopOpacity={glow === 'top' ? 0.13 : 0} />
            <Stop offset="1" stopColor={accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="bgBottom" cx="50%" cy="100%" rx="45%" ry="19%">
            <Stop offset="0" stopColor={accent} stopOpacity={glow === 'bottom' ? 0.14 : 0} />
            <Stop offset="1" stopColor={accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="bgCorner" cx="105%" cy="108%" rx="40%" ry="20%">
            <Stop offset="0" stopColor={theme.acc2} stopOpacity={0.16} />
            <Stop offset="1" stopColor={theme.acc2} stopOpacity={0} />
          </RadialGradient>
          <Pattern id="grid" width={34} height={34} patternUnits="userSpaceOnUse">
            <Path d="M0 0.5H34M0.5 0V34" stroke="#FFFFFF" strokeOpacity={0.025} strokeWidth={1} />
          </Pattern>
          <LinearGradient id="gridFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <Mask id="gridMask">
            <Rect width={W} height={H} fill="url(#gridFade)" />
          </Mask>
          <Pattern id="scan" width={3} height={3} patternUnits="userSpaceOnUse">
            <Rect width={3} height={1} fill="#FFFFFF" fillOpacity={0.012} />
          </Pattern>
          <RadialGradient id="emblemFade" cx="50%" cy="50%" r="50%">
            <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <Mask id="emblemMask">
            <Ellipse cx={ex + e / 2} cy={ey + e / 2} rx={e * 0.74} ry={e * 0.74} fill="url(#emblemFade)" />
          </Mask>
        </Defs>
        {emblem ? (
          <SvgImage
            href={emblem.source}
            x={ex}
            y={ey}
            width={e}
            height={e}
            opacity={EMBLEM_OPACITY[settings.bgStrength]}
            preserveAspectRatio="xMidYMid meet"
            mask="url(#emblemMask)"
          />
        ) : null}
        <Rect width={W} height={H} fill="url(#bgCorner)" />
        <Rect width={W} height={H} fill="url(#bgTop)" />
        <Rect width={W} height={H} fill="url(#bgBottom)" />
        {settings.fx ? <Rect width={W} height={H} fill="url(#grid)" mask="url(#gridMask)" /> : null}
        {settings.fx ? <Rect width={W} height={H} fill="url(#scan)" /> : null}
      </Svg>
    </View>
  );
}
