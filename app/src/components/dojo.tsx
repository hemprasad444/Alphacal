// Parts shared by the training screens (Dojo, workout, logs, badges, progress): inputs, quiet
// buttons, chips, stat strips and the grid of seals. Built on the Sumi & Hanko primitives.
import { parseIsoDate, type GameBadge } from '@rei/shared';
import { Fragment } from 'react';
import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { MeterBar, MoveCardArt, SpecialMoveCard, useTierColors } from './fight';
import { Icon, type IconKey } from './icons';
import { BrushRule } from './ink';
import { Tap, Txt } from './ui';
import { C, F, fontFamily, HIT, RADIUS, SP, STROKE } from '../lib/theme';
import { useStore } from '../state/store';

/** A text field: sumi, softly rounded, a quiet border that turns to rice paper once it holds something. `lg` is for the number that matters. */
export function Field({ label, size = 'md', style, value, ...rest }: Omit<TextInputProps, 'style'> & { label?: string; size?: 'lg' | 'md'; style?: StyleProp<ViewStyle> }) {
  const scale = useStore(s => s.settings.textSize);
  const big = size === 'lg';
  return (
    <View style={[{ gap: SP.sm }, style]}>
      {label ? <Txt face="label" size={12} color={F.smoke}>{label}</Txt> : null}
      <TextInput
        value={value}
        accessibilityLabel={label ?? rest.placeholder}
        placeholderTextColor={C.faint}
        keyboardAppearance="dark"
        {...rest}
        style={{ height: big ? 64 : 48, borderWidth: 1, borderColor: value ? F.smoke : F.rule, borderRadius: RADIUS.sm, backgroundColor: F.canvas, paddingHorizontal: SP.lg, paddingVertical: 0, fontFamily: fontFamily(big ? 'num' : 'body', 500), fontSize: (big ? 28 : 16) * scale, color: F.chalk }}
      />
    </View>
  );
}

/** A secondary action: an outlined sumi button, 44pt tall. `lit` draws it in your colour. */
export function QuietButton({ label, icon, onPress, onLongPress, disabled, lit, accessibilityLabel, style }: { label: string; icon?: IconKey; onPress?: () => void; onLongPress?: () => void; disabled?: boolean; lit?: boolean; accessibilityLabel?: string; style?: StyleProp<ViewStyle> }) {
  const accent = useStore(s => s.accent);
  const ink = disabled ? C.faint : lit ? accent : F.chalk;
  return (
    <Tap onPress={onPress} onLongPress={onLongPress} disabled={disabled} accessibilityLabel={accessibilityLabel ?? label} style={[{ minHeight: HIT, paddingHorizontal: SP.lg, paddingVertical: SP.xs, borderWidth: 1, borderColor: disabled ? F.rope : lit ? accent : F.rule, borderRadius: RADIUS.sm, backgroundColor: F.canvas, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.sm }, style]}>
      {icon ? <Icon name={icon} size={18} color={ink} tint={0} strokeWidth={1.7} /> : null}
      <Txt face="heading" size={15} lh={1.35} color={ink} align="center" style={{ flexShrink: 1 }}>{label}</Txt>
    </Tap>
  );
}

/** A filter chip: rice paper when picked, quiet otherwise. */
export function Chip({ label, sub, on, onPress, style }: { label: string; sub?: string; on?: boolean; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Tap onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: !!on, checked: !!on }} accessibilityLabel={sub ? `${label}, ${sub}` : label} style={[{ minHeight: HIT, paddingHorizontal: SP.lg, paddingVertical: SP.xs, justifyContent: 'center', borderWidth: 1, borderColor: on ? F.chalk : F.rule, borderRadius: RADIUS.sm, backgroundColor: on ? F.chalk : F.canvas }, style]}>
      <Txt face="labelItalic" size={13} color={on ? F.arena : F.chalk} numberOfLines={1}>{label}</Txt>
      {sub ? <Txt face="label" w={400} size={12} color={on ? F.arena : F.smoke} numberOfLines={1}>{sub}</Txt> : null}
    </Tap>
  );
}

export interface Stat {
  /** The number, already formatted ("94 kg", "+60"). */
  v: string;
  /** What it is ("EST. MAX"). */
  k: string;
  /** Draw the number in your corner colour. */
  hot?: boolean;
}

/** Numbers side by side under a brush rule, split by hairlines: the number is set in Mincho, its name under it. Values keep their own case ("12 t", "5:42 /km"): units mean something else in capitals. */
export function StatStrip({ items, style }: { items: Stat[]; style?: StyleProp<ViewStyle> }) {
  const accent = useStore(s => s.accent);
  return (
    <View style={[{ gap: SP.sm }, style]}>
      <BrushRule long />
      <View style={{ flexDirection: 'row' }}>
        {items.map((x, i) => (
          <View key={x.k} accessible accessibilityLabel={`${x.k.toLowerCase()}: ${x.v}`} style={{ flex: 1, minHeight: HIT, justifyContent: 'center', gap: 2, paddingLeft: i ? SP.md : 0, paddingRight: SP.xs, borderLeftWidth: i ? 1 : 0, borderLeftColor: F.rope }}>
            <Txt face="heading" raw size={items.length > 3 ? 17 : 20} lh={1.2} color={x.hot ? accent : F.chalk} fit>{x.v}</Txt>
            <Txt face="label" w={400} size={12} lh={1.35} color={F.smoke} numberOfLines={2}>{x.k}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

const landed = (iso: string) => (parseIsoDate(iso) ?? new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const tierName = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** One badge in full: its seal, its tier, how it is earned, and when it was earned or how close it is. */
export function BadgeDetail({ b, style }: { b: GameBadge; style?: StyleProp<ViewStyle> }) {
  const accent = useStore(s => s.accent);
  const TIER_COLOR = useTierColors();
  const pct = Math.round(b.progress * 100);
  return (
    <View accessibilityLiveRegion="polite" style={[{ backgroundColor: F.canvas, borderWidth: STROKE, borderColor: F.line, borderRadius: RADIUS.card, padding: SP.lg, flexDirection: 'row', alignItems: 'center', gap: SP.lg }, style]}>
      <MoveCardArt tier={b.tier} earned={!!b.earned} icon={b.icon} width={64} />
      <View style={{ flex: 1, gap: SP.xs, alignItems: 'flex-start' }}>
        <Txt face="heading" size={20} lh={1.4} color={b.earned ? F.chalk : F.smoke}>{b.title}</Txt>
        <Txt size={15} w={500} lh={1.4} color={F.chalk}>{b.desc}</Txt>
        <Txt face="mono" raw size={12} lh={1.35} color={b.earned ? TIER_COLOR[b.tier] : F.smoke}>{b.earned ? `${tierName(b.tier)} · earned ${landed(b.earned)}` : `${tierName(b.tier)} · ${pct}% there`}</Txt>
        {!b.earned ? <MeterBar pct={b.progress} height={14} accent={accent} accessibilityLabel={`${b.title} ${pct} percent`} style={{ marginTop: 2 }} /> : null}
      </View>
    </View>
  );
}

/**
 * Badges as a grid of seals. Tap one and its detail opens under its row; tap it again to close.
 * `open` is the open badge's id, held by the screen so only one is open at a time.
 */
export function BadgeGrid({ badges, open, onOpen, columns = 4, style }: { badges: GameBadge[]; open: string | null; onOpen: (id: string | null) => void; columns?: number; style?: StyleProp<ViewStyle> }) {
  const rows: GameBadge[][] = [];
  for (let i = 0; i < badges.length; i += columns) rows.push(badges.slice(i, i + columns));
  return (
    <View style={[{ gap: SP.lg }, style]}>
      {rows.map((row, r) => {
        const shown = row.find(b => b.id === open);
        return (
          <Fragment key={r}>
            <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: SP.sm }}>
              {row.map(b => (
                <Tap
                  key={b.id}
                  onPress={() => onOpen(open === b.id ? null : b.id)}
                  accessibilityState={{ expanded: open === b.id }}
                  accessibilityLabel={`${b.title}, ${b.earned ? `${b.tier}, earned ${landed(b.earned)}` : `locked, ${Math.round(b.progress * 100)} percent`}`}
                  accessibilityHint="Shows how to earn it"
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 2, minHeight: HIT }}
                >
                  <SpecialMoveCard title={b.title} tier={b.tier} earned={!!b.earned} icon={b.icon} progress={b.progress} width={columns > 4 ? 46 : 56} />
                  <Txt face="mono" raw size={12} lh={1.35} color={F.smoke}>{b.earned ? landed(b.earned) : `${Math.round(b.progress * 100)}%`}</Txt>
                </Tap>
              ))}
              {Array.from({ length: columns - row.length }, (_, i) => <View key={`pad-${i}`} style={{ flex: 1 }} />)}
            </View>
            {shown ? <BadgeDetail b={shown} /> : null}
          </Fragment>
        );
      })}
    </View>
  );
}
