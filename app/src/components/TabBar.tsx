import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../state/store';
import { week, todaysPlan } from '../lib/derive';
import { C } from '../lib/theme';
import { Core } from './Core';
import { Label, Tap, Txt } from './ui';

const TABS: Record<string, { kanji: string; label: string }> = {
  index: { kanji: '今日', label: 'TODAY' },
  fuel: { kanji: '食', label: 'FUEL' },
  vow: { kanji: '誓', label: 'VOW' },
};

/** Floating glass pill: Today · Fuel · REI · Vow. REI opens the chat. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { settings, sessionDone } = useStore();
  const slipping = !!todaysPlan() && !sessionDone && week(settings.scenario, sessionDone).missed > 0;

  const tab = (name: string) => {
    const i = state.routes.findIndex(r => r.name === name);
    const on = state.index === i;
    const t = TABS[name];
    return (
      <Tap
        key={name}
        onPress={() => {
          if (!on) navigation.navigate(name);
        }}
        style={{ flex: 1, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: on ? 'rgba(255,255,255,0.08)' : 'transparent' }}
      >
        <Txt face="jp" size={15} color={on ? C.text : C.label}>{t.kanji}</Txt>
        <Label size={9} color={on ? C.text : C.label}>{t.label}</Label>
      </Tap>
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 24, right: 24, bottom: Math.max(insets.bottom - 8, 12) }}>
      <View style={{ height: 66, borderRadius: 33, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 24 } }}>
        <BlurView intensity={40} tint="dark" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 7, backgroundColor: 'rgba(16,18,22,0.72)' }}>
          {tab('index')}
          {tab('fuel')}
          <Tap onPress={() => router.push('/talk')} style={{ flex: 1, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Core size={30} alert={slipping} />
            <Label size={10} color={C.body}>REI</Label>
          </Tap>
          {tab('vow')}
        </BlurView>
      </View>
    </View>
  );
}
