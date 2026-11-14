// Talking with REI, in the Fight Night system: REI speaks from your corner on the chalk panel
// (REI's alone), you answer on a canvas strip in your colour. Shared by Talk, Voice and Live.
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { CutBox } from './cut';
import { RoundStamp } from './fight';
import { Icon } from './icons';
import { IconButton, Tap, Txt } from './ui';
import { C, contrast, F, fontFamily, hard, HIT, onColor, SHADOW, SP } from '../lib/theme';
import { useStore } from '../state/store';

/** `color` if it reads on `bg` (4.5:1), else chalk. For colours that come from data (a voice's own colour). */
export const readable = (color: string, bg: string = F.canvas): string => (contrast(color, bg) >= 4.5 ? color : F.chalk);

/** Type style for a text input: body face at the app's text size. */
export const inputType = (textSize: number, size = 16): TextStyle => ({ fontFamily: fontFamily('body', 500), fontSize: size * textSize, color: C.chalk });

/** A lead sentence short enough to shout in display type. */
const SHOUT_MAX = 64;

/**
 * REI's line: a chalk panel on a hard shadow in your colour. `lead` is the first sentence, set
 * loud (display type when short); `callout` marks REI calling you out, with the far corner's red.
 */
export function CoachLine({ text, lead, time, callout, maxWidth = '90%', children }: { text?: string; lead?: string; time?: string; callout?: boolean; maxWidth?: ViewStyle['maxWidth']; children?: ReactNode }) {
  const accent = useStore(s => s.accent);
  const edge = callout ? F.rival : accent;
  const tag = `${callout ? 'REI · CALL-OUT' : 'REI'}${time ? ` · ${time}` : ''}`;
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth, gap: 6, paddingRight: SHADOW, paddingBottom: SHADOW }}>
      <Txt face="labelItalic" w={600} size={12} ls={0.14} color={edge}>{tag}</Txt>
      <View style={[{ backgroundColor: F.chalk, paddingVertical: SP.md, paddingHorizontal: SP.lg, gap: SP.xs }, hard(edge)]}>
        {lead ? (
          lead.length <= SHOUT_MAX
            ? <Txt face="display" size={20} lh={1.25} ls={0.01} color={F.arena}>{lead.toUpperCase()}</Txt>
            : <Txt size={17} w={600} lh={1.35} color={F.arena}>{lead}</Txt>
        ) : null}
        {text ? <Txt size={16} w={500} lh={1.45} color={F.arena}>{text}</Txt> : null}
        {children}
      </View>
    </View>
  );
}

/** Your line: a canvas strip with your colour down the right edge. */
export function CornerLine({ text, time, maxWidth = '82%' }: { text: string; time?: string; maxWidth?: ViewStyle['maxWidth'] }) {
  const accent = useStore(s => s.accent);
  return (
    <View style={{ alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth, gap: 6 }}>
      <Txt face="labelItalic" w={600} size={12} ls={0.14} color={F.smoke}>{`YOU${time ? ` · ${time}` : ''}`}</Txt>
      <View style={{ backgroundColor: F.canvas, borderRightWidth: 4, borderRightColor: accent, paddingVertical: SP.md, paddingHorizontal: SP.lg }}>
        <Txt size={16} w={500} lh={1.45}>{text}</Txt>
      </View>
    </View>
  );
}

/** A note from the app in the middle of a conversation ("LOGGED · 380 KCAL"). */
export function RingNote({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }, style]}>
      <View style={{ flex: 1, minWidth: 12, height: 2, backgroundColor: F.rope }} />
      <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} align="center" style={{ flexShrink: 1 }}>{text.toUpperCase()}</Txt>
      <View style={{ flex: 1, minWidth: 12, height: 2, backgroundColor: F.rope }} />
    </View>
  );
}

/** Top of a call screen (Voice, Live): leaning title, a status tag, close. */
export function CallHeader({ title, status, live, top, onClose }: { title: string; status: string; /** The status is "on air": filled in your colour. */ live?: boolean; /** Safe-area inset. */ top: number; onClose: () => void }) {
  return (
    <View style={{ paddingTop: top + 6, paddingHorizontal: SP.lg, paddingBottom: SP.sm, flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: HIT, borderBottomWidth: 2, borderBottomColor: F.rope }}>
      <View accessibilityRole="header">
        <Txt face="display" size={26} ls={0.02}>{title.toUpperCase()}</Txt>
      </View>
      <View accessibilityLiveRegion="polite" style={{ flex: 1, alignItems: 'flex-start' }}>
        <RoundStamp label={status} tone={live ? 'accent' : 'outline'} size="sm" />
      </View>
      <IconButton size={HIT} onPress={onClose} accessibilityLabel="Close">✕</IconButton>
    </View>
  );
}

/** A small cut slab in your colour on a chalk shadow: the send button beside a text box. `children` gets the ink colour. */
export function SlabButton({ onPress, accessibilityLabel, disabled, children }: { onPress: () => void; accessibilityLabel: string; disabled?: boolean; children: (ink: string) => ReactNode }) {
  const accent = useStore(s => s.accent);
  const ink = disabled ? F.smoke : onColor(accent);
  return (
    <Tap onPress={onPress} disabled={disabled} accessibilityLabel={accessibilityLabel} style={{ paddingRight: SHADOW, paddingBottom: SHADOW }}>
      <CutBox fill={disabled ? F.canvas2 : accent} stroke={disabled ? F.rope : undefined} shadow={disabled ? undefined : F.chalk} style={{ width: 60, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        {children(ink)}
      </CutBox>
    </Tap>
  );
}

/** The "send" arrow for a SlabButton. */
export function SendArrow({ color }: { color: string }) {
  return (
    <View style={{ transform: [{ rotate: '-90deg' }] }}>
      <Icon name="chevron" size={24} color={color} strokeWidth={2.6} />
    </View>
  );
}

const BARS = [0.45, 0.8, 1, 0.65, 0.35];

/**
 * The mic level: five flat bars that bounce while `active` and rest when not. Flat colour, no
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
        <Animated.View key={i} style={{ width: w, height: height * k, backgroundColor: active ? col : F.rope, transform: [{ scaleY: vs[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }} />
      ))}
    </View>
  );
}
