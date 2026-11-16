// The unlock moment: a light sheet of washi is laid on the page and the badge's red seal is
// stamped onto it, with a chime. The sheet carries the date, the badge's name, its tier and how
// it was earned; REI says one line underneath. One badge at a time.
import type { GameBadge } from '@rei/shared';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { CutButton } from './fight';
import { BrushRule, HankoSeal, PaperTexture, ReiSeal, SealTag, sealShapeFor } from './ink';
import { IconButton, Tap, Txt } from './ui';
import { C, HIT, RADIUS } from '../lib/theme';
import { useStore } from '../state/store';

export function BadgeUnlock({ badges, onDone }: { badges: GameBadge[]; onDone: (ids: string[]) => void }) {
  const [i, setI] = useState(0);
  const b = badges[i];
  if (!b) return null;
  const finish = () => {
    onDone(badges.map(x => x.id));
    setI(0);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={finish}>
      <Stamped key={b.id} b={b} at={i + 1} of={badges.length} onNext={() => (i + 1 < badges.length ? setI(i + 1) : finish())} onSkip={finish} />
    </Modal>
  );
}

/** Tier names in ink dark enough to read on the light sheet. */
const TIER_INK = { bronze: '#7A4E22', silver: '#565B62', gold: '#75580F' } as const;
/** The seal's red on light paper: a shade deeper than on the dark page. */
const SEAL_ON_WASHI = '#CE3A25';

/** The faint registration marks around where the seal lands: a dotted circle and eight short ticks. */
function StampGuide({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 236 236" style={{ position: 'absolute' }}>
      <Circle cx={118} cy={118} r={104} fill="none" stroke={C.washiInk} strokeWidth={0.8} strokeDasharray="2 9" strokeOpacity={0.35} />
      <Path d="M118 6V20M197 39L187 49M230 118H216M197 197L187 187M118 230V216M39 197L49 187M6 118H20M39 39L49 49" stroke={C.washiInk} strokeWidth={2} strokeLinecap="round" strokeOpacity={0.4} fill="none" />
    </Svg>
  );
}

function Stamped({ b, at, of, onNext, onSkip }: { b: GameBadge; at: number; of: number; onNext: () => void; onSkip: () => void }) {
  const accent = useStore(s => s.accent);
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [v] = useState(() => new Animated.Value(0));
  const chime = useAudioPlayer(require('../../assets/sounds/unlock.wav'));
  const more = of - at;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // The chime and the buzz land with the seal (a third of the way in).
    const t = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      try {
        chime.volume = 0.8;
        chime.seekTo(0);
        chime.play();
      } catch {
        // No sound is fine.
      }
    }, 300);
    return () => clearTimeout(t);
  }, [v, chime]);

  const sheetW = Math.min(312, W - 72);
  // A short phone gets a smaller stamp so the caption and the buttons always fit.
  const zone = Math.round(Math.max(150, Math.min(220, H * 0.26)));
  const seal = Math.round(zone * 0.66);
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const tier = b.tier.charAt(0).toUpperCase() + b.tier.slice(1);

  return (
    <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, { backgroundColor: C.arena, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16, paddingHorizontal: 24, gap: 20 }]}>
      <PaperTexture />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: HIT }}>
        <SealTag icon="badge" />
        <View accessibilityRole="header" style={{ flexShrink: 1 }}>
          <Txt face="heading" size={20} lh={1.4} fit>Seal earned</Txt>
        </View>
        {of > 1 ? <Txt face="mono" raw size={12} lh={1.35} color={accent}>{`${at} of ${of}`}</Txt> : null}
        <View style={{ flex: 1 }} />
        <IconButton size={HIT} onPress={onSkip} accessibilityLabel="Close">✕</IconButton>
      </View>

      {/* The sheet of washi, and the seal coming down on it */}
      <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', opacity: v.interpolate({ inputRange: [0, 0.25], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ translateY: v.interpolate({ inputRange: [0, 0.3], outputRange: [16, 0], extrapolate: 'clamp' }) }] }}>
        <View style={{ width: sheetW }}>
          {/* The shadow of the sheet: a darker sheet turned the other way. */}
          <View pointerEvents="none" style={{ position: 'absolute', left: 14, right: -8, top: 12, bottom: -6, backgroundColor: '#0B0A09', borderRadius: RADIUS.tag, transform: [{ rotate: '1.5deg' }] }} />
          <View shouldRasterizeIOS renderToHardwareTextureAndroid style={{ padding: 1, transform: [{ rotate: '-1.5deg' }] }}>
            <View style={{ backgroundColor: C.washi, borderRadius: RADIUS.tag, padding: 20, overflow: 'hidden' }}>
              <PaperTexture light />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Txt face="mono" raw size={12} lh={1.35} color={C.washiSub}>REI · seal</Txt>
                <Txt face="mono" raw size={12} lh={1.35} color={C.washiSub}>{date}</Txt>
              </View>

              <View style={{ height: zone, alignItems: 'center', justifyContent: 'center' }}>
                <StampGuide size={zone} />
                <Animated.View style={{ opacity: v.interpolate({ inputRange: [0, 0.28, 0.4], outputRange: [0, 0, 1], extrapolate: 'clamp' }), transform: [{ scale: v.interpolate({ inputRange: [0, 0.28, 0.46, 0.6, 1], outputRange: [1.7, 1.7, 0.96, 1.02, 1] }) }] }}>
                  <HankoSeal size={seal} shape={sealShapeFor(b.icon)} icon={b.icon} tilt={-8} ground={C.washi} fill={SEAL_ON_WASHI} />
                </Animated.View>
              </View>

              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flexShrink: 1 }}><Txt face="display" exact size={32} lh={1.2} ls={-0.02} color={C.washiInk} fit>{b.title}</Txt></View>
                  <Txt face="heading" size={14} lh={1.4} color={TIER_INK[b.tier]}>{tier}</Txt>
                </View>
                <BrushRule long height={6} color={C.washiInk} />
                <Txt size={15} w={500} lh={1.47} color={C.washiInk}>{b.desc}</Txt>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* REI's line, then the way on */}
      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40, opacity: v.interpolate({ inputRange: [0, 0.7, 0.9], outputRange: [0, 0, 1], extrapolate: 'clamp' }) }}>
        <ReiSeal size={32} ground={C.arena} />
        <Txt face="voice" size={16} lh={1.4} style={{ flex: 1 }}>{more ? 'One more on the page. There is another waiting.' : 'It is on the page. Keep the brush moving.'}</Txt>
      </Animated.View>
      <Animated.View style={{ gap: 4, opacity: v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 1] }) }}>
        <CutButton label={more ? 'Next seal' : 'Keep going'} meta={more ? `${more} more` : undefined} onPress={onNext} />
        {more ? (
          <Tap onPress={onSkip} style={{ height: HIT, alignItems: 'center', justifyContent: 'center' }}>
            <Txt face="label" size={13} color={C.smoke} style={{ textDecorationLine: 'underline' }}>Skip the rest</Txt>
          </Tap>
        ) : null}
      </Animated.View>
    </View>
  );
}
