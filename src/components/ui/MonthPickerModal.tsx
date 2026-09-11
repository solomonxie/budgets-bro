import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface MonthPickerModalProps {
  visible: boolean;
  month: string; // 'YYYY-MM'
  onSelect: (month: string) => void;
  onClose: () => void;
}

function parseMonth(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1);
}

// Native date-picker wheel, same as DateField — neither platform's
// library exposes a month-only mode, so the day wheel still shows; it's
// just discarded when reading the value back. Replaces the earlier
// custom year-row + month-grid picker for the same "real OS widget, so
// it just scrolls" reason DateField moved to it.
export function MonthPickerModal({ visible, month, onSelect, onClose }: MonthPickerModalProps) {
  const [draft, setDraft] = useState(() => parseMonth(month));

  useEffect(() => {
    if (visible) setDraft(parseMonth(month));
  }, [visible, month]);

  const confirm = () => {
    onSelect(`${draft.getFullYear()}-${String(draft.getMonth() + 1).padStart(2, '0')}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Month</Text>
          <DateTimePicker
            value={draft}
            mode="date"
            display="spinner"
            onValueChange={(_, d) => setDraft(d)}
            textColor={colors.text}
            style={styles.picker}
          />
          <Pressable style={styles.confirmBtn} onPress={confirm}>
            <Text style={styles.confirmBtnText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' },
  picker: { alignSelf: 'center' },
  confirmBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: spacing.xs },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
