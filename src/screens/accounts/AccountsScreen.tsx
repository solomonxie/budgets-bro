import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { useAccounts } from '../../hooks/useAccounts';
import { useAccountValues } from '../../hooks/useAccountValues';
import { useAppStore } from '../../state/useAppStore';
import { ACCOUNT_KIND_ORDER, accountKind, netWorth as computeNetWorth } from '../../domain/accountKind';
import type { AccountKind } from '../../domain/types';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { AccountsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AccountsStackParamList, 'AccountsList'>;

const KIND_LABEL_KEY: Record<AccountKind, TranslationKey> = {
  Cash: 'accounts.kindCash',
  Savings: 'accounts.kindSavings',
  Credit: 'accounts.kindCredit',
  Loan: 'accounts.kindLoan',
  Tracking: 'accounts.kindTracking',
  Asset: 'accounts.kindAsset',
};

export function AccountsScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const openAddAccount = useAppStore((s) => s.openAddAccount);
  const { accounts } = useAccounts();
  const { valuesByAccountId: houseValues } = useAccountValues();
  const [excludedAccountIds, setExcludedAccountIds] = useState<Set<number>>(new Set());
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);

  const toggleAccountIncluded = (accountId: number) => {
    setExcludedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const netWorth = useMemo(
    () =>
      computeNetWorth(
        accounts
          .filter((a) => !excludedAccountIds.has(a.account.id))
          .map((a) => ({ type: a.account.type, balanceCents: a.balanceCents, houseValueCents: houseValues.get(a.account.id) })),
      ),
    [accounts, excludedAccountIds, houseValues],
  );

  const groups = useMemo(() => {
    return ACCOUNT_KIND_ORDER.map((kind) => {
      const list = accounts.filter((a) => accountKind(a.account.type) === kind);
      return { kind, accounts: list, subtotalCents: list.reduce((s, a) => s + a.balanceCents, 0) };
    }).filter((g) => g.accounts.length > 0);
  }, [accounts]);

  return (
    <ScreenContainer scroll>
      <View style={styles.netWorthCard}>
        <View style={styles.netWorthHeader}>
          <Text style={styles.netWorthLabel}>{t('accounts.netWorth')}</Text>
          <Pressable onPress={() => setAccountPickerOpen(true)}>
            <Text style={styles.customizeLink}>{t('accounts.customize')}</Text>
          </Pressable>
        </View>
        <Text style={[styles.netWorthValue, netWorth.netWorthCents < 0 && styles.negative]}>
          {formatMoney(netWorth.netWorthCents)}
        </Text>
        <View style={styles.netWorthBreakdown}>
          <Text style={styles.netWorthPart}>{t('accounts.assets', { amount: formatMoney(netWorth.assetsCents) })}</Text>
          <Text style={styles.netWorthPart}>{t('accounts.debts', { amount: formatMoney(netWorth.debtsCents) })}</Text>
        </View>
      </View>

      <Modal visible={accountPickerOpen} transparent animationType="fade" onRequestClose={() => setAccountPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAccountPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('accounts.includeInNetWorth')}</Text>
            <ScrollView>
              {accounts.map(({ account }) => {
                const included = !excludedAccountIds.has(account.id);
                return (
                  <Pressable key={account.id} style={styles.accountRow} onPress={() => toggleAccountIncluded(account.id)}>
                    <Text style={styles.accountRowText}>{account.name}</Text>
                    <View style={[styles.checkbox, included && styles.checkboxChecked]}>
                      {included ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.doneButton} onPress={() => setAccountPickerOpen(false)}>
              <Text style={styles.doneButtonText}>{t('common.done')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {groups.map((group) => (
        <View key={group.kind} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupLabel}>{t(KIND_LABEL_KEY[group.kind])}</Text>
            <Text style={styles.groupSub}>{formatMoney(group.subtotalCents)}</Text>
          </View>
          {group.accounts.map(({ account, balanceCents }) => (
            <Pressable
              key={account.id}
              style={styles.row}
              onPress={() => navigation.navigate('AccountDetail', { accountId: account.id })}
            >
              <Text style={styles.rowTitle}>{account.name}</Text>
              <Text style={[styles.rowValue, balanceCents < 0 && styles.negative]}>{formatMoney(balanceCents)}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={openAddAccount}>
        <Text style={styles.addButtonText}>{t('accounts.addAccount')}</Text>
      </Pressable>
      <Pressable style={styles.closedLink} onPress={() => navigation.navigate('ClosedAccounts')}>
        <Text style={styles.closedLinkText}>{t('accounts.closedAccounts')}</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  netWorthCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  netWorthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netWorthLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  customizeLink: { fontSize: 12, fontWeight: '700', color: colors.accent },
  netWorthValue: { fontSize: 28, fontWeight: '700', color: colors.text },
  netWorthBreakdown: { flexDirection: 'row', gap: spacing.md },
  netWorthPart: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '75%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  accountRowText: { fontSize: 15, color: colors.text },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  doneButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  doneButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  group: { gap: spacing.xs },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  groupLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  groupSub: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  negative: { color: colors.negative },
  addButton: { alignItems: 'center', paddingVertical: spacing.sm },
  addButtonText: { color: colors.accent, fontWeight: '700' },
  closedLink: { alignItems: 'center', paddingVertical: spacing.sm, marginBottom: 80 },
  closedLinkText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
});
