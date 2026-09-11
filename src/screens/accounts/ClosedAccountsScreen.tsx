import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { getDb } from '../../db/client';
import * as accountsRepo from '../../db/repositories/accountsRepo';
import type { AccountWithBalance } from '../../db/repositories/accountsRepo';
import { useAppStore } from '../../state/useAppStore';
import { formatMoney } from '../../domain/money';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export function ClosedAccountsScreen() {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const openEditAccount = useAppStore((s) => s.openEditAccount);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

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
        <Text style={styles.empty}>No closed accounts.</Text>
      ) : (
        accounts.map(({ account, balanceCents }) => (
          <Pressable key={account.id} style={styles.row} onPress={() => openEditAccount(account.id)}>
            <View>
              <Text style={styles.rowTitle}>{account.name}</Text>
              <Text style={styles.rowSub}>Tap to reopen</Text>
            </View>
            <Text style={styles.rowValue}>{formatMoney(balanceCents)}</Text>
          </Pressable>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.lg },
});
