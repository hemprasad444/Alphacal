// Building blocks for the onboarding (the pre-fight training camp) and sign-in, in the Fight Night
// system: the page behind them, the call to action and the answer controls. The world is still
// being chosen here, so its colour is passed down as `acc` instead of read from the store.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line, Polygon, Rect } from 'react-native-svg';
import { CutBox, CutShape } from '../cut';
import { CutButton, SectionHeader } from '../fight';
import { Icon, type IconKey } from '../icons';
import { Tap, Txt } from '../ui';
import { C, F, fontFamily, hard, HIT, onColor, SP } from '../../lib/theme';
import { useStore } from '../../state/store';

/** Fades and lifts its children in after `delay` ms. */
export function Rise({ delay = 0, children, style, from = 14 }: { delay?: number; children: ReactNode; style?: StyleProp<ViewStyle>; from?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 450, delay, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [v, delay]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>{children}</Animated.View>;
}

/**
 * The page behind sign-in and the rounds: the arena with the two lights, flat. Your corner's
 * colour leans in from the top, the far corner's red from the bottom right.
 */
export function Atmosphere({ acc }: { acc: string; acc2?: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <Polygon points="250,0 330,0 56,844 -24,844" fill={acc} opacity={0.05} />
        <Polygon points="342,0 352,0 78,844 68,844" fill={acc} opacity={0.14} />
        <Polygon points="560,0 640,0 366,844 286,844" fill={F.rival} opacity={0.06} />
      </Svg>
    </View>
  );
}

/** The screen's one primary action: the cut slab in the chosen world's colour. */
export function Cta({ label, onPress, acc, disabled, icon }: { label: string; onPress: () => void; acc: string; disabled?: boolean; icon?: IconKey }) {
  return <CutButton label={label} icon={icon} onPress={onPress} disabled={disabled} accent={acc} />;
}

/** The heading above an answer: cut tab, leaning label, a quiet note on the right. */
export function FieldLabel({ label, right, acc }: { label: string; right?: string; acc: string }) {
  if (!label && !right) return null;
  return <SectionHeader title={label} meta={right} accent={acc} style={{ marginBottom: SP.sm }} />;
}

/** A choice tile: canvas with a rope border; chosen, it takes your colour and its hard shadow. */
export const tile = (on: boolean, acc: string): ViewStyle => ({
  borderWidth: 2,
  borderColor: on ? acc : F.rope,
  backgroundColor: on ? F.canvas2 : F.canvas,
  ...(on ? hard(acc) : null),
});

/** The tick on a chosen tile: a cut tab, filled when picked. */
export function Picked({ on, acc }: { on: boolean; acc: string }) {
  return (
    <View style={{ width: 24, height: 18 }}>
      <CutShape width={24} height={18} fill={on ? acc : F.arena} stroke={on ? undefined : F.rope} />
      {on ? (
        <View style={{ position: 'absolute', left: 0, top: 0, width: 24, height: 18, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={13} color={onColor(acc)} tint={0} strokeWidth={3} />
        </View>
      ) : null}
    </View>
  );
}

/** A segmented row: one choice. */
export function Seg<T extends string | number>({ value, opts, onPick, acc }: { value: T; opts: [T, string, string?][]; onPick: (v: T) => void; acc: string }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', borderWidth: 2, borderColor: F.rope, backgroundColor: F.arena }}>
      {opts.map(([v, label, sub]) => {
        const on = v === value, ink = on ? onColor(acc) : F.smoke;
        return (
          <Tap
            key={String(v)} onPress={() => onPick(v)}
            accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={sub ? `${label}, ${sub}` : label}
            style={{ flex: 1, minHeight: HIT, alignItems: 'center', justifyContent: 'center', paddingVertical: SP.xs, paddingHorizontal: 2, backgroundColor: on ? acc : 'transparent' }}
          >
            <Txt face="label" w={600} size={15} ls={0.05} color={ink} numberOfLines={1}>{label.toUpperCase()}</Txt>
            {sub ? <Txt face="label" size={12} ls={0.05} color={ink} numberOfLines={1}>{sub.toUpperCase()}</Txt> : null}
          </Tap>
        );
      })}
    </View>
  );
}

/** Wrapping cut chips: one choice or several, the caller decides. */
export function Chips({ opts, isOn, onPick, acc }: { opts: string[]; isOn: (o: string) => boolean; onPick: (o: string) => void; acc: string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
      {opts.map(o => {
        const on = isOn(o);
        return (
          <Tap key={o} onPress={() => onPick(o)} accessibilityLabel={o} accessibilityState={{ selected: on }}>
            <CutBox fill={on ? acc : F.canvas} stroke={on ? undefined : F.rope} style={{ minHeight: HIT, paddingHorizontal: 20, justifyContent: 'center' }}>
              <Txt size={14.5} w={600} color={on ? onColor(acc) : C.body}>{o}</Txt>
            </CutBox>
          </Tap>
        );
      })}
    </View>
  );
}

/** A square − / + button, 44pt. */
function StepButton({ sign, label, onPress, wide }: { sign: '−' | '+'; label: string; onPress: () => void; wide?: boolean }) {
  return (
    <Tap onPress={onPress} accessibilityLabel={`${sign === '+' ? 'Increase' : 'Decrease'} ${label}`} style={{ width: wide ? undefined : HIT, flex: wide ? 1 : undefined, height: HIT, borderWidth: 2, borderColor: F.rope, backgroundColor: F.arena, alignItems: 'center', justifyContent: 'center' }}>
      <Txt size={22} w={600} lh={1.15} color={F.chalk}>{sign}</Txt>
    </Tap>
  );
}

/**
 * Number tiles with − / + steppers. One on its own is a row (− value +); several sit two-up, each
 * with its number on top and the two buttons side by side underneath, so the number never squeezes.
 */
export function Nums({ items }: { items: { label: string; unit?: string; value: string; minus: () => void; plus: () => void }[] }) {
  const solo = items.length === 1;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
      {items.map(o => {
        const name = o.label.toLowerCase();
        const value = <Txt face="display" lean={false} size={solo ? 30 : 28} lh={1.2} color={o.value === '—' ? F.smoke : F.chalk} numberOfLines={1}>{o.value}</Txt>;
        return (
          <View key={o.label} style={{ width: '48%', flexGrow: 1, padding: SP.md, gap: SP.sm, backgroundColor: F.canvas }}>
            <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} numberOfLines={1}>{o.unit ? `${o.label} · ${o.unit.toUpperCase()}` : o.label}</Txt>
            {solo ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
                <StepButton sign="−" label={name} onPress={o.minus} />
                <View style={{ flex: 1, alignItems: 'center' }}>{value}</View>
                <StepButton sign="+" label={name} onPress={o.plus} />
              </View>
            ) : (
              <>
                {value}
                <View style={{ flexDirection: 'row', gap: SP.sm }}>
                  <StepButton sign="−" label={name} onPress={o.minus} wide />
                  <StepButton sign="+" label={name} onPress={o.plus} wide />
                </View>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** A value on a draggable ruler: drag left or right, or tap − / +. */
export function Scrub({ label, unit, value, step, min, max, dp, onChange, acc }: { label: string; unit: string; value: number; step: number; min: number; max: number; dp: number; onChange: (v: number) => void; acc: string }) {
  const clamp = (x: number) => +Math.min(max, Math.max(min, Math.round(x / step) * step)).toFixed(dp);
  const start = useRef(value);
  const cur = useRef({ value, onChange });
  useEffect(() => {
    cur.current = { value, onChange };
  });
  // The refs are read when the finger moves, not while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start.current = cur.current.value;
      },
      onPanResponderMove: (_, g) => cur.current.onChange(clamp(start.current - (g.dx / 8) * step)),
    }),
  );
  const W = 320, H = 28, offset = ((value - min) / step) * 8;
  const ticks = [];
  for (let i = -24; i <= 24; i++) {
    const n = Math.round((value - min) / step) + i;
    const x = W / 2 + n * 8 - offset;
    if (x < 0 || x > W || n < 0 || n > Math.round((max - min) / step)) continue;
    ticks.push(<Line key={i} x1={x} x2={x} y1={n % 10 === 0 ? 4 : 12} y2={H} stroke={n % 10 === 0 ? F.chalk : F.rope} strokeWidth={2} />);
  }
  return (
    <View
      accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: `${value.toFixed(dp)} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))}
      style={{ padding: SP.md, gap: SP.sm, backgroundColor: F.canvas }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
        <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} style={{ flex: 1 }} numberOfLines={2}>{label}</Txt>
        <StepButton sign="−" label={label.toLowerCase()} onPress={() => onChange(clamp(value - step))} />
        <View style={{ minWidth: 104, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5 }}>
          <Txt face="display" lean={false} size={34} lh={1.15}>{value.toFixed(dp)}</Txt>
          <Txt face="label" w={600} size={14} ls={0.06} color={F.smoke}>{unit}</Txt>
        </View>
        <StepButton sign="+" label={label.toLowerCase()} onPress={() => onChange(clamp(value + step))} />
      </View>
      <View {...pan.panHandlers} style={{ height: H, alignItems: 'center', overflow: 'hidden' }}>
        <Svg width={W} height={H}>
          {ticks}
          <Rect x={W / 2 - 2} y={0} width={4} height={H} fill={acc} />
        </Svg>
      </View>
    </View>
  );
}

const SWITCH_W = 52, SWITCH_H = 28;

/** A labelled switch row. */
export function ToggleRow({ icon, label, sub, on, onPress, acc }: { icon: IconKey; label: string; sub: string; on: boolean; onPress: () => void; acc: string }) {
  return (
    <Tap
      onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={`${label}. ${sub}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: HIT, paddingVertical: SP.md, paddingHorizontal: SP.md, backgroundColor: F.canvas }}
    >
      <Icon name={icon} size={24} color={on ? acc : F.smoke} tint={0} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={15.5} w={600}>{label}</Txt>
        <Txt size={13} color={C.sub} lh={1.35}>{sub}</Txt>
      </View>
      <View style={{ width: SWITCH_W, height: SWITCH_H }}>
        <CutShape width={SWITCH_W} height={SWITCH_H} fill={on ? acc : F.canvas} stroke={on ? acc : F.rope} />
        <CutShape width={24} height={16} fill={on ? onColor(acc) : F.smoke} style={{ position: 'absolute', top: 6, left: on ? SWITCH_W - 24 - 7 : 7 }} />
      </View>
    </Tap>
  );
}

/** A single-line answer box. Its border takes your colour while you type. */
export function Field({ value, onChange, placeholder, secure, keyboard, autoCapitalize = 'sentences', maxLength = 160, acc, accessibilityLabel }: { value: string; onChange: (v: string) => void; placeholder: string; secure?: boolean; keyboard?: 'default' | 'email-address'; autoCapitalize?: 'none' | 'sentences' | 'words'; maxLength?: number; acc?: string; accessibilityLabel?: string }) {
  const textSize = useStore(s => s.settings.textSize);
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      placeholder={placeholder}
      placeholderTextColor={C.dim}
      accessibilityLabel={accessibilityLabel ?? placeholder}
      secureTextEntry={secure}
      keyboardType={keyboard}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      maxLength={maxLength}
      keyboardAppearance="dark"
      style={{ minHeight: 52, paddingHorizontal: SP.lg, backgroundColor: F.canvas, borderWidth: 2, borderColor: focus ? acc ?? F.chalk : F.rope, fontFamily: fontFamily('body', 400), fontSize: 16 * textSize, color: F.chalk }}
    />
  );
}
