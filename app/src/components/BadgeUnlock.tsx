// The unlock moment: the medal slams in with a chime, a stamp lands. One badge at a time.
import type { GameBadge } from '@rei/shared';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, View } from 'react-native';
import { Medal, Stamp, TIER } from './manga';
import { Tap, Txt } from './ui';
import { alpha, C } from '../lib/theme';

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

function Burst({ b, more, onNext, onSkip }: { b: GameBadge; more: number; onNext: () => void; onSkip: () => void }) {
  const col = TIER[b.tier];
  const [v] = useState(() => new Animated.Value(0));
  const chime = useAudioPlayer(require('../../assets/sounds/unlock.wav'));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // The chime and the buzz land with the medal (a third of the way in).
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
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,6,8,0.94)', alignItems: 'center', justifyContent: 'center' }]}>
      <Animated.View style={{ opacity: v.interpolate({ inputRange: [0, 0.15, 0.35], outputRange: [0, 0, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 0.15, 0.4, 0.55, 1], outputRange: [3, 3, 0.9, 1.06, 1] }) }, { rotate: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: ['-30deg', '6deg', '0deg'] }) }] }}>
        <View style={{ borderRadius: 75, shadowColor: col, shadowOpacity: 0.8, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } }}>
          <Medal icon={b.icon} tier={b.tier} earned size={150} />
        </View>
      </Animated.View>
      <Animated.View style={{ marginTop: 34, opacity: v.interpolate({ inputRange: [0, 0.45, 0.6], outputRange: [0, 0, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 0.45, 0.6, 0.7], outputRange: [2.4, 2.4, 0.92, 1] }) }] }}>
        <Stamp text="Badge unlocked" color={col} size={13} tilt={-5} />
      </Animated.View>
      <Animated.View style={{ alignItems: 'center', gap: 8, marginTop: 22, paddingHorizontal: 32, opacity: v.interpolate({ inputRange: [0, 0.6, 0.85], outputRange: [0, 0, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 0.6, 0.85], outputRange: [16, 16, 0] }) }] }}>
        <Txt size={32} w={600} ls={-0.02} align="center">{b.title}</Txt>
        <Txt size={15} color={C.sub} align="center">{b.desc}</Txt>
        <Txt face="mono" size={10} ls={0.18} color={col} style={{ marginTop: 4 }}>{`${b.tier.toUpperCase()} BADGE`}</Txt>
      </Animated.View>
      <Animated.View style={{ position: 'absolute', bottom: 56, left: 24, right: 24, gap: 12, opacity: v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0, 1] }) }}>
        <Tap onPress={onNext} style={{ height: 54, borderRadius: 14, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={17} w={600} color={C.ink}>{more ? `Next · ${more} more` : 'Let’s go'}</Txt>
        </Tap>
        {more ? (
          <Tap onPress={onSkip} style={{ height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: alpha(col, 0.4) }}>
            <Txt size={14} color={C.body}>Skip the rest</Txt>
          </Tap>
        ) : null}
      </Animated.View>
    </View>
  );
}
