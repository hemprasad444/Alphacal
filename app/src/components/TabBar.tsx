import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon, Rect } from 'react-native-svg';
import { useStore } from '../state/store';
import { week, todaysPlan } from '@rei/shared';
import { C, onColor, SHADOW } from '../lib/theme';
import { CutBox, CutShape } from './cut';
import { Tap, Txt } from './ui';

/** Flat, cut glyphs for the four tabs (24×24). */
const GLYPHS: Record<string, (c: string) => ReactNode> = {
  // Today: the versus split.
  index: c => (
    <>
      <Polygon points="2,4 13,4 9,20 2,20" fill={c} />
      <Polygon points="16,4 22,4 22,20 12,20" fill={c} opacity={0.55} />
    </>
  ),
  // Fuel: a meter filling up.
  fuel: c => (
    <>
      <Polygon points="8,4 15,4 14,8 7,8" fill={c} />
      <Polygon points="7,10 19,10 18,14 6,14" fill={c} />
      <Polygon points="5,16 22,16 21,20 4,20" fill={c} />
    </>
  ),
  // Dojo: steps up.
  dojo: c => <Polygon points="3,20 3,15 9,15 9,10 15,10 15,5 21,5 21,20" fill={c} />,
  // Vow: a flag planted.
  vow: c => (
    <>
      <Rect x={4} y={3} width={3} height={18} fill={c} />
      <Polygon points="8,4 21,4 17,9 21,14 8,14" fill={c} />
    </>
  ),
};

const LABELS: Record<string, string> = { index: 'Today', fuel: 'Fuel', dojo: 'Dojo', vow: 'Vow' };

/** Height of the row of tabs, above the bottom safe area. */
const BAR = 60;
/** How far the REI button rises above the bar. */
const RISE = 20;

/**
 * Bottom bar: Today · Fuel · REI · Dojo · Vow. The current tab is in your corner colour under a
 * cut marker. REI, your corner coach, is the raised slab in the middle and opens the chat; it
 * carries a red flag when a session is slipping away this week.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const s = useStore();
  const { sessionDone } = s;
  const slipping = !!todaysPlan(new Date(), s.program) && !sessionDone && week(s.history, sessionDone, new Date(), s.program).missed > 0;

  const tab = (name: string) => {
    const i = state.routes.findIndex(r => r.name === name);
    const on = state.index === i;
    const color = on ? s.accent : C.smoke;
    return (
      <Tap
        key={name}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={LABELS[name]}
        onPress={() => {
          if (!on) navigation.navigate(name);
        }}
        style={{ flex: 1, height: BAR, alignItems: 'center' }}
      >
        <CutShape width={32} height={4} fill={on ? s.accent : 'transparent'} />
        <Svg width={24} height={24} viewBox="0 0 24 24" style={{ marginTop: 8 }}>{GLYPHS[name](color)}</Svg>
        <Txt face="label" w={600} size={12} ls={0.12} color={color} style={{ marginTop: 3 }}>{LABELS[name].toUpperCase()}</Txt>
      </Tap>
    );
  };

  const ink = onColor(s.accent);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 8, paddingBottom: Math.max(insets.bottom - 8, 10), backgroundColor: C.arena, borderTopWidth: 2, borderTopColor: C.rope }}>
        {tab('index')}
        {tab('fuel')}
        <View style={{ flex: 1.2, alignItems: 'center' }}>
          <Tap
            onPress={() => router.push('/talk')}
            accessibilityLabel={slipping ? 'Talk to REI, your corner coach. A session is slipping this week.' : 'Talk to REI, your corner coach'}
            style={{ marginTop: -RISE, paddingRight: SHADOW, paddingBottom: SHADOW, marginLeft: SHADOW }}
          >
            <CutBox fill={s.accent} shadow={C.chalk} style={{ width: 78, height: 66, alignItems: 'center', justifyContent: 'center' }}>
              <Txt face="display" lean={false} size={28} lh={1.1} ls={0.03} color={ink}>REI</Txt>
              <Txt face="label" w={600} size={12} ls={0.16} lh={1.15} color={ink}>TALK</Txt>
            </CutBox>
            {slipping ? <View style={{ position: 'absolute', top: -4, right: 2, width: 14, height: 14, backgroundColor: C.rival, borderWidth: 2, borderColor: C.arena }} /> : null}
          </Tap>
        </View>
        {tab('dojo')}
        {tab('vow')}
      </View>
    </View>
  );
}
