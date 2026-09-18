import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { getDb } from '../../db/client';
import * as accountsRepo from '../../db/repositories/accountsRepo';
import type { AccountWithBalance } from '../../db/repositories/accountsRepo';
import { useAppStore } from '../../state/useAppStore';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function ClosedAccountsScreen() {
  const t = useT();
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const openEditAccount = useAppStore((s) => s.openEditAccount);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);

  // A closed account still counts: its categorised transactions are still
  // category activity (budgets.ts filters on on_budget, not archived_at)
  // while its balance is dropped from the cash side — so spending on a card
  // closed years ago keeps dragging Unassigned Cash down. Deleting is the
  // way out when the history isn't wanted.
  const confirmDelete = async (accountId: number, name: string) => {
    const db = await getDb();
    // Worked out before asking, because the number is the whole decision: a
    // card's own spending is what offsets the cash that later paid it off,
    // so deleting it drops Unassigned by everything ever spent on it.
    const impactCents = await accountsRepo.unassignedImpactOfDeleting(db, accountId);
    const message =
      impactCents === 0
        ? t('closedAccounts.deleteConfirmMessage')
        : t('closedAccounts.deleteImpactMessage', { amount: formatMoney(impactCents) });
    Alert.alert(t('closedAccounts.deleteConfirmTitle', { name }), message, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await accountsRepo.deleteAccountPermanently(db, accountId);
          bumpDataVersion();
          refresh();
        },
      },
    ]);
  };

  const refresh = useCallback(async () => {
    const db = await getDb();
    setAccounts(await accountsRepo.listClosedAccounts(db, boardId));
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return (
    <ScreenContainer scroll>
      {accounts.length === 0 ? (
        <Text style={styles.empty}>{t('closedAccounts.empty')}</Text>
      ) : (
        accounts.map(({ account, balanceCents }) => (
          <View key={account.id} style={styles.row}>
            <Pressable style={styles.rowMain} onPress={() => openEditAccount(account.id)}>
              <View>
                <Text style={styles.rowTitle}>{account.name}</Text>
                <Text style={styles.rowSub}>{t('closedAccounts.tapToReopen')}</Text>
              </View>
              <Text style={styles.rowValue}>{formatMoney(balanceCents)}</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => confirmDelete(account.id, account.name)}>
              <Text style={styles.deleteLink}>{t('closedAccounts.deleteForever')}</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  rowMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteLink: { color: colors.negative, fontWeight: '600', fontSize: 13, marginTop: spacing.sm },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.lg },
});
