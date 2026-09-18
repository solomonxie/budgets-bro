import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { SearchableDropdownField } from './SearchableDropdownField';
import { usePayees } from '../../hooks/usePayees';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// The bar a transaction list shows while in select mode (see
// useTransactionSelection): how many are picked, select-all/none, and the
// actions. Shared by the account page and the all-transactions page so both
// offer the same set — a batch relabel used to be possible on neither.
export function TransactionSelectionBar({
  selectedCount,
  allSelected,
  onToggleAll,
  onSetPayee,
  onDelete,
  onDone,
}: {
  selectedCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onSetPayee: (payeeName: string) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const { payees } = usePayees('usage');
  const [payeePickerOpen, setPayeePickerOpen] = useState(false);

  const applyPayee = (payeeName: string) => {
    setPayeePickerOpen(false);
    if (payeeName.trim()) onSetPayee(payeeName.trim());
  };

  return (
    <View style={styles.bar}>
      <View style={styles.topRow}>
        <Text style={styles.count}>{t('transactions.selectedCount', { count: selectedCount })}</Text>
        <Pressable onPress={onToggleAll}>
          <Text style={styles.link}>{allSelected ? t('transactions.selectNone') : t('transactions.selectAll')}</Text>
        </Pressable>
        <Pressable onPress={onDone}>
          <Text style={styles.link}>{t('common.done')}</Text>
        </Pressable>
      </View>
      {selectedCount > 0 ? (
        <View style={styles.actionRow}>
          <Pressable style={styles.action} onPress={() => setPayeePickerOpen(true)}>
            <Text style={styles.actionText}>{t('transactions.editPayee')}</Text>
          </Pressable>
          <Pressable style={[styles.action, styles.destructive]} onPress={onDelete}>
            <Text style={[styles.actionText, styles.destructiveText]}>{t('transactions.deleteSelected', { count: selectedCount })}</Text>
          </Pressable>
        </View>
      ) : null}
      <Modal visible={payeePickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPayeePickerOpen(false)}>
        <ScreenContainer modal>
          <View style={styles.header}>
            <Pressable onPress={() => setPayeePickerOpen(false)}>
              <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={styles.title}>{t('transactions.editPayeeTitle', { count: selectedCount })}</Text>
            <Text style={[styles.headerBtn, { opacity: 0 }]}>{t('common.cancel')}</Text>
          </View>
          <SearchableDropdownField
            label={t('common.payee')}
            valueLabel=""
            placeholder={t('settings.payeeSelectPlaceholder')}
            searchPlaceholder={t('settings.payeeSearchPlaceholder')}
            options={payees.map((p) => ({
              id: p.id,
              label: p.name,
              badge: p.linkedAccountId != null ? t('payeePicker.accountBadge') : undefined,
            }))}
            onSelect={(o) => applyPayee(o.label)}
            onUseText={applyPayee}
          />
        </ScreenContainer>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  count: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  link: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  action: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
  },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.text },
  destructive: { borderColor: colors.negative },
  destructiveText: { color: colors.negative },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
});
