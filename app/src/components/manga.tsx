// The first visual language's parts (panels, headings, stamps, gauges, tiles, medals), drawn in the
// Manga Panel system so screens that still use them match. Same props as before; new screens
// should use ink.tsx and fight.tsx directly (InkPanel, SectionHeader, Meter, RoundStamp, SpecialMoveCard, MoveRow).
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { MeterBar, MoveCardArt, SectionHeader, TIER_COLOR } from './fight';
import { InkPanel } from './ink';
import { Icon, type IconKey } from './icons';
import { Tap, Txt } from './ui';
import { C, HIT, STROKE } from '../lib/theme';

/** An ink panel. With `tone` above 0.6 it is a hero panel: screentone and a hard shadow in your colour. */
export function Panel({ children, acc, style, tone = 0.5, dots, onPress, pad = 18 }: { children: ReactNode; acc: string; style?: StyleProp<ViewStyle>; tone?: number; dots?: boolean; onPress?: () => void; pad?: number }) {
  const hero = tone > 0.6;
  return <InkPanel pad={pad} tone={dots ?? hero} shadow={hero ? acc : undefined} onPress={onPress} style={style}>{children}</InkPanel>;
}

/** Section heading: leaning tag, display title, ink rule, meta. `icon` is not drawn. */
export function Heading({ title, acc, right, onRight, style }: { icon?: IconKey; title: string; acc: string; right?: string; onRight?: () => void; style?: StyleProp<ViewStyle> }) {
  return <SectionHeader title={title} meta={right} onMeta={onRight} accent={acc} style={style} />;
}

/** An outlined stamp for statuses and ranks, in `color`. */
export function Stamp({ text, color }: { text: string; color: string; tilt?: number; size?: number }) {
  return (
    <View style={{ alignSelf: 'flex-start', minHeight: 24, paddingHorizontal: 8, justifyContent: 'center', backgroundColor: C.arena, borderWidth: 2, borderColor: color }}>
      <Txt face="labelItalic" size={12} lh={1.3} color={color}>{text.toUpperCase()}</Txt>
    </View>
  );
}

/** A meter bar (see `Meter` in fight.tsx for the full one). */
export function Gauge({ pct, acc, height = 8 }: { pct: number; acc: string; segments?: number; height?: number }) {
  return <MeterBar pct={pct} accent={acc} height={Math.max(10, height)} />;
}

/** A big tappable tile with an icon, for quick actions. */
export function Tile({ icon, label, sub, acc, onPress, hot }: { icon: IconKey; label: string; sub?: string; acc: string; onPress: () => void; hot?: boolean }) {
  return (
    <Tap onPress={onPress} accessibilityLabel={sub ? `${label}, ${sub}` : label} style={{ flex: 1 }}>
      <View style={{ minHeight: 96, borderWidth: STROKE, borderColor: C.chalk, backgroundColor: C.canvas, padding: 12, justifyContent: 'space-between', gap: 8, boxShadow: hot ? `4px 4px 0px ${acc}` : undefined }}>
        <Icon name={icon} size={28} color={hot ? acc : C.chalk} tint={0} />
        <View>
          <Txt size={15} w={600}>{label}</Txt>
          {sub ? <Txt face="label" size={12} color={C.smoke}>{sub}</Txt> : null}
        </View>
      </View>
    </Tap>
  );
}

/** Tier colours for badges. */
export const TIER = TIER_COLOR;

/** A badge as a trading card: its rarity frame when earned, a dashed silhouette until then. */
export function Medal({ icon, tier, earned, size = 64, progress = 0 }: { icon: IconKey; tier: keyof typeof TIER; earned: boolean; size?: number; progress?: number }) {
  const w = size * 0.78;
  return (
    <View style={{ width: Math.max(size, HIT), alignItems: 'center', gap: 4 }}>
      <MoveCardArt tier={tier} earned={earned} icon={earned ? icon : icon ?? 'lock'} width={w} />
      {!earned && progress > 0 ? <MeterBar pct={progress} height={10} style={{ alignSelf: 'center', width: Math.max(w, 44) }} /> : null}
    </View>
  );
}
