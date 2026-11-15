// The unlock moment: "NEW SPECIAL MOVE UNLOCKED". A super flash, the card slams in with a chime,
// REI calls it from the corner. One badge at a time.
import type { GameBadge } from '@rei/shared';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { G, Polygon, Rect } from 'react-native-svg';
import { CoachShout, CutButton, MoveCardArt, RoundStamp, useTierColors } from './fight';
import { Tap, Txt } from './ui';
import { C, HIT, onColor } from '../lib/theme';
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

const BAND = 48, BAND_TILT = 6;
// Twelve flat wedges radiating from the card: alternately your colour and chalk.
const WEDGES = ['0,0 600,0 591,104', '0,0 520,300 460,386', '0,0 300,520 205,564', '0,0 0,600 -104,591', '0,0 -300,520 -386,460', '0,0 -520,300 -564,205', '0,0 -600,0 -591,-104', '0,0 -520,-300 -460,-386', '0,0 -300,-520 -205,-564', '0,0 0,-600 104,-591', '0,0 300,-520 386,-460', '0,0 520,-300 564,-205'];

function Burst({ b, more, onNext, onSkip }: { b: GameBadge; more: number; onNext: () => void; onSkip: () => void }) {
  const col = useTierColors()[b.tier];
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

  const drop = W * Math.tan((BAND_TILT * Math.PI) / 180);
  const bandTop = insets.top + 28;
  const cardW = Math.min(168, H * 0.2), cardH = (cardW * 60) / 52;
  const stackTop = bandTop + drop + BAND + 34;
  const cy = stackTop + cardH / 2;

  return (
    <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, { backgroundColor: C.arena }]}>
      {/* Super flash */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: v.interpolate({ inputRange: [0, 0.25, 0.5], outputRange: [0, 0, 1] }) }]}>
        <Svg width={W} height={H}>
          <G transform={`translate(${W / 2} ${cy}) rotate(-18)`}>
            {WEDGES.map((p, i) => <Polygon key={i} points={p} fill={i % 2 ? C.chalk : accent} opacity={i % 2 ? 0.07 : 0.2} />)}
          </G>
          <Rect x={0} y={cy - 60} width={56} height={4} fill={accent} />
          <Rect x={0} y={cy - 44} width={32} height={4} fill={accent} />
          <Rect x={0} y={cy + 44} width={44} height={4} fill={C.chalk} />
          <Rect x={W - 56} y={cy - 36} width={56} height={4} fill={accent} />
          <Rect x={W - 32} y={cy - 20} width={32} height={4} fill={accent} />
          <Rect x={W - 44} y={cy + 60} width={44} height={4} fill={C.chalk} />
        </Svg>
      </Animated.View>

      {/* Announcement bands: rival behind, your colour in front */}
      <Animated.View style={{ position: 'absolute', left: 0, top: bandTop, width: W, height: drop + BAND + 8, transform: [{ translateX: v.interpolate({ inputRange: [0, 0.3], outputRange: [-W, 0], extrapolate: 'clamp' }) }] }}>
        <Svg width={W} height={drop + BAND + 8}>
          <Polygon points={`0,${drop + 8} ${W},8 ${W},${BAND + 8} 0,${drop + BAND + 8}`} fill={C.rival} />
          <Polygon points={`0,${drop} ${W},0 ${W},${BAND} 0,${drop + BAND}`} fill={accent} />
        </Svg>
        <View accessibilityRole="header" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: drop + BAND, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
          <Txt face="display" lean={false} size={24} ls={0.06} color={onColor(accent)} fit style={{ transform: [{ rotate: `-${BAND_TILT}deg` }, { skewX: '-10deg' }] }}>NEW SPECIAL MOVE UNLOCKED</Txt>
        </View>
      </Animated.View>

      {/* The card slams in */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: stackTop, alignItems: 'center', paddingHorizontal: 24 }}>
        <Animated.View style={{ opacity: v.interpolate({ inputRange: [0, 0.15, 0.35], outputRange: [0, 0, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 0.15, 0.4, 0.55, 1], outputRange: [3, 3, 0.9, 1.06, 1] }) }, { rotate: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: ['-24deg', '5deg', '0deg'] }) }] }}>
          <MoveCardArt tier={b.tier} earned icon={b.icon} width={cardW} />
        </Animated.View>

        <Animated.View style={{ alignSelf: 'stretch', alignItems: 'center', marginTop: 14, gap: 8, opacity: v.interpolate({ inputRange: [0, 0.5, 0.75], outputRange: [0, 0, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 0.5, 0.75], outputRange: [16, 16, 0] }) }] }}>
          <Txt face="display" size={52} lh={1.12} ls={0.015} align="center" fit>{b.title.toUpperCase()}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <RoundStamp label={b.tier} size="sm" />
            <Txt face="label" w={600} size={13} ls={0.12} color={col}>SPECIAL MOVE</Txt>
          </View>
          <Txt size={15} w={500} lh={1.4} color={C.chalk} align="center">{b.desc}</Txt>
        </Animated.View>

        <Animated.View style={{ alignSelf: 'stretch', marginTop: 18, opacity: v.interpolate({ inputRange: [0, 0.7, 0.9], outputRange: [0, 0, 1] }) }}>
          <CoachShout portrait={44} after={more ? 'It landed. And there is more where that came from.' : 'It landed. Now make it a combo.'} />
        </Animated.View>
      </View>

      <Animated.View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 24, right: 24, gap: 6, opacity: v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 1] }) }}>
        <CutButton label={more ? 'Next move' : 'Back to the fight'} meta={more ? `${more} more` : undefined} onPress={onNext} />
        {more ? (
          <Tap onPress={onSkip} style={{ height: HIT, alignItems: 'center', justifyContent: 'center' }}>
            <Txt face="label" w={600} size={13} ls={0.12} color={C.smoke}>SKIP THE REST</Txt>
          </Tap>
        ) : null}
      </Animated.View>
    </View>
  );
}
