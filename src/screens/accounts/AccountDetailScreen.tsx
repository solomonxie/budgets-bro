import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { useAccounts } from '../../hooks/useAccounts';
import { useTransactions } from '../../hooks/useTransactions';
import { withRunningBalances, computeBalanceCorrectionCents } from '../../domain/register';
import { formatMoney } from '../../domain/money';
import { getDb } from '../../db/client';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import { useAppStore } from '../../state/useAppStore';
import { isLoanLikeType } from '../../domain/accountKind';
import { LoanDetailsCard } from './LoanDetailsCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { AccountsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AccountsStackParamList, 'AccountDetail'>;
type Route = RouteProp<AccountsStackParamList, 'AccountDetail'>;

export function AccountDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { accountId } = route.params;
  const { accounts, loading } = useAccounts();
  const { transactions } = useTransactions(accountId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const openEditTransaction = useAppStore((s) => s.openEditTransaction);
  const openEditAccount = useAppStore((s) => s.openEditAccount);
  const boardId = useAppStore((s) => s.currentBoardId);

  const accountWithBalance = accounts.find((a) => a.account.id === accountId);
  const balanceCents = accountWithBalance?.balanceCents ?? 0;

  // Closing the account (from Edit) removes it from `accounts` — bounce
  // back to the list instead of showing a blank detail page.
  useEffect(() => {
    if (!loading && !accountWithBalance) navigation.goBack();
  }, [loading, accountWithBalance, navigation]);

  useEffect(() => {
    if (!accountWithBalance) return;
    navigation.setOptions({
      title: accountWithBalance.account.name,
      headerRight: () => (
        <Pressable onPress={() => openEditAccount(accountId)}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Edit</Text>
        </Pressable>
      ),
    });
  }, [navigation, accountWithBalance, accountId, openEditAccount]);

  const [correcting, setCorrecting] = useState(false);
  const [actualBalance, setActualBalance] = useState('');

  const rows = useMemo(() => withRunningBalances(transactions, balanceCents), [transactions, balanceCents]);

  const saveCorrection = async () => {
    const parsed = parseFloat(actualBalance);
    if (Number.isNaN(parsed)) {
      setCorrecting(false);
      return;
    }
    const deltaCents = computeBalanceCorrectionCents(balanceCents, Math.round(parsed * 100));
    const db = await getDb();
    await transactionsRepo.correctBalance(db, boardId, accountId, deltaCents);
    bumpDataVersion();
    setCorrecting(false);
    setActualBalance('');
  };

  return (
    <ScreenContainer>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Balance</Text>
        <Text style={[styles.summaryValue, balanceCents < 0 && styles.negative]}>{formatMoney(balanceCents)}</Text>
        {correcting ? (
          <View style={styles.correctForm}>
            <TextField
              placeholder="Actual balance"
              keyboardType="decimal-pad"
              value={actualBalance}
              onChangeText={setActualBalance}
            />
            <View style={styles.correctActions}>
              <Pressable onPress={() => setCorrecting(false)}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={saveCorrection}>
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.summaryLinks}>
            <Pressable onPress={() => setCorrecting(true)}>
              <Text style={styles.correctLink}>Correct Balance</Text>
            </Pressable>
          </View>
        )}
      </View>
      {accountWithBalance && isLoanLikeType(accountWithBalance.account.type) ? (
        <LoanDetailsCard account={accountWithBalance.account} balanceCents={balanceCents} />
      ) : null}
      <FlatList
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable style={styles.txnRow} onPress={() => openEditTransaction(item.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.payee}>{item.payeeName ?? '(No payee)'}</Text>
              <Text style={styles.sub}>
                {item.categoryIcon ? `${item.categoryIcon} ` : ''}
                {item.categoryName ?? 'Uncategorized'} · {item.date}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.amount, item.amountCents < 0 ? styles.negative : styles.positive]}>
                {formatMoney(item.amountCents)}
              </Text>
              <Text style={styles.running}>{formatMoney(item.runningBalanceCents)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
      />
      <FloatingAddButton accountId={accountId} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  summaryValue: { fontSize: 30, fontWeight: '700', color: colors.text },
  summaryLinks: { flexDirection: 'row', alignItems: 'center' },
  correctLink: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  correctForm: { gap: spacing.sm, marginTop: spacing.xs },
  correctActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md },
  cancelLink: { color: colors.textMuted, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  txnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  payee: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
  running: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  negative: { color: colors.negative },
  positive: { color: colors.positive },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.lg },
});
