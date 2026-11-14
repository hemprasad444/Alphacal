import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import type { ReactElement, ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from './Backdrop';
import { IconButton, Txt } from './ui';
import { C, HIT } from '../lib/theme';

/** Room the tab bar takes at the bottom of a tab screen, above the safe area (bar plus the raised REI button). */
export const TAB_BAR_ROOM = 94;

/** Scrolling page on the arena backdrop. `tabs` leaves room for the tab bar. */
export function Screen({ children, tabs = true }: { children: ReactNode; tabs?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: tabs ? Math.max(insets.bottom, 12) + TAB_BAR_ROOM + 20 : insets.bottom + 40 }}
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

/** Like Screen, but the page is a virtualised list: only rows on screen are rendered. */
export function ListScreen<T>({ header, data, renderItem, keyExtractor, footer }: { header: ReactElement; data: T[]; renderItem: ListRenderItem<T>; keyExtractor: (item: T, index: number) => string; footer?: ReactElement | null }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <FlashList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />
    </View>
  );
}

/** Back button and the page name as a leaning display title, on a rope. */
export function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: HIT, paddingTop: 6, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: C.rope }}>
      <IconButton size={40} onPress={onBack} accessibilityLabel="Back">‹</IconButton>
      <View accessibilityRole="header" style={{ flex: 1, alignItems: 'flex-start' }}>
        <Txt face="display" size={26} ls={0.02} fit>{title.toUpperCase()}</Txt>
      </View>
    </View>
  );
}
