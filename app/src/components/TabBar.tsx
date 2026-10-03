import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../state/store';
import { week, todaysPlan } from '@rei/shared';
import { C } from '../lib/theme';
import { Core } from './Core';
import { Icon, type IconKey } from './icons';
import { Label, Tap } from './ui';

const TABS: Record<string, { icon: IconKey; label: string }> = {
  index: { icon: 'today', label: 'TODAY' },
  fuel: { icon: 'fuel', label: 'FUEL' },
  dojo: { icon: 'train', label: 'DOJO' },
  vow: { icon: 'vow', label: 'VOW' },
};

/** Floating glass pill: Today · Fuel · REI · Dojo · Vow. REI opens the chat. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const s = useStore();
  const { sessionDone } = s;
  const slipping = !!todaysPlan(new Date(), s.program) && !sessionDone && week(s.history, sessionDone, new Date(), s.program).missed > 0;

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
        style={{ flex: 1, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: on ? 'rgba(255,255,255,0.08)' : 'transparent' }}
      >
        <Icon name={t.icon} size={21} color={on ? s.accent : C.label} tint={on ? 0.3 : 0.1} />
        <Label size={8.5} ls={0.12} color={on ? C.text : C.label}>{t.label}</Label>
      </Tap>
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom - 8, 12) }}>
      <View style={{ height: 66, borderRadius: 33, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 24 } }}>
        <BlurView intensity={40} tint="dark" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, backgroundColor: 'rgba(16,18,22,0.72)' }}>
          {tab('index')}
          {tab('fuel')}
          <Tap onPress={() => router.push('/talk')} style={{ width: 62, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Core size={32} alert={slipping} />
            <Label size={8.5} ls={0.12} color={C.body}>REI</Label>
          </Tap>
          {tab('dojo')}
          {tab('vow')}
        </BlurView>
      </View>
    </View>
  );
}
