import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from './TextField';
import { DateField } from './DateField';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface HouseValueChangeValue {
  value: string;
  effectiveDate: string;
}

interface HouseValueModalProps {
  visible: boolean;
  initial: HouseValueChangeValue;
  onCancel: () => void;
  onSubmit: (value: HouseValueChangeValue) => void;
  onDelete?: () => void;
}

function splitSign(value: string): { negative: boolean; magnitude: string } {
  const trimmed = value.trim();
  return trimmed.startsWith('-') ? { negative: true, magnitude: trimmed.slice(1) } : { negative: false, magnitude: trimmed };
}

// Add/edit one row of a mortgage's home-value history (value + the date it
// took effect) — same small-card modal shell as RateChangeModal. The sign
// toggle exists because decimal-pad has no minus key on iOS, and a home
// value can go negative (underwater on the loan).
export function HouseValueModal({ visible, initial, onCancel, onSubmit, onDelete }: HouseValueModalProps) {
  const [negative, setNegative] = useState(false);
  const [magnitude, setMagnitude] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(initial.effectiveDate);

  useEffect(() => {
    if (visible) {
      const split = splitSign(initial.value);
      setNegative(split.negative);
      setMagnitude(split.magnitude);
      setEffectiveDate(initial.effectiveDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = () => {
    if (!magnitude.trim() || !effectiveDate.trim()) return;
    onSubmit({ value: `${negative ? '-' : ''}${magnitude.trim()}`, effectiveDate: effectiveDate.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Home Value</Text>
          <View style={styles.valueRow}>
            <Pressable style={styles.signToggle} onPress={() => setNegative((v) => !v)}>
              <Text style={styles.signToggleText}>{negative ? '−' : '+'}</Text>
            </Pressable>
            <View style={styles.valueInput}>
              <TextField label="Value" value={magnitude} onChangeText={setMagnitude} keyboardType="decimal-pad" placeholder="0.00" autoFocus />
            </View>
          </View>
          <DateField label="Effective Date" value={effectiveDate} onChange={setEffectiveDate} />
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
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  valueInput: { flex: 1 },
  signToggle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signToggleText: { fontSize: 20, fontWeight: '700', color: colors.accent },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deleteText: { color: colors.negative, fontWeight: '600' },
  cancelText: { color: colors.textMuted, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
