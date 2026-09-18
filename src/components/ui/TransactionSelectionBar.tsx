import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { SearchableDropdownField } from './SearchableDropdownField';
import { RowMenuButton } from './RowMenuButton';
import { usePayees } from '../../hooks/usePayees';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// The toolbar a transaction list shows while in select mode (see
// useTransactionSelection).
//
// One row, the height of a toolbar: the actions live behind a "⋯" at the far
// left, the count sits next to it, and Select all / Done stay on the right
// where a list's own controls are. It used to be a block of two full-width
// buttons under a header row, with Delete sized like a primary action and
// sharing an edge with Done — a mis-tap away from destroying a selection you
// had just finished making.
//
// Delete is two taps now (menu, then the sheet's destructive row) and a
// confirm, at the opposite end of the bar from Done. RowMenuButton is what
// makes that safe: it waits for its own sheet to finish dismissing before
// running an action that opens an Alert.
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

  const confirmDelete = () => {
    Alert.alert(t('transactions.deleteSelectedConfirmTitle', { count: selectedCount }), t('common.cannotBeUndone'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <View style={styles.bar}>
      {selectedCount > 0 ? (
        <RowMenuButton
          items={[
            { label: t('transactions.editPayee'), onPress: () => setPayeePickerOpen(true) },
            { label: t('transactions.deleteSelected', { count: selectedCount }), destructive: true, onPress: confirmDelete },
          ]}
        />
      ) : (
        // Keeps the row from reflowing as the selection empties and fills.
        <View style={styles.menuPlaceholder} />
      )}
      <Text style={styles.count}>{t('transactions.selectedCount', { count: selectedCount })}</Text>
      <Pressable onPress={onToggleAll} hitSlop={8}>
        <Text style={styles.link}>{allSelected ? t('transactions.selectNone') : t('transactions.selectAll')}</Text>
      </Pressable>
      <Pressable onPress={onDone} hitSlop={8}>
        <Text style={[styles.link, styles.done]}>{t('common.done')}</Text>
      </Pressable>

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  menuPlaceholder: { width: 24 },
  // Takes the slack, so the links stay pinned right however long the count is.
  count: { flex: 1, fontSize: 13, color: colors.textMuted },
  link: { color: colors.accent, fontSize: 14 },
  done: { fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
});
