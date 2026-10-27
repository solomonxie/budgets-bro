import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { SearchableDropdownField } from './SearchableDropdownField';
import { RowMenuButton } from './RowMenuButton';
import { DropdownGroupLabel, DropdownOption } from './DropdownField';
import { usePayees } from '../../hooks/usePayees';
import { useCategories } from '../../hooks/useCategories';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ExpandingFieldGroup } from './ExpandingField';

// The toolbar a transaction list shows while in select mode (see
// useTransactionSelection).
//
// One row, the height of a toolbar: Select all on the left, the count in the
// middle, and the actions behind a "⋯" beside Done under the thumb. It used to be a block of two full-width
// buttons under a header row, with Delete sized like a primary action and
// sharing an edge with Done — a mis-tap away from destroying a selection you
// had just finished making.
//
// Delete is two taps now (menu, then the sheet's destructive row) and a
// confirm. RowMenuButton is what
// makes that safe: it waits for its own sheet to finish dismissing before
// running an action that opens an Alert.
export function TransactionSelectionBar({
  selectedCount,
  allSelected,
  onToggleAll,
  onSetPayee,
  onSetCategory,
  onDelete,
  onDone,
}: {
  selectedCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onSetPayee: (payeeName: string) => void;
  onSetCategory: (categoryId: number | null) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const { payees } = usePayees('usage');
  const { groups, categories } = useCategories();
  const [picker, setPicker] = useState<'payee' | 'category' | null>(null);
  const closePicker = () => setPicker(null);

  const applyPayee = (payeeName: string) => {
    closePicker();
    if (payeeName.trim()) onSetPayee(payeeName.trim());
  };

  const applyCategory = (categoryId: number | null) => {
    closePicker();
    onSetCategory(categoryId);
  };

  const confirmDelete = () => {
    Alert.alert(
      t('transactions.deleteSelectedConfirmTitle', { count: selectedCount }),
      t('common.cannotBeUndone'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: onDelete },
      ],
    );
  };

  return (
    <View style={styles.bar}>
      <Pressable onPress={onToggleAll} hitSlop={8}>
        <Text style={styles.link}>
          {allSelected
            ? t('transactions.selectNone')
            : t('transactions.selectAll')}
        </Text>
      </Pressable>
      <Text style={styles.count}>
        {t('transactions.selectedCount', { count: selectedCount })}
      </Text>
      {selectedCount > 0 ? (
        <RowMenuButton
          items={[
            {
              label: t('transactions.editCategory'),
              onPress: () => setPicker('category'),
            },
            {
              label: t('transactions.editPayee'),
              onPress: () => setPicker('payee'),
            },
            {
              label: t('transactions.deleteSelected', { count: selectedCount }),
              destructive: true,
              onPress: confirmDelete,
            },
          ]}
        />
      ) : (
        // Keeps the row from reflowing as the selection empties and fills.
        <View style={styles.menuPlaceholder} />
      )}
      <Pressable onPress={onDone} hitSlop={8}>
        <Text style={[styles.link, styles.done]}>{t('common.done')}</Text>
      </Pressable>

      <Modal
        visible={picker != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePicker}
      >
        <ScreenContainer modal>
          <View style={styles.header}>
            <Pressable onPress={closePicker}>
              <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={styles.title}>
              {picker === 'category'
                ? t('transactions.editCategoryTitle', { count: selectedCount })
                : t('transactions.editPayeeTitle', { count: selectedCount })}
            </Text>
            <Text style={[styles.headerBtn, { opacity: 0 }]}>
              {t('common.cancel')}
            </Text>
          </View>
          {picker === 'category' ? (
            <ScrollView>
              <DropdownOption
                label={t('common.uncategorized')}
                selected={false}
                onPress={() => applyCategory(null)}
              />
              {groups.map((group) => {
                const groupCategories = categories.filter(
                  (c) => c.groupId === group.id,
                );
                if (groupCategories.length === 0) return null;
                return (
                  <View key={group.id}>
                    <DropdownGroupLabel label={group.name} />
                    {groupCategories.map((c) => (
                      <DropdownOption
                        key={c.id}
                        label={`${c.icon ? c.icon + ' ' : ''}${c.name}`}
                        selected={false}
                        onPress={() => applyCategory(c.id)}
                      />
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <ExpandingFieldGroup>
              <SearchableDropdownField
                label={t('common.payee')}
                valueLabel=""
                placeholder={t('settings.payeeSelectPlaceholder')}
                searchPlaceholder={t('settings.payeeSearchPlaceholder')}
                options={payees.map((p) => ({
                  id: p.id,
                  label: p.name,
                  badge:
                    p.linkedAccountId != null
                      ? t('payeePicker.accountBadge')
                      : undefined,
                }))}
                onSelect={(o) => applyPayee(o.label)}
                onUseText={applyPayee}
              />
            </ExpandingFieldGroup>
          )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
});
