// The title block at the top of each tab: leaning display title, two quiet lines of meta, profile button.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon, type IconKey } from './icons';
import { Tap, Txt } from './ui';
import { C, HIT } from '../lib/theme';
import { useStore } from '../state/store';

/**
 * `sub` becomes the meta beside the title; " · " splits it onto two lines, as evenly as it can
 * ("SUN 15 NOV" over "WEEK 1 · DEMO"), and a line that is still too long shrinks instead of being cut.
 * `icon` is kept for callers but no longer drawn: the title is the mark. `right` goes before the
 * profile button (a Combo, say).
 */
export function PageTitle({ title, sub, right }: { icon?: IconKey; title: string; sub: string; right?: ReactNode }) {
  const accent = useStore(s => s.accent), name = useStore(s => s.profile.name);
  const parts = sub.split(' · ');
  const longer = (i: number) => Math.max(parts.slice(0, i).join(' · ').length, parts.slice(i).join(' · ').length);
  let cut = 1;
  for (let i = 2; i < parts.length; i++) if (longer(i) < longer(cut)) cut = i;
  const lines = parts.length > 2 ? [parts.slice(0, cut).join(' · '), parts.slice(cut).join(' · ')] : parts;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HIT, paddingTop: 6 }}>
      <View accessibilityRole="header" style={{ flexShrink: 1 }}>
        <Txt face="display" size={32} ls={0.015} fit>{title.toUpperCase()}</Txt>
      </View>
      <View style={{ flex: 1, minWidth: 92 }}>
        {lines.map((l, i) => <Txt key={i} face="label" w={600} size={12} ls={0.12} lh={1.2} color={C.smoke} fit>{l.toUpperCase()}</Txt>)}
      </View>
      {right}
      <Tap onPress={() => router.push('/settings')} accessibilityLabel="Profile and settings" style={{ width: HIT, height: HIT, borderWidth: 2, borderColor: accent, alignItems: 'center', justifyContent: 'center', backgroundColor: C.canvas }}>
        {name ? <Txt face="display" lean={false} size={20} color={accent}>{name.trim().charAt(0).toUpperCase()}</Txt> : <Icon name="profile" size={22} color={accent} />}
      </Tap>
    </View>
  );
}
