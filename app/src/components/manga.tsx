// The first visual language's parts (panels, headings, stamps, gauges, tiles, medals), now drawn in
// the Fight Night system so screens that still use them match. Same props as before; new screens
// should use fight.tsx directly (SectionHeader, Meter, RoundStamp, SpecialMoveCard, MoveRow).
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { CutBox } from './cut';
import { MeterBar, MoveCardArt, SectionHeader, TIER_COLOR } from './fight';
import { Icon, type IconKey } from './icons';
import { Tap, Txt } from './ui';
import { C, HIT } from '../lib/theme';

/** A panel: flat canvas with a bar down the left edge, in your colour when `tone` is high. */
export function Panel({ children, acc, style, tone = 0.5, onPress, pad = 18 }: { children: ReactNode; acc: string; style?: StyleProp<ViewStyle>; tone?: number; dots?: boolean; onPress?: () => void; pad?: number }) {
  const body = <View style={[{ backgroundColor: C.canvas, borderLeftWidth: 4, borderLeftColor: tone > 0.6 ? acc : C.rope, padding: pad }, style]}>{children}</View>;
  return onPress ? <Tap onPress={onPress}>{body}</Tap> : body;
}

/** Section heading: the Fight Night pattern (cut tab, label, rope, meta). `icon` is no longer drawn. */
export function Heading({ title, acc, right, onRight, style }: { icon?: IconKey; title: string; acc: string; right?: string; onRight?: () => void; style?: StyleProp<ViewStyle> }) {
  return <SectionHeader title={title} meta={right} onMeta={onRight} accent={acc} style={style} />;
}

/** A cut, outlined tag for statuses and ranks. */
export function Stamp({ text, color, size = 10 }: { text: string; color: string; tilt?: number; size?: number }) {
  return (
    <CutBox fill={C.arena} stroke={color} style={{ alignSelf: 'flex-start', minHeight: 22, paddingHorizontal: 11, justifyContent: 'center' }}>
      <Txt face="label" w={600} size={Math.max(12, size + 2)} ls={0.12} color={color}>{text.toUpperCase()}</Txt>
    </CutBox>
  );
}

/** A meter bar (see `Meter` in fight.tsx for the full one). */
export function Gauge({ pct, acc, height = 8 }: { pct: number; acc: string; segments?: number; height?: number }) {
  return <MeterBar pct={pct} accent={acc} height={Math.max(8, height)} />;
}

/** A big tappable tile with an icon, for quick actions. */
export function Tile({ icon, label, sub, acc, onPress, hot }: { icon: IconKey; label: string; sub?: string; acc: string; onPress: () => void; hot?: boolean }) {
  return (
    <Tap onPress={onPress} accessibilityLabel={sub ? `${label}, ${sub}` : label} style={{ flex: 1 }}>
      <View style={{ minHeight: 96, borderWidth: 2, borderColor: hot ? acc : C.rope, backgroundColor: C.canvas, padding: 12, justifyContent: 'space-between', gap: 8 }}>
        <Icon name={icon} size={28} color={hot ? acc : C.chalk} tint={0} />
        <View>
          <Txt size={15} w={600}>{label}</Txt>
          {sub ? <Txt face="label" size={12} ls={0.1} color={C.smoke}>{sub.toUpperCase()}</Txt> : null}
        </View>
      </View>
    </Tap>
  );
}

/** Tier colours for badges. */
export const TIER = TIER_COLOR;

/** A badge as a special-move card: tier-coloured when earned, outlined and quiet until then. */
export function Medal({ icon, tier, earned, size = 64, progress = 0 }: { icon: IconKey; tier: keyof typeof TIER; earned: boolean; size?: number; progress?: number }) {
  const w = size * 0.78;
  return (
    <View style={{ width: Math.max(size, HIT), alignItems: 'center', gap: 4 }}>
      <MoveCardArt tier={tier} earned={earned} icon={earned ? icon : icon ?? 'lock'} width={w} />
      {!earned && progress > 0 ? <MeterBar pct={progress} height={6} style={{ alignSelf: 'center', width: w }} /> : null}
    </View>
  );
}
