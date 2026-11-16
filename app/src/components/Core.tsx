import { useEffect, useId, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { useStore } from '../state/store';
import { C, F } from '../lib/theme';

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
 * REI's presence: an ensō in your colour turning slowly around REI's red seal. `alert` draws the
 * ring in vermilion and turns it faster; `speaking` quickens it and lets the seal breathe.
 * Flat colour: no glow.
 */
export function Core({ size, alert = false, speaking = false, color }: { size: number; alert?: boolean; speaking?: boolean; color?: string }) {
  const accent = useStore(s => s.accent);
  const a = alert ? C.alert : (color ?? accent);
  const small = size < 60;

  const ring = useLoop(alert ? 6000 : speaking ? 9000 : 36000);
  const pulse = useLoop(1400, 0, 1, true);
  const layer = { position: 'absolute' as const, width: size, height: size };
  const seal = size * (small ? 0.5 : 0.42);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[layer, { transform: [{ rotate: spin(ring) }] }]}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Circle cx={60} cy={60} r={48} fill="none" stroke={F.line} strokeWidth={small ? 0 : 2} />
          <Circle cx={60} cy={60} r={48} fill="none" stroke={a} strokeWidth={small ? 9 : 7} strokeLinecap="round" strokeDasharray="252 330" transform="rotate(-90 60 60)" />
          {small ? null : <Circle cx={60} cy={60} r={55} fill="none" stroke={a} strokeOpacity={0.55} strokeWidth={1.5} strokeLinecap="round" strokeDasharray="190 400" transform="rotate(-84 60 60)" />}
          {small ? null : <Circle cx={60} cy={60} r={46.5} fill="none" stroke={F.arena} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="88 289" transform="rotate(-30 60 60)" />}
        </Svg>
      </Animated.View>
      <Animated.View style={{ width: seal, height: seal, transform: [{ scale: speaking ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.08] }) : 1 }] }}>
        <Svg width={seal} height={seal} viewBox="0 0 64 64">
          <Path d="M32 4.5 C47 4 59.5 16 59.6 31.5 C59.8 47.5 47.5 59.8 32.2 59.6 C16.5 59.5 4.2 47.6 4.5 32 C4.6 16.5 16.8 4.8 32 4.5 Z" fill={F.seal} />
          {small ? null : <Circle cx={32} cy={32} r={23} fill="none" stroke={F.arena} strokeOpacity={0.4} strokeWidth={1} />}
        </Svg>
      </Animated.View>
    </View>
  );
}

/** One wavy ring: radius 32 rippling `k` times around, as an SVG path. */
function wavePath(amp: number, k: number, phase: number) {
  let d = '';
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * Math.PI * 2, rr = 32 + amp * Math.sin(k * t + phase);
    d += `${i ? 'L' : 'M'}${(50 + rr * Math.cos(t)).toFixed(2)} ${(50 + rr * Math.sin(t)).toFixed(2)}`;
  }
  return d + 'Z';
}

const WAVES: [number, number, number, number][] = [[5, 0, 9000, 0.9], [7, 1, 13000, 0.55], [9, 2, 6000, 0.35]];

function WaveRing({ size, color, k, phase, ms, opacity, amp, dir, small }: { size: number; color: string; k: number; phase: number; ms: number; opacity: number; amp: number; dir: number; small: boolean }) {
  const v = useLoop(ms);
  return (
    <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: spin(v, dir) }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d={wavePath(amp, k, phase)} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={small ? 2.2 : 1} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

/** REI in voice mode: rippling brush rings around a point of rice paper. `active` while listening or speaking. */
export function Wave({ size, active = false, alert = false }: { size: number; active?: boolean; alert?: boolean }) {
  const accent = useStore(s => s.accent);
  const a = alert ? C.alert : accent;
  const small = size < 60;
  const id = 'wave' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const pulse = useLoop(active ? 600 : 3000, 0, 1, true);
  const amp = active ? 6 : 2;
  const inner = size * 0.44;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {WAVES.map(([k, phase, ms, opacity], i) => (
        <WaveRing key={i} size={size} color={a} k={k} phase={phase} ms={active ? ms / 3 : ms} opacity={opacity} amp={amp * (1 - i * 0.18)} dir={i % 2 ? -1 : 1} small={small} />
      ))}
      <Animated.View style={{ width: inner, height: inner, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: active ? [0.95, 1.09] : [1, 1.045] }) }] }}>
        <Svg width={inner} height={inner}>
          <Defs>
            <RadialGradient id={`${id}in`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={a} stopOpacity={0.4} />
              <Stop offset="0.55" stopColor={a} stopOpacity={0.08} />
              <Stop offset="0.72" stopColor={a} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={inner / 2} cy={inner / 2} r={inner / 2} fill={`url(#${id}in)`} />
        </Svg>
      </Animated.View>
      <View style={{ position: 'absolute', width: size * 0.1, height: size * 0.1, borderRadius: size, backgroundColor: F.chalk }} />
    </View>
  );
}
