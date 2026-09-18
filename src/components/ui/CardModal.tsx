import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// The small centred card every "log one figure" dialog uses — a value, a
// rate, a rename. Extracted because the shell is the fiddly part and it was
// being fixed one copy at a time.
//
// Three behaviours the copies each had to get right:
// - tapping the backdrop cancels;
// - tapping the card does not (it would cancel and lose what you typed), but
//   does put the keyboard away, since tapping off a field is how anyone
//   expects to dismiss it;
// - the card rises above the keyboard instead of sitting centred behind it,
//   which left the field you were typing into hidden on a short screen.
export function CardModal({ visible, onCancel, children }: { visible: boolean; onCancel: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.avoider} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onCancel}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              style={styles.card}
              onPress={(e) => {
                e.stopPropagation();
                Keyboard.dismiss();
              }}
            >
              {children}
            </Pressable>
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avoider: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  // A card taller than what's left above the keyboard scrolls rather than
  // running off the screen — the delete/save row is the part that would go.
  scroll: { flexGrow: 0 },
  scrollContent: { justifyContent: 'center' },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
