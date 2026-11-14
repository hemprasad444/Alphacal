// The title block at the top of each tab: leaning display title, two quiet lines of meta, profile button.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon, type IconKey } from './icons';
import { Tap, Txt } from './ui';
import { C, HIT } from '../lib/theme';
import { useStore } from '../state/store';

/**
 * `sub` becomes the meta beside the title; " · " splits it onto two lines ("SUN 15 NOV · WEEK 1").
 * `icon` is kept for callers but no longer drawn: the title is the mark. `right` goes before the
 * profile button (a Combo, say).
 */
export function PageTitle({ title, sub, right }: { icon?: IconKey; title: string; sub: string; right?: ReactNode }) {
  const accent = useStore(s => s.accent), name = useStore(s => s.profile.name);
  const parts = sub.split(' · ');
  const lines = parts.length > 2 ? [parts.slice(0, parts.length - 1).join(' · '), parts[parts.length - 1]] : parts;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HIT, paddingTop: 6 }}>
      <View accessibilityRole="header" style={{ flexShrink: 1 }}>
        <Txt face="display" size={32} ls={0.015} fit>{title.toUpperCase()}</Txt>
      </View>
      <View style={{ flex: 1, minWidth: 60 }}>
        {lines.map((l, i) => <Txt key={i} face="label" w={600} size={12} ls={0.12} lh={1.2} color={C.smoke} numberOfLines={1}>{l.toUpperCase()}</Txt>)}
      </View>
      {right}
      <Tap onPress={() => router.push('/settings')} accessibilityLabel="Profile and settings" style={{ width: HIT, height: HIT, borderWidth: 2, borderColor: accent, alignItems: 'center', justifyContent: 'center', backgroundColor: C.canvas }}>
        {name ? <Txt face="display" lean={false} size={20} color={accent}>{name.trim().charAt(0).toUpperCase()}</Txt> : <Icon name="profile" size={22} color={accent} />}
      </Tap>
    </View>
  );
}
