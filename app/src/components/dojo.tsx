// Parts shared by the training screens (Dojo, workout, logs, badges, progress): inputs, quiet
// buttons, chips, stat strips and the special-move grid. Built on the Fight Night primitives.
import { parseIsoDate, type GameBadge } from '@rei/shared';
import { Fragment } from 'react';
import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { MeterBar, MoveCardArt, RoundStamp, SpecialMoveCard, TIER_COLOR } from './fight';
import { Icon, type IconKey } from './icons';
import { Tap, Txt } from './ui';
import { C, F, fontFamily, HIT, SP } from '../lib/theme';
import { useStore } from '../state/store';

/** A text field: square, canvas, a rope border that turns your colour once it holds something. `lg` is for the number that matters. */
export function Field({ label, size = 'md', style, value, ...rest }: Omit<TextInputProps, 'style'> & { label?: string; size?: 'lg' | 'md'; style?: StyleProp<ViewStyle> }) {
  const accent = useStore(s => s.accent), scale = useStore(s => s.settings.textSize);
  const big = size === 'lg';
  return (
    <View style={[{ gap: SP.sm }, style]}>
      {label ? <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke}>{label.toUpperCase()}</Txt> : null}
      <TextInput
        value={value}
        accessibilityLabel={label ?? rest.placeholder}
        placeholderTextColor={C.faint}
        keyboardAppearance="dark"
        {...rest}
        style={{ height: big ? 64 : 48, borderWidth: 2, borderColor: value ? accent : F.rope, backgroundColor: F.canvas, paddingHorizontal: big ? SP.lg : SP.md, paddingVertical: 0, fontFamily: fontFamily(big ? 'display' : 'body', 400), fontSize: (big ? 30 : 16) * scale, color: F.chalk }}
      />
    </View>
  );
}

/** A secondary action: an outlined strip, 44pt tall. `lit` draws it in your colour. */
export function QuietButton({ label, icon, onPress, onLongPress, disabled, lit, accessibilityLabel, style }: { label: string; icon?: IconKey; onPress?: () => void; onLongPress?: () => void; disabled?: boolean; lit?: boolean; accessibilityLabel?: string; style?: StyleProp<ViewStyle> }) {
  const accent = useStore(s => s.accent);
  const ink = disabled ? C.faint : lit ? accent : F.chalk;
  return (
    <Tap onPress={onPress} onLongPress={onLongPress} disabled={disabled} accessibilityLabel={accessibilityLabel ?? label} style={[{ minHeight: HIT, paddingHorizontal: SP.md, paddingVertical: SP.xs, borderWidth: 2, borderColor: lit && !disabled ? accent : F.rope, backgroundColor: F.canvas, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.sm }, style]}>
      {icon ? <Icon name={icon} size={18} color={ink} tint={0} strokeWidth={2} /> : null}
      <Txt face="label" w={600} size={14} ls={0.1} color={ink} align="center" style={{ flexShrink: 1 }}>{label.toUpperCase()}</Txt>
    </Tap>
  );
}

/** A filter chip: chalk when picked, quiet otherwise. */
export function Chip({ label, sub, on, onPress, style }: { label: string; sub?: string; on?: boolean; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Tap onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: !!on, checked: !!on }} accessibilityLabel={sub ? `${label}, ${sub}` : label} style={[{ minHeight: HIT, paddingHorizontal: SP.md, paddingVertical: SP.xs, justifyContent: 'center', borderWidth: 2, borderColor: on ? F.chalk : F.rope, backgroundColor: on ? F.chalk : F.canvas }, style]}>
      <Txt face="label" w={600} size={14} ls={0.08} color={on ? F.arena : F.chalk} numberOfLines={1}>{label.toUpperCase()}</Txt>
      {sub ? <Txt face="label" w={400} size={12} ls={0.08} color={on ? F.arena : F.smoke} numberOfLines={1}>{sub.toUpperCase()}</Txt> : null}
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

/** Numbers side by side on one canvas strip, split by ropes: the number is the loud part. Values keep their own case ("12 t", "5:42 /km"): units mean something else in capitals. */
export function StatStrip({ items, style }: { items: Stat[]; style?: StyleProp<ViewStyle> }) {
  const accent = useStore(s => s.accent);
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: F.canvas }, style]}>
      {items.map((x, i) => (
        <View key={x.k} accessible accessibilityLabel={`${x.k.toLowerCase()}: ${x.v}`} style={{ flex: 1, paddingVertical: SP.md, paddingHorizontal: SP.sm, alignItems: 'center', gap: 2, borderLeftWidth: i ? 2 : 0, borderLeftColor: F.arena }}>
          <Txt face="display" size={24} lh={1.2} color={x.hot ? accent : F.chalk} fit>{x.v}</Txt>
          <Txt face="label" w={600} size={12} ls={0.12} color={F.smoke} numberOfLines={1}>{x.k.toUpperCase()}</Txt>
        </View>
      ))}
    </View>
  );
}

const landed = (iso: string) => (parseIsoDate(iso) ?? new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();

/** One special move in full: the card, its rarity, how it is done, and when it landed or how close it is. */
export function BadgeDetail({ b, style }: { b: GameBadge; style?: StyleProp<ViewStyle> }) {
  const accent = useStore(s => s.accent);
  const pct = Math.round(b.progress * 100);
  return (
    <View accessibilityLiveRegion="polite" style={[{ backgroundColor: F.canvas, borderLeftWidth: 4, borderLeftColor: b.earned ? TIER_COLOR[b.tier] : F.rope, padding: SP.md, flexDirection: 'row', alignItems: 'center', gap: SP.md }, style]}>
      <MoveCardArt tier={b.tier} earned={!!b.earned} icon={b.icon} width={56} />
      <View style={{ flex: 1, gap: SP.xs, alignItems: 'flex-start' }}>
        <Txt face="display" size={22} lh={1.2} color={b.earned ? F.chalk : F.smoke}>{b.title.toUpperCase()}</Txt>
        <Txt size={14} w={500} lh={1.4} color={F.chalk}>{b.desc}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginTop: 2 }}>
          <RoundStamp label={b.earned ? b.tier : 'Locked'} tone={b.earned ? 'chalk' : 'outline'} size="sm" />
          <Txt face="label" w={600} size={12} ls={0.12} color={b.earned ? TIER_COLOR[b.tier] : F.smoke}>{b.earned ? `LANDED ${landed(b.earned)}` : `${pct}% THERE · ${b.tier.toUpperCase()}`}</Txt>
        </View>
        {!b.earned ? <MeterBar pct={b.progress} height={8} accent={accent} accessibilityLabel={`${b.title} ${pct} percent`} /> : null}
      </View>
    </View>
  );
}

/**
 * Badges as a grid of special-move cards. Tap one and its detail opens under its row; tap it again to close.
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
            <View style={{ flexDirection: 'row', gap: SP.sm }}>
              {row.map(b => (
                <Tap
                  key={b.id}
                  onPress={() => onOpen(open === b.id ? null : b.id)}
                  accessibilityState={{ expanded: open === b.id }}
                  accessibilityLabel={`${b.title}, ${b.earned ? `${b.tier}, unlocked ${landed(b.earned)}` : `locked, ${Math.round(b.progress * 100)} percent`}`}
                  accessibilityHint="Shows how to earn it"
                  style={{ flex: 1, alignItems: 'center', gap: 2, minHeight: HIT }}
                >
                  <SpecialMoveCard title={b.title} tier={b.tier} earned={!!b.earned} icon={b.icon} progress={b.progress} width={48} />
                  <Txt face="label" w={600} size={12} ls={0.1} color={F.smoke}>{b.earned ? landed(b.earned) : `${Math.round(b.progress * 100)}%`}</Txt>
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
