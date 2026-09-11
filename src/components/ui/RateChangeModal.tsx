import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from './TextField';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface RateChangeValue {
  ratePercent: string;
  effectiveDate: string;
}

interface RateChangeModalProps {
  visible: boolean;
  initial: RateChangeValue;
  onCancel: () => void;
  onSubmit: (value: RateChangeValue) => void;
  onDelete?: () => void;
}

// Add/edit one row of a loan's interest-rate history (rate + the date it
// took effect) — same small-card modal shell as PromptModal, two fields.
export function RateChangeModal({ visible, initial, onCancel, onSubmit, onDelete }: RateChangeModalProps) {
  const [ratePercent, setRatePercent] = useState(initial.ratePercent);
  const [effectiveDate, setEffectiveDate] = useState(initial.effectiveDate);

  useEffect(() => {
    if (visible) {
      setRatePercent(initial.ratePercent);
      setEffectiveDate(initial.effectiveDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = () => {
    if (!ratePercent.trim() || !effectiveDate.trim()) return;
    onSubmit({ ratePercent: ratePercent.trim(), effectiveDate: effectiveDate.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Rate Change</Text>
          <TextField label="Rate (annual %)" value={ratePercent} onChangeText={setRatePercent} keyboardType="decimal-pad" placeholder="e.g. 6.25" autoFocus />
          <TextField label="Effective Date" value={effectiveDate} onChangeText={setEffectiveDate} placeholder="YYYY-MM-DD" />
          <View style={styles.actions}>
            {onDelete ? (
              <Pressable onPress={onDelete}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <View style={styles.rightActions}>
              <Pressable onPress={onCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={submit}>
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deleteText: { color: colors.negative, fontWeight: '600' },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
