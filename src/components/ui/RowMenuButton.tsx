import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface MenuItem {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

interface RowMenuButtonProps {
  items: MenuItem[];
}

// Inline "⋯" per-row action menu (group/category rows on the Budget
// screen). Renders as a bottom action sheet rather than an anchored
// dropdown — no coordinate math needed, and it reads fine at row scale.
export function RowMenuButton({ items }: RowMenuButtonProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);

  // An item's own onPress often opens another modal/Alert of its own (e.g.
  // Settings' board delete confirms via Alert.alert) — firing that in the
  // same tick as this sheet's own dismissal stacks two native modal
  // transitions at once, which can wedge iOS's window presentation state
  // entirely (screen looks normal, touches stop landing anywhere, no crash
  // — see delete-board freeze investigation). `onDismiss` fires exactly
  // when this sheet's own dismiss animation actually finishes — no
  // guessed duration, and it still holds up if that animation is skipped
  // (Reduce Motion) or slower than usual (loaded device). Android's Modal
  // doesn't call onDismiss at all, but doesn't share this iOS-specific
  // wedging either, so it runs the action right away there.
  const runDismissed = () => {
    const fn = pendingRef.current;
    pendingRef.current = null;
    fn?.();
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} style={styles.trigger}>
        <Text style={styles.triggerText}>⋯</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        onDismiss={runDismissed}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {items.map((item) => (
              <Pressable
                key={item.label}
                style={styles.item}
                onPress={() => {
                  pendingRef.current = item.onPress;
                  setOpen(false);
                  if (Platform.OS !== 'ios') runDismissed();
                }}
              >
                <Text style={[styles.itemText, item.destructive && styles.itemTextDestructive]}>{item.label}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.cancel} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { paddingHorizontal: 6, paddingVertical: 2 },
  triggerText: { fontSize: 18, fontWeight: '700', color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { padding: spacing.md, gap: spacing.sm },
  item: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  itemText: { fontSize: 16, fontWeight: '600', color: colors.text },
  itemTextDestructive: { color: colors.negative },
  cancel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '700', color: colors.text },
});
