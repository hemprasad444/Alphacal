// The unlock moment, as a manga splash panel: action lines burst from the middle, the badge's
// trading card slams in with a chime, a pop-red GET! stamp lands on its corner and REI calls it.
// One badge at a time.
import type { GameBadge } from '@rei/shared';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useId, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';
import { CoachShout, CutButton, useTierColors } from './fight';
import { Icon } from './icons';
import { Halftone, SkewTag, SpeedLines } from './ink';
import { IconButton, Tap, Txt } from './ui';
import { C, HIT, mix, STROKE } from '../lib/theme';
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
      <Burst key={b.id} b={b} more={badges.length - i - 1} onNext={() => (i + 1 < badges.length ? setI(i + 1) : finish())} onSkip={finish} />
    </Modal>
  );
}

const CARD_SHADOW = 6;

/** The badge as a full trading card: rarity frame, header, art window, name plate. */
function BigCard({ b, width, accent, foil }: { b: GameBadge; width: number; accent: string; foil: string }) {
  const id = 'big' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const height = Math.round(width * 1.38);
  return (
    <View style={{ width: width + CARD_SHADOW, height: height + CARD_SHADOW }}>
      <View style={{ position: 'absolute', left: CARD_SHADOW, top: CARD_SHADOW, width, height, backgroundColor: C.chalk }} />
      <View style={{ width, height, borderWidth: STROKE, borderColor: C.arena, padding: 7 }}>
        {/* The foil frame. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={mix('#FFFFFF', foil, 0.4)} />
                <Stop offset="0.4" stopColor={mix('#000000', foil, 0.18)} />
                <Stop offset="0.62" stopColor={mix('#FFFFFF', foil, 0.5)} />
                <Stop offset="1" stopColor={mix('#000000', foil, 0.38)} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
          </Svg>
        </View>
        <View style={{ height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          <Txt face="labelItalic" size={12} lh={1.3} color={C.arena}>REI CARD</Txt>
          <Txt face="labelItalic" size={12} lh={1.3} color={C.arena}>{`${b.tier.toUpperCase()} ★`}</Txt>
        </View>
        <View style={{ flex: 1, backgroundColor: C.canvas, borderWidth: STROKE, borderColor: C.arena, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <SpeedLines color={accent} opacity={0.4} count={24} inner={0.5} />
          <Halftone opacity={0.2} />
          {/* holo: one diagonal band of light */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <Polygon points="52,0 78,0 44,100 18,100" fill="#FFFFFF" fillOpacity={0.22} />
            </Svg>
          </View>
          <Icon name={b.icon} size={width * 0.46} color={accent} tint={0.3} strokeWidth={1.9} />
        </View>
        <View style={{ backgroundColor: C.chalk, borderWidth: STROKE, borderTopWidth: 0, borderColor: C.arena, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 6 }}>
          <Txt face="display" exact size={17} lh={1.25} color={C.arena} fit>{b.title}</Txt>
          <Txt size={12} w={600} lh={1.3} color={C.arena} numberOfLines={2}>{b.desc}</Txt>
        </View>
      </View>
    </View>
  );
}

/** The seal that lands on the card: a pop-red double ring around GET! and today's date. */
function GetStamp({ size }: { size: number }) {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.arena, borderWidth: 5, borderColor: C.rival, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size - 20, height: size - 20, borderRadius: size / 2, borderWidth: 2, borderColor: C.rival, alignItems: 'center', justifyContent: 'center' }}>
        <Txt face="labelItalic" size={12} lh={1.25} color={C.rival}>BADGE</Txt>
        <Txt face="display" exact size={26} lh={1.2} color={C.rival}>GET!</Txt>
        <Txt face="labelItalic" size={12} lh={1.25} color={C.rival}>{date}</Txt>
      </View>
    </View>
  );
}

function Burst({ b, more, onNext, onSkip }: { b: GameBadge; more: number; onNext: () => void; onSkip: () => void }) {
  const foil = useTierColors()[b.tier];
  const accent = useStore(s => s.accent);
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [v] = useState(() => new Animated.Value(0));
  const chime = useAudioPlayer(require('../../assets/sounds/unlock.wav'));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // The chime and the buzz land with the card (a third of the way in).
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

  const top = insets.top + 10;
  const cardW = Math.round(Math.min(204, W * 0.54, H * 0.25)), cardH = Math.round(cardW * 1.38);
  const cardTop = top + HIT + 22;
  const stamp = Math.round(cardW * 0.54);
  const cy = (cardTop + cardH / 2) / H;

  return (
    <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, { backgroundColor: C.arena, overflow: 'hidden' }]}>
      {/* Action lines */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: v.interpolate({ inputRange: [0, 0.2, 0.45], outputRange: [0, 0, 1] }) }]}>
        <SpeedLines color={accent} opacity={0.55} count={36} inner={0.46} cy={cy} seed={9} />
        <SpeedLines color={C.chalk} opacity={0.22} count={22} inner={0.56} cy={cy} seed={4} />
      </Animated.View>

      {/* Top row */}
      <View style={{ position: 'absolute', left: 16, right: 16, top, height: HIT, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <SkewTag text="New" color={accent} size="lg" />
        <View accessibilityRole="header" style={{ flexShrink: 1, backgroundColor: C.arena, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Txt face="display" exact size={17} lh={1.25} fit>BADGE UNLOCKED</Txt>
        </View>
        <View style={{ flex: 1 }} />
        <IconButton size={HIT} onPress={onSkip} accessibilityLabel="Close">✕</IconButton>
      </View>

      {/* The card slams in, then the stamp lands on its corner */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: cardTop, alignItems: 'center' }}>
        <View style={{ width: cardW + CARD_SHADOW, height: cardH + CARD_SHADOW }}>
          <Animated.View style={{ opacity: v.interpolate({ inputRange: [0, 0.15, 0.35], outputRange: [0, 0, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 0.15, 0.4, 0.55, 1], outputRange: [3, 3, 0.9, 1.06, 1] }) }, { rotate: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: ['-24deg', '2deg', '-4deg'] }) }] }}>
            <BigCard b={b} width={cardW} accent={accent} foil={foil} />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', right: -stamp * 0.42, bottom: -stamp * 0.3, opacity: v.interpolate({ inputRange: [0, 0.55, 0.7], outputRange: [0, 0, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 0.55, 0.75, 1], outputRange: [2.2, 2.2, 0.94, 1] }) }, { rotate: '14deg' }] }}>
            <GetStamp size={stamp} />
          </Animated.View>
        </View>

        <Animated.View style={{ alignSelf: 'stretch', marginTop: stamp * 0.3 + 14, paddingHorizontal: 16, opacity: v.interpolate({ inputRange: [0, 0.7, 0.9], outputRange: [0, 0, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 0.7, 0.9], outputRange: [16, 16, 0] }) }] }}>
          <CoachShout portrait={44} after={more ? 'It landed. And there is more where that came from.' : 'It landed. Now make it a combo.'} />
        </Animated.View>
      </View>

      <Animated.View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 16, right: 16, gap: 6, opacity: v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 1] }) }}>
        <CutButton label={more ? 'Next card' : 'Add to collection'} meta={more ? `${more} more` : undefined} onPress={onNext} />
        {more ? (
          <Tap onPress={onSkip} style={{ height: HIT, alignItems: 'center', justifyContent: 'center' }}>
            <Txt face="label" size={13} color={C.smoke} style={{ textDecorationLine: 'underline' }}>Skip the rest</Txt>
          </Tap>
        ) : null}
      </Animated.View>
    </View>
  );
}
