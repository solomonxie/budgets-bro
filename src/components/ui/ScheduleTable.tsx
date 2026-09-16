import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Amortization/accumulation tables: first column is the period label, the
// rest are right-aligned amounts. Extracted from AmortizationCalculator so
// every calculator's schedule reads identically.
export function ScheduleTableHeader({ columns }: { columns: string[] }) {
  return (
    <View style={styles.row}>
      {columns.map((column, i) => (
        <Text key={column} style={[styles.cell, styles.headerCell, i > 0 && styles.amountCell]}>
          {column}
        </Text>
      ))}
    </View>
  );
}

export function ScheduleRow({ cells, emphasis }: { cells: string[]; emphasis?: boolean }) {
  return (
    <View style={styles.row}>
      {cells.map((cell, i) => (
        <Text key={i} style={[styles.cell, i > 0 && styles.amountCell, emphasis && styles.emphasisCell]}>
          {cell}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cell: { flex: 1, fontSize: 12, color: colors.text },
  headerCell: { fontWeight: '700', color: colors.textMuted },
  amountCell: { textAlign: 'right' },
  emphasisCell: { fontWeight: '700' },
});
