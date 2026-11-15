// The title block at the top of each tab: a leaning accent tag, the heavy display title, the
// streak or another extra, the profile button, and one quiet line of meta underneath.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon, type IconKey } from './icons';
import { SkewTag } from './ink';
import { Tap, Txt } from './ui';
import { C, HIT, STROKE } from '../lib/theme';
import { useStore } from '../state/store';

/**
 * `icon` is drawn inside the tag (a plain tag without one). `sub` is the meta line under the
 * title ("SUN 15 NOV · WEEK 1"); it shrinks rather than wrap. `right` goes before the profile
 * button (a Combo, say). The title shrinks to fit what is left of the row.
 */
export function PageTitle({ icon, title, sub, right }: { icon?: IconKey; title: string; sub: string; right?: ReactNode }) {
  const accent = useStore(s => s.accent), name = useStore(s => s.profile.name);
  return (
    <View style={{ paddingTop: 6, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: HIT }}>
        <SkewTag icon={icon} color={accent} size="lg" />
        <View accessibilityRole="header" style={{ flexShrink: 1 }}>
          <Txt face="display" exact size={title.length <= 5 ? 28 : 24} lh={1.2} fit>{title.toUpperCase()}</Txt>
        </View>
        <View style={{ flex: 1, minWidth: 4 }} />
        {right}
        <Tap onPress={() => router.push('/settings')} accessibilityLabel="Profile and settings" style={{ width: HIT, height: HIT, borderWidth: STROKE, borderColor: C.chalk, alignItems: 'center', justifyContent: 'center', backgroundColor: C.canvas }}>
          {name ? <Txt face="display" exact size={16} lh={1.25} color={accent}>{name.trim().charAt(0).toUpperCase()}</Txt> : <Icon name="profile" size={22} color={accent} />}
        </Tap>
      </View>
      {sub ? <Txt face="label" size={12} lh={1.3} color={C.smoke} fit>{sub}</Txt> : null}
    </View>
  );
}
