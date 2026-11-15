// The in-app confirm: an ink sheet that replaces the native alert. One question, one clear
// answer, and a quiet way out. With `cancelLabel={null}` it is a notice with a single button.
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CutButton } from './fight';
import { Txt } from './ui';
import { F, SP, STROKE } from '../lib/theme';

export interface ConfirmSheetProps {
  /** Shown or not (`visible` is accepted as another name for it). */
  open?: boolean;
  visible?: boolean;
  title: string;
  message?: string;
  /** The answer that does the thing ("Remove", "Delete"). */
  confirmLabel?: string;
  /** The way out. `null` hides it (a notice with one button). */
  cancelLabel?: string | null;
  /** The action can't be undone: the confirm button is drawn in paper, not the accent. */
  destructive?: boolean;
  /** Called when the confirm button is pressed, before `onClose`. */
  onConfirm?: () => void;
  /** Called on confirm, on cancel, and when the backdrop or the back button dismisses the sheet. */
  onClose?: () => void;
  /** Another name for `onClose`. */
  onCancel?: () => void;
}

export function ConfirmSheet({ open, visible, title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', destructive, onConfirm, onClose: close, onCancel }: ConfirmSheetProps) {
  const insets = useSafeAreaInsets();
  const onClose = () => (close ?? onCancel)?.();
  return (
    <Modal visible={!!(open ?? visible)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel ?? 'Dismiss'} onPress={onClose} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(14,14,16,0.8)' }} />
        <View accessibilityViewIsModal style={{ backgroundColor: F.arena, borderTopWidth: STROKE, borderTopColor: F.chalk, paddingHorizontal: SP.lg, paddingTop: SP.xl, paddingBottom: Math.max(insets.bottom, SP.lg) + SP.sm, gap: SP.md }}>
          <View accessibilityRole="header" style={{ alignItems: 'flex-start' }}>
            <Txt face="display" exact size={18} lh={1.3}>{title.toUpperCase()}</Txt>
          </View>
          {message ? <Txt size={15} w={500} lh={1.4} color={F.smoke}>{message}</Txt> : null}
          <View style={{ gap: SP.sm, marginTop: SP.sm }}>
            <CutButton
              size="md"
              tone={destructive ? 'chalk' : 'accent'}
              label={confirmLabel}
              onPress={() => {
                onConfirm?.();
                onClose();
              }}
            />
            {cancelLabel ? <CutButton size="md" tone="quiet" label={cancelLabel} onPress={onClose} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
