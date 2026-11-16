// Talking with REI: REI's lines are set in Mincho beside a small red seal, with a thin vermilion
// rule down their left edge; your lines sit in a quiet sumi card on the right. Shared by Talk,
// Voice and Live. The file keeps its old name so the screens switch through it.
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { RoundStamp } from './fight';
import { Icon } from './icons';
import { BrushRule, ReiSeal } from './ink';
import { IconButton, Tap, Txt } from './ui';
import { C, contrast, F, fontFamily, HIT, RADIUS, SP } from '../lib/theme';
import { useStore } from '../state/store';

/** `color` if it reads on `bg` (4.5:1), else rice paper. For colours that come from data (a voice's own colour). */
export const readable = (color: string, bg: string = F.canvas): string => (contrast(color, bg) >= 4.5 ? color : F.chalk);

/** Type style for a text input: body face at the app's text size. */
export const inputType = (textSize: number, size = 16): TextStyle => ({ fontFamily: fontFamily('body', 500), fontSize: size * textSize, color: C.chalk });

/**
 * REI's line: the red seal and a mono tag, then the words in Mincho behind a thin vermilion rule.
 * `lead` is the first sentence, set a little heavier; `callout` marks REI calling you out (the
 * tag says so; the voice stays level).
 */
export function CoachLine({ text, lead, time, callout, maxWidth = '94%', children }: { text?: string; lead?: string; time?: string; callout?: boolean; maxWidth?: ViewStyle['maxWidth']; children?: ReactNode }) {
  const tag = `${callout ? 'REI · call-out' : 'REI'}${time ? ` · ${time}` : ''}`;
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth, gap: SP.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
        <ReiSeal size={24} ground={F.arena} />
        <Txt face="mono" raw size={12} lh={1.35} color={callout ? F.rival : F.smoke}>{tag}</Txt>
      </View>
      <View style={{ borderLeftWidth: 1.5, borderLeftColor: F.seal, paddingLeft: 14, marginLeft: 11, gap: SP.xs }}>
        {lead ? <Txt face="voice" w={600} size={18} lh={1.5}>{lead}</Txt> : null}
        {text ? <Txt face="voice" size={17} lh={1.53}>{text}</Txt> : null}
        {children}
      </View>
    </View>
  );
}

/** Your line: a quiet sumi card on the right. */
export function CornerLine({ text, time, maxWidth = '82%' }: { text: string; time?: string; maxWidth?: ViewStyle['maxWidth'] }) {
  return (
    <View style={{ alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth, gap: SP.xs }}>
      <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{`You${time ? ` · ${time}` : ''}`}</Txt>
      <View style={{ backgroundColor: F.canvas, borderWidth: 1, borderColor: F.line, borderRadius: RADIUS.card, paddingVertical: 10, paddingHorizontal: SP.lg }}>
        <Txt size={16} w={500} lh={1.45}>{text}</Txt>
      </View>
    </View>
  );
}

/** A note from the app in the middle of a conversation ("Logged · 380 kcal"). */
export function RingNote({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: SP.md }, style]}>
      <BrushRule style={{ flex: 1, minWidth: 12, transform: [{ scaleX: -1 }] }} />
      <Txt face="mono" size={12} lh={1.35} color={F.smoke} align="center" style={{ flexShrink: 1 }}>{text}</Txt>
      <BrushRule style={{ flex: 1, minWidth: 12 }} />
    </View>
  );
}

/** Top of a call screen (Voice, Live): the title in Mincho, a status tag, close. */
export function CallHeader({ title, status, live, top, onClose }: { title: string; status: string; /** The status is "on air": drawn in your colour. */ live?: boolean; /** Safe-area inset. */ top: number; onClose: () => void }) {
  return (
    <View style={{ paddingTop: top + 8, paddingHorizontal: SP.xxl, paddingBottom: SP.sm, gap: SP.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: HIT }}>
        <View accessibilityRole="header" style={{ flexShrink: 1 }}>
          <Txt face="display" exact size={24} lh={1.25} fit>{title}</Txt>
        </View>
        <View accessibilityLiveRegion="polite" style={{ flex: 1, alignItems: 'flex-start' }}>
          <RoundStamp label={status} tone={live ? 'accent' : 'outline'} size="sm" />
        </View>
        <IconButton size={HIT} onPress={onClose} accessibilityLabel="Close">✕</IconButton>
      </View>
      <BrushRule long height={6} />
    </View>
  );
}

/** A small rice-paper button: the send button beside a text box. `children` gets the ink colour. */
export function SlabButton({ onPress, accessibilityLabel, disabled, children }: { onPress: () => void; accessibilityLabel: string; disabled?: boolean; children: (ink: string) => ReactNode }) {
  const ink = disabled ? C.faint : F.arena;
  return (
    <Tap onPress={onPress} disabled={disabled} accessibilityLabel={accessibilityLabel} style={{ width: 52, height: 48, borderRadius: RADIUS.sm, backgroundColor: disabled ? F.canvas2 : F.chalk, alignItems: 'center', justifyContent: 'center' }}>
      {children(ink)}
    </Tap>
  );
}

/** The "send" arrow for a SlabButton. */
export function SendArrow({ color }: { color: string }) {
  return (
    <View style={{ transform: [{ rotate: '-90deg' }] }}>
      <Icon name="chevron" size={22} color={color} tint={0} strokeWidth={1.9} />
    </View>
  );
}

const BARS = [0.45, 0.8, 1, 0.65, 0.35];

/**
 * The mic level: five soft bars that rise and fall while `active` and rest when not. Flat colour, no
 * glow. Holds still when Reduce Motion is on.
 */
export function LevelBars({ active, color, height = 40 }: { active: boolean; color?: string; height?: number }) {
  const accent = useStore(s => s.accent);
  const col = color ?? accent;
  const [vs] = useState(() => BARS.map(() => new Animated.Value(0)));
  useEffect(() => {
    if (!active) {
      vs.forEach(v => v.setValue(0));
      return;
    }
    let loops: Animated.CompositeAnimation[] = [], live = true;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then(reduce => {
      if (!live) return;
      if (reduce) {
        vs.forEach(v => v.setValue(1));
        return;
      }
      loops = vs.map((v, i) => Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 220 + i * 60, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.15, duration: 260 + i * 50, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])));
      loops.forEach(l => l.start());
    });
    return () => {
      live = false;
      loops.forEach(l => l.stop());
    };
  }, [active, vs]);
  const w = Math.max(4, Math.round(height / 6));
  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={{ height, flexDirection: 'row', alignItems: 'center', gap: w * 0.75 }}>
      {BARS.map((k, i) => (
        <Animated.View key={i} style={{ width: w, height: height * k, borderRadius: w / 2, backgroundColor: active ? col : F.rope, transform: [{ scaleY: vs[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }} />
      ))}
    </View>
  );
}
