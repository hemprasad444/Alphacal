import { useEffect, useId, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useStore } from '../state/store';
import { C, mix } from '../lib/theme';

function useLoop(duration: number, from = 0, to = 1, yoyo = false) {
  const [v] = useState(() => new Animated.Value(from));
  useEffect(() => {
    v.setValue(from);
    const anim = yoyo
      ? Animated.loop(Animated.sequence([
          Animated.timing(v, { toValue: to, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: from, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]))
      : Animated.loop(Animated.timing(v, { toValue: to, duration, easing: Easing.linear, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [v, duration, from, to, yoyo]);
  return v;
}

const spin = (v: Animated.Value, dir = 1) => v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 * dir}deg`] });

/**
 * REI's core: spinning HUD rings around a glowing pupil.
 * `alert` turns it red; `speaking` speeds it up.
 */
export function Core({ size, alert = false, speaking = false }: { size: number; alert?: boolean; speaking?: boolean }) {
  const accent = useStore(s => s.accent);
  const a = alert ? C.alert : accent;
  const small = size < 60;
  // SVG ids can't contain the colons useId produces.
  const id = 'core' + useId().replace(/[^a-zA-Z0-9]/g, '');

  const outer = useLoop(48000);
  const inner = useLoop(speaking ? 5000 : 16000);
  const breath = useLoop(4800, 0, 1, true);
  const pulse = useLoop(speaking ? 800 : 3400, 0, 1, true);

  const glow = size * 1.6;
  const pupil = size * 0.4;
  const particles = small ? [] : Array.from({ length: 7 }, (_, i) => i);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', width: glow, height: glow,
          opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }],
        }}
      >
        <Svg width={glow} height={glow}>
          <Defs>
            <RadialGradient id={`${id}g`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={a} stopOpacity={0.24} />
              <Stop offset="0.62" stopColor={a} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill={`url(#${id}g)`} />
        </Svg>
      </Animated.View>

      <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: spin(outer) }] }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={48.5} fill="none" stroke={a} strokeOpacity={0.4} strokeWidth={small ? 1.2 : 0.5} strokeDasharray={small ? '2 4' : '0.6 2.2'} />
          <Circle cx={50} cy={50} r={43} fill="none" stroke={a} strokeOpacity={0.75} strokeWidth={small ? 2 : 0.7} strokeDasharray="22 7 3 7" />
        </Svg>
      </Animated.View>

      <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: spin(inner, -1) }] }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={36} fill="none" stroke={a} strokeWidth={small ? 3 : 1.4} strokeLinecap="round" strokeDasharray="56 170" />
          <Circle cx={50} cy={50} r={36} fill="none" stroke={a} strokeOpacity={0.5} strokeWidth={small ? 3 : 1.4} strokeLinecap="round" strokeDasharray="6 220" strokeDashoffset={-110} />
        </Svg>
      </Animated.View>

      <Animated.View
        style={{
          width: pupil, height: pupil, borderRadius: pupil / 2,
          shadowColor: a, shadowOpacity: 0.6, shadowRadius: size * 0.11, shadowOffset: { width: 0, height: 0 },
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: speaking ? [0.95, 1.09] : [1, 1.045] }) }],
        }}
      >
        <Svg width={pupil} height={pupil}>
          <Defs>
            <RadialGradient id={`${id}c`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="0.09" stopColor={a} />
              <Stop offset="0.34" stopColor={mix(a, '#05080A', 0.3)} />
              <Stop offset="0.72" stopColor="#05080A" />
            </RadialGradient>
          </Defs>
          <Circle cx={pupil / 2} cy={pupil / 2} r={pupil / 2 - 0.5} fill={`url(#${id}c)`} stroke={a} strokeOpacity={0.55} strokeWidth={1} />
        </Svg>
      </Animated.View>

      {particles.map(i => <Particle key={i} i={i} size={size} color={a} />)}
    </View>
  );
}

function Particle({ i, size, color }: { i: number; size: number; color: string }) {
  const v = useLoop(7000 + i * 2100);
  const r = size * 0.5 + (i % 3) * 6;
  // Start each particle at a different point on its orbit.
  const start = (i * 1.9) / (7 + i * 2.1);
  const rot = v.interpolate({ inputRange: [0, 1], outputRange: [`${start * 360}deg`, `${start * 360 + 360}deg`] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 2, height: 2, transform: [{ rotate: rot }, { translateX: r }] }}>
      <View style={{ width: 2, height: 2, borderRadius: 2, backgroundColor: color, opacity: 0.4 + (i % 3) * 0.2, shadowColor: color, shadowOpacity: 1, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } }} />
    </Animated.View>
  );
}
