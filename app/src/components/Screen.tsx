import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from './Backdrop';
import { IconButton, Label } from './ui';
import { C } from '../lib/theme';

/** Scrolling page with the themed backdrop. `tabs` leaves room for the floating tab bar. */
export function Screen({ children, tabs = true }: { children: ReactNode; tabs?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: tabs ? 128 : insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Back button, centered mono title, spacer. */
export function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
      <IconButton onPress={onBack}>‹</IconButton>
      <Label color={C.muted}>{title}</Label>
      <View style={{ width: 36 }} />
    </View>
  );
}
