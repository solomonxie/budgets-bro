import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { getDb } from '../../db/client';
import * as accountsRepo from '../../db/repositories/accountsRepo';
import * as budgetsRepo from '../../db/repositories/budgetsRepo';
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
  // Two ways out, and which one is offered depends on whether the account
  // has categorised history worth keeping. Absorbing moves that history onto
  // the account that paid this one off and collapses the transfers between
  // them (see domain/absorbAccount). That usually leaves Unassigned Cash
  // exactly where it was — but not when the account still owed something, so
  // the confirm names the number the plan actually works out rather than
  // promising zero. Deleting outright is only harmless when there is no
  // categorised history to lose.
  const confirmDelete = async (accountId: number, name: string) => {
    const db = await getDb();
    const impactCents = await accountsRepo.unassignedImpactOfDeleting(
      db,
      accountId,
    );
    if (impactCents === 0) {
      Alert.alert(
        t('closedAccounts.deleteConfirmTitle', { name }),
        t('closedAccounts.deleteConfirmMessage'),
        [
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
        ],
      );
      return;
    }

    const intoId = await accountsRepo.likelyAbsorbingAccountId(db, accountId);
    const into =
      intoId != null ? await accountsRepo.getAccount(db, intoId) : null;
    const unassignedCents = await budgetsRepo.unassignedCashNow(db, boardId);
    const absorbDeltaCents = into
      ? ((await accountsRepo.previewAbsorb(db, accountId, into.id))
          ?.unassignedDeltaCents ?? 0)
      : 0;
    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: t('common.cancel'), style: 'cancel' },
    ];
    if (into) {
      buttons.push({
        text: t('closedAccounts.absorbAction', { name: into.name }),
        onPress: async () => {
          await accountsRepo.absorbAccountInto(db, accountId, into.id);
          bumpDataVersion();
          refresh();
        },
      });
    }
    buttons.push({
      text: t('closedAccounts.deleteAnyway'),
      style: 'destructive',
      onPress: async () => {
        await accountsRepo.deleteAccountPermanently(db, accountId);
        bumpDataVersion();
        refresh();
      },
    });
    const afterDelete = formatMoney(unassignedCents + impactCents);
    Alert.alert(
      t('closedAccounts.deleteConfirmTitle', { name }),
      into
        ? t(
            absorbDeltaCents === 0
              ? 'closedAccounts.absorbMessage'
              : 'closedAccounts.absorbShiftMessage',
            {
              amount: formatMoney(impactCents),
              into: into.name,
              unassigned: formatMoney(unassignedCents),
              absorbed: formatMoney(unassignedCents + absorbDeltaCents),
              deleted: afterDelete,
            },
          )
        : t('closedAccounts.deleteImpactMessage', {
            amount: formatMoney(impactCents),
            deleted: afterDelete,
          }),
      buttons,
    );
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
            <Pressable
              style={styles.rowMain}
              onPress={() => openEditAccount(account.id)}
            >
              <View>
                <Text style={styles.rowTitle}>{account.name}</Text>
                <Text style={styles.rowSub}>
                  {t('closedAccounts.tapToReopen')}
                </Text>
              </View>
              <Text style={styles.rowValue}>{formatMoney(balanceCents)}</Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => confirmDelete(account.id, account.name)}
            >
              <Text style={styles.deleteLink}>
                {t('closedAccounts.deleteForever')}
              </Text>
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
  rowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteLink: {
    color: colors.negative,
    fontWeight: '600',
    fontSize: 13,
    marginTop: spacing.sm,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
});
