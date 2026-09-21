import { StyleSheet, Text } from 'react-native';
import { transactionSubLabel } from '../../domain/transactionLabel';
import type { TransactionLabelRow } from '../../domain/transactionLabel';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';

// The line under the payee in a transaction list: category, "Income", or
// nothing. Both lists render it through here so they can't drift apart, and
// the rule itself is in domain/transactionLabel.
export function TransactionSubLabel({
  row,
  suffix,
}: {
  row: TransactionLabelRow;
  // Appended after a separator — the account register puts the row's date
  // here, since its rows aren't grouped under one.
  suffix?: string;
}) {
  const t = useT();
  const label = transactionSubLabel(row);
  const text =
    label == null
      ? null
      : label.kind === 'category'
        ? `${label.icon ? label.icon + ' ' : ''}${label.name}`
        : label.kind === 'income'
          ? t('spend.income')
          : t('common.uncategorized');
  const line = [text, suffix].filter(Boolean).join(' · ');
  if (!line) return null;
  return (
    <Text style={styles.sub} numberOfLines={1}>
      {line}
    </Text>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
