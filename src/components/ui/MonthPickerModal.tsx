import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface MonthPickerModalProps {
  visible: boolean;
  month: string; // 'YYYY-MM'
  onSelect: (month: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// YNAB-style month picker: a year header with prev/next arrows and a 3x4
// grid of months underneath, opened by tapping the Budget screen's month
// label instead of only stepping one month at a time.
export function MonthPickerModal({ visible, month, onSelect, onClose }: MonthPickerModalProps) {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const selectedMonthIndex = Number(monthStr) - 1;

  const pick = (monthIndex: number) => {
    onSelect(`${year}-${String(monthIndex + 1).padStart(2, '0')}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.yearRow}>
            <Pressable onPress={() => onSelect(`${year - 1}-${monthStr}`)} hitSlop={10}>
              <Text style={styles.yearArrow}>‹</Text>
            </Pressable>
            <Text style={styles.yearText}>{year}</Text>
            <Pressable onPress={() => onSelect(`${year + 1}-${monthStr}`)} hitSlop={10}>
              <Text style={styles.yearArrow}>›</Text>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {MONTH_NAMES.map((name, i) => (
              <Pressable
                key={name}
                style={[styles.cell, i === selectedMonthIndex && styles.cellSelected]}
                onPress={() => pick(i)}
              >
                <Text style={[styles.cellText, i === selectedMonthIndex && styles.cellTextSelected]}>{name}</Text>
              </Pressable>
            ))}
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
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  yearArrow: { fontSize: 20, color: colors.accent, fontWeight: '700', paddingHorizontal: 6 },
  yearText: { fontSize: 17, fontWeight: '700', color: colors.text, minWidth: 60, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  cell: {
    width: '31%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  cellText: { fontSize: 14, fontWeight: '600', color: colors.text },
  cellTextSelected: { color: '#fff' },
});
