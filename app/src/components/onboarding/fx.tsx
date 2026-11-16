// The quiet moments of onboarding: the title card between parts, holding to press your seal on
// the vow, the soft flash when it is sealed, the welcome, and the arrival fade inside the app.
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { BrushBar, BrushRule, HankoSeal, PaperTexture } from '../ink';
import { Txt } from '../ui';
import { C, F, RADIUS } from '../../lib/theme';

/** The title card between parts: the page clears to night washi, the part's number and name are set in Mincho over a brush rule, then it lifts. Calls `onSwap` while covered, `onEnd` when gone. */
export function ChapterCard({ n, t, total, acc, bg, onSwap, onEnd }: { n: number; t: string; total: number; acc: string; bg: string; onSwap: () => void; onEnd: () => void }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const swap = setTimeout(onSwap, 380);
    Animated.timing(v, { toValue: 1, duration: 980, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }).start(() => onEnd());
    return () => clearTimeout(swap);
    // Runs once per card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const words = {
    opacity: v.interpolate({ inputRange: [0, 0.22, 0.36, 0.7, 0.86, 1], outputRange: [0, 0, 1, 1, 0, 0] }),
    transform: [{ translateY: v.interpolate({ inputRange: [0, 0.22, 0.36, 1], outputRange: [8, 8, 0, 0] }) }],
  };
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { zIndex: 60 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bg, opacity: v.interpolate({ inputRange: [0, 0.3, 0.72, 1], outputRange: [0, 1, 1, 0] }) }]}>
        <PaperTexture />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 }, words]}>
        <Txt face="mono" raw size={13} lh={1.35} color={acc}>{`Part ${n} of ${total}`}</Txt>
        <Txt face="display" exact size={34} lh={1.2} align="center">{t}</Txt>
        <BrushRule long height={6} color={F.rule} style={{ alignSelf: 'center', width: 160 }} />
      </Animated.View>
    </View>
  );
}

/** A soft wash of rice paper, for the moment the vow is sealed. */
export function Flash({ onEnd }: { onEnd: () => void }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 940, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => onEnd());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 70, backgroundColor: C.text, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]} />;
}

const SEAL_H = 80;

/**
 * Your seal on the vow: press and hold for 1.6 s and the red seal inks in while a brush stroke
 * crosses the card; letting go lets it fade back. With a screen reader, activating it seals
 * straight away (a timed hold isn't possible there).
 */
export function HoldSeal({ acc, onSeal }: { acc: string; onSeal: () => void }) {
  const [v] = useState(() => new Animated.Value(0));
  const [hold, setHold] = useState(0);
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

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPressIn={start} onPressOut={end}
        accessibilityRole="button" accessibilityLabel="Seal your vow" accessibilityHint="Press and hold to seal it"
        accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={done}
        style={{ minHeight: SEAL_H, paddingHorizontal: 16, paddingVertical: 12, gap: 10, justifyContent: 'center', backgroundColor: F.canvas, borderWidth: 1, borderColor: hold > 0 ? F.seal : F.rule, borderRadius: RADIUS.card }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 44, height: 44 }}>
            <HankoSeal size={44} earned={false} icon="check" />
            <View style={{ position: 'absolute', left: 0, top: 0, opacity: hold, transform: [{ scale: 1.25 - 0.25 * hold }] }}>
              <HankoSeal size={44} icon="check" ground={F.canvas} />
            </View>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt face="heading" size={18} lh={1.35}>Hold to seal</Txt>
            <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{hold > 0 ? `Sealing · ${Math.round(hold * 100)}%` : 'Press and hold'}</Txt>
          </View>
        </View>
        <BrushBar pct={hold} color={acc} height={6} />
      </Pressable>
    </View>
  );
}

/** The welcome: the page clears to night washi, your name is set in Mincho over a brush rule, then it hands over to the app. */
export function EnterFx({ name, acc, bg, onEnd }: { name: string; acc: string; bg: string; onEnd: () => void }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.bezier(0.45, 0, 0.25, 1), useNativeDriver: true }).start();
    const t = setTimeout(onEnd, 2450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 80, alignItems: 'center', justifyContent: 'center' }]}>
      {/* The ground comes up and stays: the app's first screen fades in from it (see `Arrival`). */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: bg, opacity: v.interpolate({ inputRange: [0, 0.16, 1], outputRange: [0, 1, 1] }) }]}>
        <PaperTexture />
      </Animated.View>
      <Animated.View
        style={{
          alignSelf: 'stretch', paddingHorizontal: 32, alignItems: 'center', gap: 12,
          opacity: v.interpolate({ inputRange: [0, 0.2, 0.36, 0.72, 0.86, 1], outputRange: [0, 0, 1, 1, 0, 0] }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 0.2, 0.36, 1], outputRange: [10, 10, 0, 0] }) }],
        }}
      >
        <Txt face="mono" raw size={13} lh={1.35} color={acc}>Day one</Txt>
        <Txt face="display" exact size={44} lh={1.15} align="center" fit>{name}</Txt>
        <Animated.View style={{ width: 200, transform: [{ scaleX: v.interpolate({ inputRange: [0, 0.3, 0.5, 1], outputRange: [0, 0, 1, 1] }) }] }}>
          <BrushRule long height={6} color={F.smoke} />
        </Animated.View>
        <Txt face="voice" size={17} lh={1.5} color={F.smoke} align="center">The page is blank. Begin.</Txt>
      </Animated.View>
    </View>
  );
}

let arriving = false;
/** The next app screen to open should play the arrival fade. */
export const markArrival = () => {
  arriving = true;
};

/** Over the first app screen after onboarding: the welcome's ground fades away as REI settles in. */
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
