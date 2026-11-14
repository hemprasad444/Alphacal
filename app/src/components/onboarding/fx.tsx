// The big moments of onboarding: the round card between rounds, holding to sign the contract, the
// flash when it is signed, the walk out to the ring, and the arrival fade inside the app.
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { CutBox, cutPoints, useSize } from '../cut';
import { Icon } from '../icons';
import { Txt } from '../ui';
import { C, CUT, cutDx, F, onColor, SHADOW } from '../../lib/theme';

/** The round card: a slanted wipe in your colour carrying the next round's number and name. Calls `onSwap` mid-wipe, `onEnd` when gone. */
export function ChapterCard({ n, t, total, acc, bg, onSwap, onEnd }: { n: number; t: string; total: number; acc: string; bg: string; onSwap: () => void; onEnd: () => void }) {
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
      { translateX: v.interpolate({ inputRange: [0, 0.38 + lag, 0.62 + lag, 1], outputRange: [-1.5 * W, 0, 0, 1.5 * W], extrapolate: 'clamp' }) },
      { skewX: `-${CUT}deg` },
    ],
  });
  const card = {
    opacity: v.interpolate({ inputRange: [0, 0.26, 0.4, 0.64, 0.82, 1], outputRange: [0, 0, 1, 1, 0, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 0.26, 0.4, 0.64, 0.82, 1], outputRange: [1.35, 1.35, 1, 1, 0.94, 0.94] }) }],
  };
  const panel = { position: 'absolute' as const, top: -H * 0.2, left: -W * 0.45, width: W * 1.9, height: H * 1.4 };
  const ink = onColor(acc);
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { zIndex: 60, overflow: 'hidden' }]}>
      <Animated.View style={[panel, { backgroundColor: F.chalk }, wipe(0)]} />
      <Animated.View style={[panel, { backgroundColor: acc }, wipe(0.05)]} />
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }, card]}>
        <Txt face="labelItalic" w={600} size={20} ls={0.3} color={ink}>ROUND</Txt>
        <Txt face="display" size={168} lh={1.05} color={ink}>{String(n).padStart(2, '0')}</Txt>
        <Txt face="label" w={600} size={14} ls={0.2} color={ink}>{`OF ${total}`}</Txt>
        <CutBox fill={bg} shadow={F.chalk} style={{ marginTop: 18, minHeight: 52, paddingHorizontal: 28, justifyContent: 'center' }}>
          <Txt face="display" lean={false} size={30} lh={1.2} ls={0.02} color={acc}>{t}</Txt>
        </CutBox>
      </Animated.View>
    </View>
  );
}

/** A quick chalk flash, for the moment the contract is signed. */
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

const SEAL_H = 72;

/**
 * The signature slab: press and hold for 1.6 s and your colour inks across it; letting go drains
 * it back. With a screen reader, activating it signs straight away (a timed hold isn't possible there).
 */
export function HoldSeal({ acc, onSeal }: { acc: string; onSeal: () => void }) {
  const [v] = useState(() => new Animated.Value(0));
  const [hold, setHold] = useState(0);
  const [size, onLayout] = useSize();
  const sealed = useRef(false);
  useEffect(() => {
    const id = v.addListener(({ value }) => setHold(value));
    return () => v.removeListener(id);
  }, [v]);

  const done = () => {
    if (sealed.current) return;
    sealed.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSeal();
  };
  const start = () => {
    if (sealed.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    v.stopAnimation(h => {
      Animated.timing(v, { toValue: 1, duration: (1 - h) * 1600, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
        if (finished) done();
      });
    });
  };
  const end = () => {
    if (sealed.current) return;
    v.stopAnimation(h => Animated.timing(v, { toValue: 0, duration: h * 400, useNativeDriver: false }).start());
  };

  const w = size?.w ?? 0, dx = cutDx(SEAL_H);
  // The ink's leading edge, measured at the middle of the slab (the edge itself is cut).
  const inkW = hold > 0 ? dx + (w - dx) * hold : 0;
  const words = (color: string) => (
    <View style={{ width: w, height: SEAL_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <Icon name="scroll" size={24} color={color} tint={0} strokeWidth={2.2} />
      <Txt face="display" lean={false} size={26} lh={1.2} ls={0.03} color={color}>HOLD TO SIGN</Txt>
    </View>
  );
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPressIn={start} onPressOut={end}
        accessibilityRole="button" accessibilityLabel="Sign the contract" accessibilityHint="Press and hold to sign"
        accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={done}
        style={{ paddingRight: SHADOW, paddingBottom: SHADOW }}
      >
        <View onLayout={onLayout} style={{ height: SEAL_H, transform: hold > 0 ? [{ translateX: SHADOW / 2 }, { translateY: SHADOW / 2 }] : undefined }}>
          {size ? (
            <>
              <Svg width={w + SHADOW} height={SEAL_H + SHADOW} style={{ position: 'absolute', left: 0, top: 0 }}>
                {hold > 0 ? null : <Polygon points={cutPoints(w, SEAL_H, { ox: SHADOW, oy: SHADOW })} fill={F.chalk} />}
                <Polygon points={cutPoints(w, SEAL_H, { inset: 1 })} fill={F.canvas} stroke={acc} strokeWidth={2} />
                {inkW > 0 ? <Polygon points={cutPoints(inkW, SEAL_H, { inset: 2 })} fill={acc} /> : null}
              </Svg>
              {words(F.chalk)}
              {/* The same words in ink, shown only where your colour has reached. */}
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, height: SEAL_H, width: Math.max(0, inkW - dx / 2), overflow: 'hidden' }}>
                {words(onColor(acc))}
              </View>
            </>
          ) : null}
        </View>
      </Pressable>
      <Txt face="label" w={600} size={12} ls={0.14} color={F.smoke} align="center">{hold > 0 ? `SIGNING · ${Math.round(hold * 100)}%` : 'YOUR SIGNATURE · PRESS AND HOLD'}</Txt>
    </View>
  );
}

/** The walk out: the arena goes dark, your lights sweep across, the announcer calls your name, then the cut to the app. */
export function EnterFx({ name, acc, bg, onEnd }: { name: string; acc: string; bg: string; onEnd: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.bezier(0.45, 0, 0.25, 1), useNativeDriver: true }).start();
    const t = setTimeout(onEnd, 2450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const band = (width: number, from: number, to: number, opacity: number) => (
    <Animated.View
      style={{
        position: 'absolute', top: -H * 0.2, left: 0, width, height: H * 1.4, backgroundColor: acc, opacity,
        transform: [{ translateX: v.interpolate({ inputRange: [0, from, to, 1], outputRange: [-W * 0.8, -W * 0.8, W * 1.6, W * 1.6] }) }, { skewX: `-${CUT}deg` }],
      }}
    />
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 80, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bg, opacity: v.interpolate({ inputRange: [0, 0.16, 1], outputRange: [0, 1, 1] }) }]} />
      {band(W * 0.34, 0.1, 0.52, 0.22)}
      {band(W * 0.08, 0.16, 0.6, 0.9)}
      {band(W * 0.03, 0.22, 0.66, 0.9)}
      <Animated.View
        style={{
          alignSelf: 'stretch', paddingHorizontal: 16, alignItems: 'center', gap: 6,
          opacity: v.interpolate({ inputRange: [0, 0.2, 0.34, 0.7, 0.8, 1], outputRange: [0, 0, 1, 1, 0, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 0.2, 0.34, 0.7, 1], outputRange: [1.3, 1.3, 1, 1.04, 1.04] }) }],
        }}
      >
        <Txt face="labelItalic" w={600} size={15} ls={0.24} color={acc}>NOW ENTERING THE RING</Txt>
        <Txt face="display" size={76} lh={1.1} align="center" fit>{name.toUpperCase()}</Txt>
        <Txt face="label" w={600} size={15} ls={0.16} color={F.smoke}>DAY ONE · FIRST BELL</Txt>
      </Animated.View>
      {/* The cut to the app: the arena colour wipes across and stays. */}
      <Animated.View
        style={{
          position: 'absolute', top: -H * 0.2, left: -W * 0.45, width: W * 1.9, height: H * 1.4, backgroundColor: acc,
          transform: [{ translateX: v.interpolate({ inputRange: [0, 0.72, 0.94, 1], outputRange: [-2 * W, -2 * W, 0, 0] }) }, { skewX: `-${CUT}deg` }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute', top: -H * 0.2, left: -W * 0.45, width: W * 1.9, height: H * 1.4, backgroundColor: bg,
          transform: [{ translateX: v.interpolate({ inputRange: [0, 0.78, 1], outputRange: [-2 * W, -2 * W, 0] }) }, { skewX: `-${CUT}deg` }],
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

/** Over the first app screen after onboarding: the walkout's colour fades away as REI settles in. */
export function Arrival({ bg = F.arena }: { bg?: string }) {
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
