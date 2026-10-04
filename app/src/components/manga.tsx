// The app's own visual language, taken from onboarding: manga panels with a hard offset shadow,
// halftone corners, ink-slash headings and stamped labels. Used by every main screen so the app
// reads as one book instead of a stack of generic cards.
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconKey } from './icons';
import { comic, Halftone, solid } from './onboarding/kit';
import { Tap, Txt } from './ui';
import { alpha, C } from '../lib/theme';

/** A manga panel: hard offset shadow in the accent, thin ink border, halftone in one corner. */
export function Panel({ children, acc, style, tone = 0.5, dots = true, onPress, pad = 18 }: { children: ReactNode; acc: string; style?: StyleProp<ViewStyle>; tone?: number; dots?: boolean; onPress?: () => void; pad?: number }) {
  const body = (
    <View style={[{ borderRadius: 14, borderWidth: 1.5, borderColor: alpha(acc, 0.22 + tone * 0.3), backgroundColor: '#0D0F13', padding: pad }, comic(alpha(acc, 0.25 + tone * 0.45), 4), style]}>
      {dots ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, borderTopRightRadius: 14, overflow: 'hidden' }}>
          <Halftone width={150} height={110} color={acc} opacity={0.18} />
        </View>
      ) : null}
      {children}
    </View>
  );
  return onPress ? <Tap onPress={onPress}>{body}</Tap> : body;
}

/** Section heading: icon, bold title and a slanted ink slash; optional right-hand label. */
export function Heading({ icon, title, acc, right, onRight, style }: { icon?: IconKey; title: string; acc: string; right?: string; onRight?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 9 }, style]}>
      {icon ? <Icon name={icon} size={18} color={acc} /> : null}
      <Txt size={13} w={600} ls={0.14} color={C.text}>{title.toUpperCase()}</Txt>
      <View style={{ width: 22, height: 4, backgroundColor: acc, transform: [{ skewX: '-24deg' }], marginLeft: 2 }} />
      <View style={{ flex: 1 }} />
      {right ? (
        <Tap onPress={onRight} disabled={!onRight}>
          <Txt face="mono" size={11} ls={0.12} color={onRight ? acc : C.muted}>{right}</Txt>
        </Tap>
      ) : null}
    </View>
  );
}

/** A tilted ink stamp, for statuses and ranks. */
export function Stamp({ text, color, tilt = -4, size = 10 }: { text: string; color: string; tilt?: number; size?: number }) {
  return (
    <View style={{ alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 7, borderWidth: 1.5, borderColor: color, borderRadius: 4, transform: [{ rotate: `${tilt}deg` }] }}>
      <Txt face="mono" size={size} w={500} ls={0.14} color={color}>{text.toUpperCase()}</Txt>
    </View>
  );
}

/** A segmented power gauge, like an anime stat bar. */
export function Gauge({ pct, acc, segments = 20, height = 8 }: { pct: number; acc: string; segments?: number; height?: number }) {
  const lit = Math.round(Math.max(0, Math.min(1, pct)) * segments);
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: segments }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height,
            transform: [{ skewX: '-18deg' }],
            backgroundColor: i < lit ? acc : 'rgba(255,255,255,0.07)',
            ...(i === lit - 1 ? { shadowColor: acc, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } } : null),
          }}
        />
      ))}
    </View>
  );
}

/** A big tappable tile with an icon, for quick actions. */
export function Tile({ icon, label, sub, acc, onPress, hot }: { icon: IconKey; label: string; sub?: string; acc: string; onPress: () => void; hot?: boolean }) {
  return (
    <Tap onPress={onPress} style={{ flex: 1 }}>
      <View style={[{ height: 96, borderRadius: 12, borderWidth: 1.5, borderColor: hot ? acc : 'rgba(255,255,255,0.1)', backgroundColor: hot ? solid(acc, 0.14, '#0D0F13') : '#0D0F13', padding: 12, justifyContent: 'space-between' }, hot ? comic(alpha(acc, 0.6), 3) : null]}>
        <Icon name={icon} size={28} color={hot ? acc : C.body} tint={hot ? 0.3 : 0.16} />
        <View>
          <Txt size={14} w={600}>{label}</Txt>
          {sub ? <Txt face="mono" size={9.5} ls={0.1} color={C.muted}>{sub.toUpperCase()}</Txt> : null}
        </View>
      </View>
    </Tap>
  );
}

/** Tier colours for badges. */
export const TIER = { bronze: '#D9925B', silver: '#C9D3DE', gold: '#F5C542' } as const;

/** A badge medallion: icon in a notched ring, tier-coloured; dim and locked until earned. */
export function Medal({ icon, tier, earned, size = 64, progress = 0 }: { icon: IconKey; tier: keyof typeof TIER; earned: boolean; size?: number; progress?: number }) {
  const col = earned ? TIER[tier] : 'rgba(255,255,255,0.22)';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: col, borderStyle: earned ? 'solid' : 'dashed', backgroundColor: earned ? solid(TIER[tier], 0.14, '#0D0F13') : '#0F1115', ...(earned ? comic(alpha(TIER[tier], 0.45), 3) : null) }} />
      <View style={{ position: 'absolute', width: size - 12, height: size - 12, borderRadius: (size - 12) / 2, borderWidth: 1, borderColor: alpha(earned ? TIER[tier] : '#FFFFFF', earned ? 0.5 : 0.08) }} />
      <Icon name={earned ? icon : 'lock'} size={size * 0.44} color={col} tint={earned ? 0.3 : 0.08} />
      {!earned && progress > 0 ? (
        <View style={{ position: 'absolute', bottom: -2, left: size * 0.2, right: size * 0.2, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <View style={{ width: `${Math.round(progress * 100)}%`, height: 3, borderRadius: 2, backgroundColor: C.muted }} />
        </View>
      ) : null}
    </View>
  );
}
