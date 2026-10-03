import { useEffect, useId, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { useStore } from '../state/store';
import { C } from '../lib/theme';

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

/** The soft breathing glow behind every REI orb. */
function Glow({ size, color, id }: { size: number; color: string; id: string }) {
  const breath = useLoop(4800, 0, 1, true);
  const glow = size * 1.6;
  return (
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
          <RadialGradient id={`${id}glow`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.26} />
            <Stop offset="0.62" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill={`url(#${id}glow)`} />
      </Svg>
    </Animated.View>
  );
}

const INK = '#07090C';
const COMMA = 'M50 31.4 A18.6 18.6 0 0 0 37.7 41.4 A12 12 0 0 1 50 40.6 A4.6 4.6 0 0 0 50 31.4Z';

/**
 * REI's core: three tomoe turning inside a glowing disc, ringed by slow HUD dashes.
 * `alert` turns it red and spins it hard; `speaking` speeds it up and pulses the centre.
 */
export function Core({ size, alert = false, speaking = false, color }: { size: number; alert?: boolean; speaking?: boolean; color?: string }) {
  const accent = useStore(s => s.accent);
  const a = alert ? C.alert : (color ?? accent);
  const small = size < 60;
  // SVG ids can't contain the colons useId produces.
  const id = 'core' + useId().replace(/[^a-zA-Z0-9]/g, '');

  const rings = useLoop(48000);
  const tomoe = useLoop(alert ? 900 : speaking ? 1600 : 9000);
  const pulse = useLoop(700, 0, 1, true);
  const r = small ? 36 : 32;
  const layer = { position: 'absolute' as const, width: size, height: size };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Glow size={size} color={a} id={id} />

      {small ? null : (
        <Animated.View style={[layer, { transform: [{ rotate: spin(rings) }] }]}>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Circle cx={50} cy={50} r={48.5} fill="none" stroke={a} strokeOpacity={0.4} strokeWidth={0.5} strokeDasharray="0.6 2.2" />
            <Circle cx={50} cy={50} r={44} fill="none" stroke={a} strokeOpacity={0.6} strokeWidth={0.6} strokeDasharray="22 7 3 7" />
          </Svg>
        </Animated.View>
      )}

      <View style={layer}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`${id}disc`} cx="50%" cy="45%" r="55%">
              <Stop offset="0" stopColor={a} />
              <Stop offset="0.7" stopColor={a} />
              <Stop offset="1" stopColor={a} stopOpacity={0.55} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={r} fill={`url(#${id}disc)`} stroke={INK} strokeWidth={small ? 3 : 1.6} />
          <Circle cx={50} cy={50} r={r} fill="none" stroke={a} strokeWidth={small ? 2.4 : 1} strokeOpacity={0.9} />
          <Circle cx={50} cy={50} r={14} fill="none" stroke={INK} strokeOpacity={0.55} strokeWidth={small ? 1.6 : 0.8} />
        </Svg>
      </View>

      <Animated.View style={[layer, { transform: [{ rotate: spin(tomoe) }] }]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {[0, 120, 240].map(d => <Path key={d} d={COMMA} fill={INK} transform={`rotate(${d} 50 50)`} />)}
        </Svg>
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute', width: size * (small ? 0.13 : 0.112), height: size * (small ? 0.13 : 0.112), borderRadius: size, backgroundColor: INK,
          transform: [{ scale: speaking ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.09] }) : 1 }],
        }}
      />

      {small ? null : (
        <View style={layer} pointerEvents="none">
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Ellipse cx={40} cy={36} rx={5} ry={3} fill="#FFFFFF" fillOpacity={0.35} transform="rotate(-30 40 36)" />
          </Svg>
        </View>
      )}
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

/** REI in voice mode: rippling rings around a bright point. `active` while listening or speaking. */
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
      <Glow size={size} color={a} id={id} />
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
      <View style={{ position: 'absolute', width: size * 0.1, height: size * 0.1, borderRadius: size, backgroundColor: '#FFFFFF', shadowColor: a, shadowOpacity: 1, shadowRadius: size * 0.1, shadowOffset: { width: 0, height: 0 } }} />
    </View>
  );
}
