// The in-app confirm: a Fight Night sheet from the bottom instead of the system alert.
// One loud action (a cut slab) and a quiet way out. `destructive` puts the action in the far
// corner's red, for things that can't be undone.
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CutButton } from './fight';
import { Tap, Txt } from './ui';
import { C, HIT, SP } from '../lib/theme';
import { useStore } from '../state/store';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  /** The action's label ("Sign out"). */
  confirmLabel: string;
  /** The way out. Pass null for a notice with one button (the action just closes it). */
  cancelLabel?: string | null;
  /** The action deletes or resets something. */
  destructive?: boolean;
  onConfirm: () => void;
  /** Cancel, the dimmed area, and the Android back button. */
  onCancel: () => void;
}

export function ConfirmSheet({ visible, title, message, confirmLabel, cancelLabel = 'Cancel', destructive, onConfirm, onCancel }: ConfirmSheetProps) {
  const insets = useSafeAreaInsets();
  const accent = useStore(s => s.accent);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Dismiss" accessibilityRole="button" onPress={onCancel} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,12,16,0.72)' }]} />
        <View accessibilityViewIsModal style={{ backgroundColor: C.canvas, borderTopWidth: 4, borderTopColor: destructive ? C.rival : accent, paddingHorizontal: SP.lg, paddingTop: SP.xl, paddingBottom: Math.max(insets.bottom, SP.lg) + SP.sm, gap: SP.md }}>
          <View accessibilityRole="header" style={{ alignItems: 'flex-start' }}>
            <Txt face="display" size={28} lh={1.15}>{title.toUpperCase()}</Txt>
          </View>
          {message ? <Txt size={15} w={500} lh={1.45} color={C.body}>{message}</Txt> : null}
          <CutButton label={confirmLabel} onPress={onConfirm} accent={destructive ? C.rival : accent} style={{ marginTop: SP.sm }} />
          {cancelLabel ? (
            <Tap onPress={onCancel} accessibilityLabel={cancelLabel} style={{ minHeight: HIT, alignItems: 'center', justifyContent: 'center' }}>
              <Txt face="label" w={600} size={15} ls={0.12} color={C.smoke}>{cancelLabel.toUpperCase()}</Txt>
            </Tap>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
