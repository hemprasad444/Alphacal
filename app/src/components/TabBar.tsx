import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useStore } from '../state/store';
import { week, todaysPlan } from '@rei/shared';
import { C } from '../lib/theme';
import { Tap, Txt } from './ui';

/** Brush-thin line glyphs for the four tabs (24×24). */
const GLYPHS: Record<string, ReactNode> = {
  // Today: the sun coming up.
  index: (
    <>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
    </>
  ),
  // Fuel: a steaming bowl.
  fuel: (
    <>
      <Path d="M3 11h18a9 9 0 0 1-18 0z" />
      <Path d="M9 3c-1 1.5 1 2.5 0 4M14 3c-1 1.5 1 2.5 0 4" />
    </>
  ),
  // Dojo: a barbell.
  dojo: <Path d="M6 7v10M3 10v4M18 7v10M21 10v4M6 12h12" />,
  // Vow: the goal flag you planted.
  vow: <Path d="M6 21V3M6 4h12l-3 4 3 4H6" />,
};

const LABELS: Record<string, string> = { index: 'Today', fuel: 'Fuel', dojo: 'Dojo', vow: 'Vow' };

/** Height of the row of tabs, above the bottom safe area. */
const BAR = 56;
/** The round REI seal, and how far it rises above the bar. */
const REI = 64, RISE = 28;

/**
 * Bottom bar: Today · Fuel · REI · Dojo · Vow, a shade lighter than the page under a hairline.
 * The current tab takes the accent with a short brush stroke under its name. REI is the round
 * red seal in the middle and opens the chat; a small rice-paper dot sits on it when a session is
 * slipping away this week.
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
        style={{ flex: 1, height: BAR, alignItems: 'center', justifyContent: 'center', gap: 2 }}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={on ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">{GLYPHS[name]}</Svg>
        <Txt face={on ? 'labelItalic' : 'label'} size={12} lh={1.25} ls={0.04} color={color}>{LABELS[name]}</Txt>
        <View style={{ height: 4 }}>
          {on ? (
            <Svg width={20} height={4} viewBox="0 0 20 4">
              <Path d="M0 2C5 .6 14 .8 20 2 14 3.2 5 3.4 0 2Z" fill={color} />
            </Svg>
          ) : null}
        </View>
      </Tap>
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      {/* The bar ends above the home indicator: its colour carries on under it. */}
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', alignItems: 'flex-start', paddingTop: 8, paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom - 4, 12), backgroundColor: C.bar, borderTopWidth: 1, borderTopColor: C.line2 }}>
        {tab('index')}
        {tab('fuel')}
        <View style={{ width: REI + 12, alignItems: 'center' }}>
          <Tap
            onPress={() => router.push('/talk')}
            accessibilityLabel={slipping ? 'Talk to REI. A session is slipping this week.' : 'Talk to REI'}
            style={{ marginTop: -RISE - 8, alignItems: 'center', gap: 2 }}
          >
            <View style={{ width: REI, height: REI }}>
              <Svg width={REI} height={REI} viewBox="0 0 64 64">
                {/* A disc in the bar's colour keeps the seal clear of the hairline. */}
                <Circle cx={32} cy={32} r={32} fill={C.bar} />
                <Path d="M32 3.5A28.5 28.5 0 1 1 12 11.5" fill="none" stroke={s.accent} strokeWidth={1.5} strokeLinecap="round" />
                <Path d="M32 7.5C46 7 56.6 18 56.5 31.8 56.6 46 45.8 56.6 32.2 56.5 18 56.6 7.4 46 7.5 32 7.6 18.2 18.2 7.8 32 7.5Z" fill={C.seal} />
              </Svg>
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: REI, height: REI, alignItems: 'center', justifyContent: 'center' }}>
                <Txt face="display" exact raw size={28} lh={1.2} color={C.carved}>R</Txt>
              </View>
              {slipping ? <View style={{ position: 'absolute', top: 6, right: 6, width: 12, height: 12, borderRadius: 6, backgroundColor: C.chalk, borderWidth: 2, borderColor: C.bar }} /> : null}
            </View>
            <Txt face="labelItalic" raw size={12} lh={1.25} color={C.chalk} style={{ letterSpacing: 1.5 }}>REI</Txt>
          </Tap>
        </View>
        {tab('dojo')}
        {tab('vow')}
      </View>
    </View>
  );
}
