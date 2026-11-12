import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { formatMoneyExact } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { CategoryBudgetItem } from '../../hooks/useBudget';

interface TakeFromSheetProps {
  cents: number;
  // Every other category with at least `cents` available, richest first.
  sources: CategoryBudgetItem[];
  onPick: (source: CategoryBudgetItem) => void;
  onClose: () => void;
}

export function TakeFromSheet({ cents, sources, onPick, onClose }: TakeFromSheetProps) {
  const t = useT();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <BottomSheet
        title={t('budget.takeFromTitle', { amount: formatMoneyExact(cents) })}
        onClose={onClose}
      >
        {sources.map((s) => (
          <Pressable
            key={s.category.id}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => onPick(s)}
          >
            <Text style={styles.name} numberOfLines={1}>
              {s.category.icon ? `${s.category.icon} ` : ''}
              {s.category.name}
            </Text>
            <Text style={styles.available}>{formatMoneyExact(s.balanceCents)}</Text>
          </Pressable>
        ))}
        {sources.length === 0 ? (
          <Text style={styles.empty}>
            {t('budget.takeFromNone', { amount: formatMoneyExact(cents) })}
          </Text>
        ) : null}
      </BottomSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surface },
  name: { flex: 1, fontSize: 16, color: colors.text },
  available: { fontSize: 16, fontWeight: '600', color: colors.positive },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.md,
  },
});
