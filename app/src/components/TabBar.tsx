import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useStore } from '../state/store';
import { week, todaysPlan } from '@rei/shared';
import { C, onColor, STROKE } from '../lib/theme';
import { SkewBox } from './cut';
import { Tap, Txt } from './ui';

/** Inked line glyphs for the four tabs (24×24). */
const GLYPHS: Record<string, ReactNode> = {
  // Today: the sun coming up.
  index: (
    <>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
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
  // Vow: a gate.
  vow: <Path d="M2 6h20M5 10h14M7 6v15M17 6v15" />,
};

const LABELS: Record<string, string> = { index: 'Today', fuel: 'Fuel', dojo: 'Dojo', vow: 'Vow' };

/** Height of the row of tabs, above the bottom safe area. */
const BAR = 58;
/** The round REI button, and how far it rises above the bar. */
const REI = 68, RISE = 24;

/**
 * Bottom bar: Today · Fuel · REI · Dojo · Vow, on ink under a paper rule. The current tab's
 * glyph sits in a leaning accent tag. REI is the round accent button in the middle and opens the
 * chat; it carries a pop-red flag when a session is slipping away this week.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const s = useStore();
  const { sessionDone } = s;
  const slipping = !!todaysPlan(new Date(), s.program) && !sessionDone && week(s.history, sessionDone, new Date(), s.program).missed > 0;
  const ink = onColor(s.accent);

  const glyph = (name: string, color: string, size: number, width: number) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">{GLYPHS[name]}</Svg>
  );

  const tab = (name: string) => {
    const i = state.routes.findIndex(r => r.name === name);
    const on = state.index === i;
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
        {on ? (
          <SkewBox fill={s.accent} style={{ width: 42, height: 28, alignItems: 'center', justifyContent: 'center' }}><View>{glyph(name, ink, 20, 2.4)}</View></SkewBox>
        ) : (
          <View style={{ width: 42, height: 28, alignItems: 'center', justifyContent: 'center' }}>{glyph(name, C.smoke, 22, 2.2)}</View>
        )}
        <Txt face={on ? 'labelItalic' : 'label'} size={12} lh={1.3} color={on ? s.accent : C.smoke}>{LABELS[name]}</Txt>
      </Tap>
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      {/* The bar ends above the home indicator: its ink carries on under it. */}
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 8, paddingBottom: Math.max(insets.bottom - 6, 10), backgroundColor: C.arena, borderTopWidth: STROKE, borderTopColor: C.chalk }}>
        {tab('index')}
        {tab('fuel')}
        <View style={{ width: REI + 18, alignItems: 'center' }}>
          <Tap
            onPress={() => router.push('/talk')}
            accessibilityLabel={slipping ? 'Talk to REI. A session is slipping this week.' : 'Talk to REI'}
            style={{ marginTop: -RISE }}
          >
            {/* An ink ring keeps the button clear of the bar's rule. */}
            <View style={{ width: REI + 10, height: REI + 10, borderRadius: (REI + 10) / 2, backgroundColor: C.arena, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: REI, height: REI, borderRadius: REI / 2, backgroundColor: s.accent, borderWidth: STROKE, borderColor: C.chalk, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={24} height={22} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={2.6} strokeLinecap="round">
                  <Path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
                </Svg>
                <Txt face="display" exact size={14} lh={1.2} color={ink}>REI</Txt>
              </View>
            </View>
            {slipping ? <View style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: C.rival, borderWidth: 2, borderColor: C.arena }} /> : null}
          </Tap>
        </View>
        {tab('dojo')}
        {tab('vow')}
      </View>
    </View>
  );
}
