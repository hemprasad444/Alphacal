// The first visual language's parts (panels, headings, stamps, gauges, tiles, medals), drawn in
// Sumi & Hanko so screens that still use them match. Same props as before; new screens should
// use ink.tsx and fight.tsx directly (InkPanel, SectionHeader, Meter, RoundStamp, SpecialMoveCard, MoveRow).
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { MeterBar, MoveCardArt, SectionHeader, TIER_COLOR } from './fight';
import { InkPanel } from './ink';
import { Icon, type IconKey } from './icons';
import { Tap, Txt } from './ui';
import { C, HIT, RADIUS, STROKE } from '../lib/theme';

/** A card. `tone` and `dots` are no longer drawn. */
export function Panel({ children, style, onPress, pad = 16 }: { children: ReactNode; acc: string; style?: StyleProp<ViewStyle>; tone?: number; dots?: boolean; onPress?: () => void; pad?: number }) {
  return <InkPanel pad={pad} onPress={onPress} style={style}>{children}</InkPanel>;
}

/** Section heading: boxed tag, Mincho title, brush rule, meta. `icon` is drawn in the tag. */
export function Heading({ icon, title, acc, right, onRight, style }: { icon?: IconKey; title: string; acc: string; right?: string; onRight?: () => void; style?: StyleProp<ViewStyle> }) {
  return <SectionHeader title={title} icon={icon} meta={right} onMeta={onRight} accent={acc} style={style} />;
}

/** An outlined tag for statuses and ranks, in `color`. */
export function Stamp({ text, color }: { text: string; color: string; tilt?: number; size?: number }) {
  return (
    <View style={{ alignSelf: 'flex-start', minHeight: 24, paddingHorizontal: 8, justifyContent: 'center', borderWidth: 1, borderColor: color, borderRadius: RADIUS.tag }}>
      <Txt face="label" size={12} lh={1.3} color={color}>{text}</Txt>
    </View>
  );
}

/** A brush-stroke progress bar (see `Meter` in fight.tsx for the full one). */
export function Gauge({ pct, acc, height = 8 }: { pct: number; acc: string; segments?: number; height?: number }) {
  return <MeterBar pct={pct} accent={acc} height={Math.max(12, height)} />;
}

/** A big tappable tile with an icon, for quick actions. `hot` draws its icon in your colour. */
export function Tile({ icon, label, sub, acc, onPress, hot }: { icon: IconKey; label: string; sub?: string; acc: string; onPress: () => void; hot?: boolean }) {
  return (
    <Tap onPress={onPress} accessibilityLabel={sub ? `${label}, ${sub}` : label} style={{ flex: 1 }}>
      <View style={{ minHeight: 96, borderWidth: STROKE, borderColor: C.line2, borderRadius: RADIUS.card, backgroundColor: C.canvas, padding: 16, justifyContent: 'space-between', gap: 8 }}>
        <Icon name={icon} size={24} color={hot ? acc : C.chalk} tint={0} strokeWidth={1.6} />
        <View>
          <Txt size={15} w={600} lh={1.35}>{label}</Txt>
          {sub ? <Txt face="label" w={400} size={12} color={C.smoke}>{sub}</Txt> : null}
        </View>
      </View>
    </Tap>
  );
}

/** Tier colours for badges (text only). */
export const TIER = TIER_COLOR;

/** A badge as a hanko seal: inked in red when earned, an embossed outline until then. */
export function Medal({ icon, tier, earned, size = 64, progress = 0 }: { icon: IconKey; tier: keyof typeof TIER; earned: boolean; size?: number; progress?: number }) {
  const w = size * 0.86;
  return (
    <View style={{ width: Math.max(size, HIT), alignItems: 'center', gap: 6 }}>
      <MoveCardArt tier={tier} earned={earned} icon={earned ? icon : icon ?? 'lock'} width={w} />
      {!earned && progress > 0 ? <MeterBar pct={progress} height={12} style={{ alignSelf: 'center', width: Math.max(w, 44) }} /> : null}
    </View>
  );
}
