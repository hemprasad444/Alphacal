// The title block at the top of each tab: a small boxed tag and one mono line of meta, then the
// title in large Mincho. On the right: an extra (the streak, say), the profile button and
// today's date set down the edge.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon, type IconKey } from './icons';
import { SealTag } from './ink';
import { Tap, Txt } from './ui';
import { C, HIT, RADIUS } from '../lib/theme';
import { useStore } from '../state/store';

const SIDE = 64;

/** Today's date down the right edge, in English: "SUN 15". Decoration: the meta line says it too. */
function SideDate() {
  const now = new Date();
  const text = `${now.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()} ${now.getDate()}`;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 16, height: SIDE, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: SIDE, height: 16, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '90deg' }] }}>
        <Txt face="mono" raw size={12} lh={1.35} color={C.smoke} numberOfLines={1} style={{ letterSpacing: 2.5 }}>{text}</Txt>
      </View>
    </View>
  );
}

/**
 * `icon` is drawn inside the tag (the title's initial without one). `sub` is the meta line beside
 * it ("Sun 15 Nov · Week 1"); it shrinks rather than wrap. `right` goes before the profile
 * button. The title shrinks to fit what is left of the row.
 */
export function PageTitle({ icon, title, sub, right }: { icon?: IconKey; title: string; sub: string; right?: ReactNode }) {
  const accent = useStore(s => s.accent), name = useStore(s => s.profile.name);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 8, minHeight: SIDE + 8 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 }}>
          <SealTag icon={icon} text={title.trim().charAt(0).toUpperCase()} />
          {sub ? <View style={{ flex: 1 }}><Txt face="mono" size={12} lh={1.35} color={C.smoke} fit>{sub}</Txt></View> : null}
        </View>
        <View accessibilityRole="header" style={{ alignItems: 'flex-start' }}>
          <Txt face="display" exact size={34} lh={1.18} ls={-0.01} fit>{title}</Txt>
        </View>
      </View>
      {right ? <View style={{ minHeight: HIT, justifyContent: 'center' }}>{right}</View> : null}
      <Tap onPress={() => router.push('/settings')} accessibilityLabel="Profile and settings" style={{ width: HIT, height: HIT, borderWidth: 1, borderColor: C.rule, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: C.canvas }}>
        {name ? <Txt face="heading" raw size={18} lh={1.25} color={accent}>{name.trim().charAt(0).toUpperCase()}</Txt> : <Icon name="profile" size={22} color={accent} />}
      </Tap>
      <SideDate />
    </View>
  );
}
