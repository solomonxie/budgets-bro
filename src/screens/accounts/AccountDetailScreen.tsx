import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { useAccounts } from '../../hooks/useAccounts';
import { useTransactions } from '../../hooks/useTransactions';
import { useFutureTransactions } from '../../hooks/useFutureTransactions';
import { withRunningBalances } from '../../domain/register';
import { formatMoney } from '../../domain/money';
import { useAppStore } from '../../state/useAppStore';
import { isLoanLikeType } from '../../domain/accountKind';
import { LoanDetailsCard } from './LoanDetailsCard';
import { HouseValueCard } from './HouseValueCard';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { AccountsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AccountsStackParamList, 'AccountDetail'>;
type Route = RouteProp<AccountsStackParamList, 'AccountDetail'>;

export function AccountDetailScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { accountId } = route.params;
  const { accounts, loading } = useAccounts();
  const { transactions } = useTransactions(accountId);
  const { futureTransactions } = useFutureTransactions(accountId);
  const [scheduledExpanded, setScheduledExpanded] = useState(false);
  const openEditTransaction = useAppStore((s) => s.openEditTransaction);
  const openEditAccount = useAppStore((s) => s.openEditAccount);

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
          <Text style={{ color: colors.accent, fontWeight: '600' }}>
            {t('common.edit')}
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, accountWithBalance, accountId, openEditAccount, t]);

  const rows = useMemo(
    () => withRunningBalances(transactions, balanceCents),
    [transactions, balanceCents],
  );

  return (
    <ScreenContainer>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>{t('accountDetail.balance')}</Text>
        <Text
          style={[styles.summaryValue, balanceCents < 0 && styles.negative]}
        >
          {formatMoney(balanceCents)}
        </Text>
      </View>
      {accountWithBalance && isLoanLikeType(accountWithBalance.account.type) ? (
        <LoanDetailsCard
          account={accountWithBalance.account}
          balanceCents={balanceCents}
        />
      ) : null}
      {accountWithBalance && accountWithBalance.account.type === 'mortgage' ? (
        <HouseValueCard
          account={accountWithBalance.account}
          balanceCents={balanceCents}
        />
      ) : null}
      {futureTransactions.length > 0 ? (
        <View style={styles.scheduledCard}>
          <Pressable
            style={styles.scheduledHeader}
            onPress={() => setScheduledExpanded((v) => !v)}
          >
            <Text style={styles.scheduledTitle}>
              {t('accountDetail.scheduledHeading', {
                count: futureTransactions.length,
              })}
            </Text>
            <Text style={styles.scheduledChevron}>
              {scheduledExpanded ? '▾' : '▸'}
            </Text>
          </Pressable>
          {scheduledExpanded ? (
            <>
              <Text style={styles.scheduledHint}>
                {t('accountDetail.scheduledHint')}
              </Text>
              {futureTransactions.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.scheduledRow}
                  onPress={() => openEditTransaction(item.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payee}>
                      {item.payeeName ?? t('common.noPayee')}
                    </Text>
                    <Text style={styles.sub}>
                      {item.categoryIcon ? `${item.categoryIcon} ` : ''}
                      {item.categoryName ?? t('common.uncategorized')} ·{' '}
                      {item.date}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.amount,
                      item.amountCents < 0 ? styles.negative : styles.positive,
                    ]}
                  >
                    {formatMoney(item.amountCents)}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : null}
        </View>
      ) : null}
      <FlatList
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            style={styles.txnRow}
            onPress={() => openEditTransaction(item.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.payee}>
                {item.payeeName ?? t('common.noPayee')}
              </Text>
              <Text style={styles.sub}>
                {item.categoryIcon ? `${item.categoryIcon} ` : ''}
                {item.categoryName ?? t('common.uncategorized')} · {item.date}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={[
                  styles.amount,
                  item.amountCents < 0 ? styles.negative : styles.positive,
                ]}
              >
                {formatMoney(item.amountCents)}
              </Text>
              <Text style={styles.running}>
                {formatMoney(item.runningBalanceCents)}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {t('accountDetail.noTransactionsYet')}
          </Text>
        }
      />
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
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  summaryValue: { fontSize: 30, fontWeight: '700', color: colors.text },
  scheduledCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
  },
  scheduledHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduledTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  scheduledChevron: { color: colors.textMuted, fontSize: 13 },
  scheduledHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  // Muted vs. txnRow — these haven't happened yet, so the row reads as
  // provisional rather than real ledger activity.
  scheduledRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    opacity: 0.7,
  },
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
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
});
