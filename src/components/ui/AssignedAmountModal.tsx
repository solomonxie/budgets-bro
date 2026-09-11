import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface AssignedAmountModalProps {
  visible: boolean;
  categoryName: string;
  categoryIcon: string | null;
  initialCents: number;
  onSave: (cents: number) => void;
  onHistory: () => void;
  onClose: () => void;
}

// YNAB-style "tap the amount, get a big number field" popup — a modal
// instead of expanding the category row in place, so the list doesn't
// reflow every time a category is tapped. One "Done" button, centered —
// every way of dismissing (Done, backdrop tap, hardware back) commits the
// typed amount, there's no separate discard-and-cancel path. History is
// secondary, pinned to the right.
export function AssignedAmountModal({
  visible,
  categoryName,
  categoryIcon,
  initialCents,
  onSave,
  onHistory,
  onClose,
}: AssignedAmountModalProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue((initialCents / 100).toString());
  }, [visible, initialCents]);

  const done = () => {
    const parsed = parseFloat(value);
    onSave(Number.isNaN(parsed) ? 0 : Math.round(parsed * 100));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={done}>
      <Pressable style={styles.backdrop} onPress={done}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>
            {categoryIcon ? `${categoryIcon} ` : ''}
            {categoryName}
          </Text>
          <Text style={styles.label}>Assigned this month</Text>
          <TextInput
            style={styles.amountInput}
            keyboardType="decimal-pad"
            value={value}
            onChangeText={setValue}
            autoFocus
            selectTextOnFocus
            onSubmitEditing={done}
          />
          <View style={styles.actions}>
            <View style={styles.sideSlot} />
            <View style={styles.centerActions}>
              <Pressable style={styles.saveButton} onPress={done}>
                <Text style={styles.saveButtonText}>Done</Text>
              </Pressable>
            </View>
            <View style={[styles.sideSlot, styles.sideSlotRight]}>
              <Pressable onPress={onHistory}>
                <Text style={styles.sideText}>History</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // The amount field autofocuses (keyboard opens immediately) — sits a
  // bit above center instead of dead-centered, so there's a real gap
  // above the keyboard rather than the card landing right on top of it.
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '48%', paddingHorizontal: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  amountInput: {
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
    paddingVertical: 6,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  sideSlot: { minWidth: 50 },
  sideSlotRight: { alignItems: 'flex-end' },
  sideText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  centerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  saveButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
