// The cinematic moments of onboarding: the chapter-card wipe between chapters, the hold-to-seal
// ring, the flash when the pact seals, the dive into the app, and the arrival fade inside it.
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Core } from '../Core';
import { Txt } from '../ui';
import { alpha, C } from '../../lib/theme';
import { Outline, SpeedLines } from './kit';

/** Full-screen manga wipe that shows the next chapter's kanji. Calls `onSwap` mid-wipe, `onEnd` when gone. */
export function ChapterCard({ n, k, t, total, acc, bg, onSwap, onEnd }: { n: number; k: string; t: string; total: number; acc: string; bg: string; onSwap: () => void; onEnd: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const swap = setTimeout(onSwap, 380);
    Animated.timing(v, { toValue: 1, duration: 980, easing: Easing.bezier(0.75, 0, 0.25, 1), useNativeDriver: true }).start(() => onEnd());
    return () => clearTimeout(swap);
    // Runs once per card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const wipe = (lag: number) => ({
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 0.38 + lag, 0.62 + lag, 1], outputRange: [-1.4 * W, 0, 0, 1.4 * W], extrapolate: 'clamp' }) },
      { skewX: '-16deg' },
    ],
  });
  const card = {
    opacity: v.interpolate({ inputRange: [0, 0.26, 0.4, 0.64, 0.82, 1], outputRange: [0, 0, 1, 1, 0, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 0.26, 0.4, 0.64, 0.82, 1], outputRange: [1.35, 1.35, 1, 1, 0.94, 0.94] }) }],
  };
  const panel = { position: 'absolute' as const, top: -H * 0.2, left: -W * 0.4, width: W * 1.8, height: H * 1.4 };
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 60, overflow: 'hidden' }]}>
      <Animated.View style={[panel, { backgroundColor: bg }, wipe(0)]} />
      <Animated.View style={[panel, { backgroundColor: acc, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, wipe(0.05)]}>
        <SpeedLines size={Math.max(W, H) * 1.6} color={C.ink} inner={0.1} outer={0.5} count={90} opacity={0.8} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, card]}>
        <Txt face="jp" size={26} w={500} color={C.ink} ls={0.1}>{`第${n}話`}</Txt>
        <Txt face="jp" size={170} w={500} color={C.ink} lh={1.04}>{k}</Txt>
        <View style={{ backgroundColor: C.ink, paddingHorizontal: 14, paddingVertical: 2, transform: [{ skewX: '-8deg' }] }}>
          <Txt size={28} w={600} color={acc} ls={-0.01}>{t}</Txt>
        </View>
        <Txt face="mono" size={11} w={500} ls={0.3} color={C.ink} style={{ marginTop: 12 }}>{`CHAPTER ${String(n).padStart(2, '0')} / ${total}`}</Txt>
      </Animated.View>
    </View>
  );
}

/** A quick white flash, for the moment the pact seals. */
export function Flash({ onEnd }: { onEnd: () => void }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 990, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => onEnd());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 70, backgroundColor: C.text, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] }) }]} />;
}

/** Press and hold for 1.6 s to seal. Letting go drains it back. */
export function HoldSeal({ acc, onSeal }: { acc: string; onSeal: () => void }) {
  const [v] = useState(() => new Animated.Value(0));
  const [hold, setHold] = useState(0);
  const sealed = useRef(false);
  const [shake] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const id = v.addListener(({ value }) => setHold(value));
    return () => v.removeListener(id);
  }, [v]);
  useEffect(() => {
    if (hold <= 0.05) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [hold > 0.05, shake]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    if (sealed.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    v.stopAnimation(h => {
      Animated.timing(v, { toValue: 1, duration: (1 - h) * 1600, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
        if (!finished || sealed.current) return;
        sealed.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onSeal();
      });
    });
  };
  const end = () => {
    if (sealed.current) return;
    v.stopAnimation(h => Animated.timing(v, { toValue: 0, duration: h * 400, useNativeDriver: false }).start());
  };

  const R = 52, len = 2 * Math.PI * R;
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Outline text="ゴゴゴ" size={40} color={acc} vertical style={{ position: 'absolute', right: 6, top: -6, opacity: hold }} />
      <View style={{ width: 112, height: 112, alignItems: 'center', justifyContent: 'center', transform: [{ scale: 1 + hold * 0.08 }] }}>
        <View pointerEvents="none" style={{ position: 'absolute', opacity: hold }}>
          <SpeedLines size={252} color={acc} inner={0.2} outer={0.48} count={80} />
        </View>
        <Pressable onPressIn={start} onPressOut={end} style={{ width: 112, height: 112, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={112} height={112} style={{ position: 'absolute' }}>
            <Defs>
              <RadialGradient id="sealIn" cx="50%" cy="40%" r="60%">
                <Stop offset="0" stopColor={acc} stopOpacity={0.24} />
                <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity={0.02} />
              </RadialGradient>
            </Defs>
            <Circle cx={56} cy={56} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={4} />
            <Circle cx={56} cy={56} r={R} fill="none" stroke={acc} strokeWidth={4} strokeDasharray={`${len * hold} ${len}`} transform="rotate(-90 56 56)" />
            <Circle cx={56} cy={56} r={47} fill="url(#sealIn)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
          </Svg>
          <View style={{ shadowColor: acc, shadowOpacity: 0.55, shadowRadius: hold * 30, shadowOffset: { width: 0, height: 0 } }}>
            <Animated.View style={{ transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-1.5, 1.5] }) }, { translateY: shake.interpolate({ inputRange: [-1, 1], outputRange: [1, -1] }) }] }}>
              <Txt face="jp" size={40} w={500} color={acc}>誓</Txt>
            </Animated.View>
          </View>
        </Pressable>
      </View>
      <Txt face="mono" size={11} ls={0.2} color={C.muted}>{hold > 0 ? `SEALING · ${Math.round(hold * 100)}%` : 'HOLD TO SEAL · 長押し'}</Txt>
    </View>
  );
}

/** The dive into REI: the core rises, greets them by name, then swallows the screen. */
export function EnterFx({ name, acc, bg, onEnd }: { name: string; acc: string; bg: string; onEnd: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.bezier(0.45, 0, 0.25, 1), useNativeDriver: true }).start();
    const t = setTimeout(onEnd, 2450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dive = Math.hypot(W, H) * 1.1;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 80, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(bg, 0.92), opacity: v.interpolate({ inputRange: [0, 0.26, 1], outputRange: [0, 1, 1] }) }]} />
      <Animated.View
        style={{
          zIndex: 3,
          opacity: v.interpolate({ inputRange: [0, 0.06, 0.36, 1], outputRange: [0, 0, 1, 1] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 0.06, 0.36, 0.74, 1], outputRange: [0.35, 0.35, 1, 1.1, 9] }) }],
        }}
      >
        <Core size={130} color={acc} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 150, alignItems: 'center', gap: 6, zIndex: 4,
          opacity: v.interpolate({ inputRange: [0, 0.24, 0.4, 0.68, 0.84, 1], outputRange: [0, 0, 1, 1, 0, 0] }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 0.24, 0.4, 0.68, 0.84, 1], outputRange: [12, 12, 0, 0, -8, -8] }) }],
        }}
      >
        <Txt size={28} w={600} ls={-0.03}>{`Welcome, ${name}.`}</Txt>
        <Txt size={14} color={C.sub}>Day one starts now.</Txt>
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute', width: dive, height: dive, borderRadius: dive / 2, backgroundColor: bg, zIndex: 6,
          transform: [{ scale: v.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0, 0, 1] }) }],
        }}
      />
    </View>
  );
}

let arriving = false;
/** The next app screen to open should play the arrival fade. */
export const markArrival = () => {
  arriving = true;
};

/** Over the first app screen after onboarding: the dive's colour fades away as REI settles in. */
export function Arrival({ bg = '#050608' }: { bg?: string }) {
  const [show] = useState(() => {
    const a = arriving;
    arriving = false;
    return a;
  });
  const [v] = useState(() => new Animated.Value(0));
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!show) return;
    Animated.timing(v, { toValue: 1, duration: 1100, delay: 150, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }).start(() => setDone(true));
  }, [show, v]);
  if (!show || done) return null;
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 300, backgroundColor: bg, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} />;
}
