import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { useAccounts } from '../../hooks/useAccounts';
import { useTransactions } from '../../hooks/useTransactions';
import { useFutureTransactions } from '../../hooks/useFutureTransactions';
import { useAccountScheduledTransactions } from '../../hooks/useAccountScheduledTransactions';
import { RowMenuButton } from '../../components/ui/RowMenuButton';
import { DisclosureChevron } from '../../components/ui/DisclosureChevron';
import {
  DropdownField,
  DropdownOption,
} from '../../components/ui/DropdownField';
import { TransactionSelectionBar } from '../../components/ui/TransactionSelectionBar';
import { useTransactionSelection } from '../../hooks/useTransactionSelection';
import { getDb } from '../../db/client';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import { withRunningBalances } from '../../domain/register';
import { monthlyBalanceTrend } from '../../domain/balanceTrend';
import { buildGrowthSeries } from '../../domain/investmentGrowth';
import { currentDateISO } from '../../domain/month';
import { TransactionSubLabel } from '../../components/ui/TransactionSubLabel';
import { formatMoney, formatMoneyExact } from '../../domain/money';
import { useAppStore } from '../../state/useAppStore';
import {
  isLoanLikeType,
  toppedUpByContributions,
  } from '../../domain/accountKind';
import {
  duplicateTransactionIds,
  matchesReviewFilter,
} from '../../domain/transactionReview';
import type { ReviewFilter } from '../../domain/transactionReview';
import { LoanDetailsCard } from './LoanDetailsCard';
import { InterestRateDetails } from './InterestRateDetails';
import { HouseValueDetails } from './HouseValueDetails';
import { TrackingValueDetails } from './TrackingValueDetails';
import { useAccountValueHistory } from '../../hooks/useAccountValueHistory';
import { BalanceTrendChart } from './BalanceTrendChart';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type {
  AccountsStackParamList,
  RootStackParamList,
} from '../../navigation/types';

// Nothing at all for a row that doesn't take a category — a savings
// withdrawal or a transfer isn't "Uncategorized", it's simply not the kind
// of thing a category applies to, and old rows can still carry one from
// before that rule (see domain/accountKind). Money coming in carries no
// category by design either, so "Uncategorized" is only for an outflow that
// genuinely lost one.
type Nav = NativeStackNavigationProp<AccountsStackParamList, 'AccountDetail'>;
// Add Transaction lives on the root stack, above this one.
type RootNav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<AccountsStackParamList, 'AccountDetail'>;

export function AccountDetailScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { accountId } = route.params;
  const { accounts, loading } = useAccounts();
  const accountWithBalance = accounts.find((a) => a.account.id === accountId);
  const isMortgage = accountWithBalance?.account.type === 'mortgage';
  const isTracking =
    accountWithBalance != null &&
    toppedUpByContributions(accountWithBalance.account.type);
  const isAsset = accountWithBalance?.account.type === 'asset';
  const isCreditCard = accountWithBalance?.account.type === 'credit_card';
  const isLoanLike =
    accountWithBalance != null &&
    isLoanLikeType(accountWithBalance.account.type);
  const isCashOrSavings =
    accountWithBalance?.account.type === 'savings' ||
    accountWithBalance?.account.type === 'cash';
  const { transactions } = useTransactions(accountId);
  const { futureTransactions } = useFutureTransactions(accountId);
  const {
    scheduledTransactions,
    approve: approveSchedule,
    cancel: cancelSchedule,
  } = useAccountScheduledTransactions(accountId);
  const today = currentDateISO();
  const [scheduledExpanded, setScheduledExpanded] = useState(false);
  // Open on arrival — the chart is why most people come to this page — but
  // foldable for the visit, so a long register can be read without it.
  // Deliberately not remembered: it is a temporary "get out of my way",
  // not a preference.
  const [trendExpanded, setTrendExpanded] = useState(true);
  // Same filter the history page carries — what is missing a payee or a
  // category, narrowed to this account (see domain/transactionReview).
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter | null>(null);
  const rootNavigation = useNavigation<RootNav>();
  const openEditAccount = useAppStore((s) => s.openEditAccount);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const { selectMode, selectedIds, beginWith, toggle, toggleAll, exit } =
    useTransactionSelection();

  const balanceCents = accountWithBalance?.balanceCents ?? 0;
  const hasValueHistory = isTracking || isAsset;
  // Cash/savings/credit card balances are fully derivable from the real
  // ledger (opening balance + transactions) — no manual logging needed,
  // unlike tracking/asset's value history. Credit card also gets its
  // monthly spend overlaid: a balance that's paid off every cycle reads as
  // flat/near-zero and hides how much actually got charged.
  const showsBalanceTrend = isCashOrSavings || isCreditCard;
  const balanceTrend = useMemo(
    () =>
      showsBalanceTrend ? monthlyBalanceTrend(transactions, balanceCents) : [],
    [showsBalanceTrend, transactions, balanceCents],
  );
  const {
    history: valueHistory,
    currentValueCents,
    refresh: refreshValueHistory,
  } = useAccountValueHistory(isMortgage || hasValueHistory ? accountId : null);
  // Surfaced directly in the balance box (not just inside the expandable
  // Value History section) so a tracking account's deposited/gain split is
  // visible at a glance — always, even before any transaction or logged
  // value exists, rather than hiding the row until there's something to
  // show ($0 deposited / +$0 gain is itself a meaningful, correct state).
  const latestGrowth = useMemo(
    () =>
      isTracking
        ? (buildGrowthSeries(valueHistory, transactions).at(-1) ?? {
            date: currentDateISO(),
            totalCents: 0,
            depositedCents: 0,
            gainCents: 0,
          })
        : null,
    [isTracking, valueHistory, transactions],
  );

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
  // Filtered after the running balances are computed — those walk the whole
  // register backwards from the account's balance, so they have to see every
  // row whether or not it is shown.
  const duplicates = useMemo(
    () => duplicateTransactionIds(transactions),
    [transactions],
  );
  const visibleRows = useMemo(
    () =>
      reviewFilter == null
        ? rows
        : rows.filter((row) =>
            matchesReviewFilter(row, reviewFilter, duplicates),
          ),
    [rows, reviewFilter, duplicates],
  );
  const REVIEW_FILTER_OPTIONS: { value: ReviewFilter; label: string }[] = [
    { value: 'missingPayee', label: t('transactions.needsPayee') },
    { value: 'missingCategory', label: t('transactions.needsCategory') },
    { value: 'any', label: t('transactions.needsReview') },
  ];
  const reviewFilterLabel =
    REVIEW_FILTER_OPTIONS.find((o) => o.value === reviewFilter)?.label ?? '';

  const deleteSelected = async () => {
    const db = await getDb();
    await transactionsRepo.deleteTransactions(db, boardId, selectedIds);
    exit();
    bumpDataVersion();
  };

  const setPayeeForSelected = async (payeeName: string) => {
    const db = await getDb();
    await transactionsRepo.setPayeeForTransactions(
      db,
      boardId,
      selectedIds,
      payeeName,
    );
    exit();
    bumpDataVersion();
  };

  return (
    <ScreenContainer>
      {/* The balance box and the scheduled card are the list's header, not
          siblings above it: expanded (home value, loan details, a trend
          chart) they grow taller than the screen, and as siblings above a
          flex:1 list there was no way to scroll down to their bottom. */}
      <FlatList
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.summaryLabel}>
                    {t(
                      isLoanLike
                        ? 'accountDetail.remainingPrincipal'
                        : 'accountDetail.balance',
                    )}
                  </Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      balanceCents < 0 && styles.negative,
                    ]}
                  >
                    {formatMoney(balanceCents)}
                  </Text>
                  {latestGrowth ? (
                    <View style={styles.depositGainRow}>
                      <Text style={styles.depositedText}>
                        {t('investmentGrowth.depositedLabel')}{' '}
                        {formatMoney(latestGrowth.depositedCents)}
                      </Text>
                      <Text
                        style={[
                          styles.gainText,
                          latestGrowth.gainCents < 0 && styles.negative,
                        ]}
                      >
                        {latestGrowth.gainCents >= 0 ? '+' : ''}
                        {formatMoney(latestGrowth.gainCents)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {isMortgage ? (
                  <View style={styles.summaryRight}>
                    <Text style={styles.summaryLabel}>
                      {t('houseValueCard.label')}
                    </Text>
                    <Text style={styles.houseValueText}>
                      {currentValueCents == null
                        ? t('houseValueCard.notSet')
                        : formatMoney(currentValueCents)}
                    </Text>
                  </View>
                ) : null}
              </View>
              {isMortgage && accountWithBalance ? (
                <Pressable
                  style={styles.trackingValueHeader}
                  onPress={() => setTrendExpanded((v) => !v)}
                >
                  <Text style={styles.trackingValueHeaderText}>
                    {t('houseValueCard.label')}
                  </Text>
                  <DisclosureChevron expanded={trendExpanded} />
                </Pressable>
              ) : null}
              {isMortgage && accountWithBalance && trendExpanded ? (
                <HouseValueDetails
                  account={accountWithBalance.account}
                  balanceCents={balanceCents}
                  history={valueHistory}
                  transactions={transactions}
                  currentValueCents={currentValueCents}
                  refresh={refreshValueHistory}
                />
              ) : null}
              {hasValueHistory && accountWithBalance ? (
                <Pressable
                  style={styles.trackingValueHeader}
                  onPress={() => setTrendExpanded((v) => !v)}
                >
                  <Text style={styles.trackingValueHeaderText}>
                    {t('trackingValueCard.label')}
                  </Text>
                  <DisclosureChevron expanded={trendExpanded} />
                </Pressable>
              ) : null}
              {hasValueHistory && accountWithBalance && trendExpanded ? (
                <TrackingValueDetails
                  account={accountWithBalance.account}
                  history={valueHistory}
                  currentValueCents={currentValueCents}
                  transactions={transactions}
                  mode={isAsset ? 'single' : 'stacked'}
                  refresh={refreshValueHistory}
                />
              ) : null}
              {showsBalanceTrend && accountWithBalance ? (
                <Pressable
                  style={styles.trackingValueHeader}
                  onPress={() => setTrendExpanded((v) => !v)}
                >
                  <Text style={styles.trackingValueHeaderText}>
                    {t('trackingValueCard.label')}
                  </Text>
                  <DisclosureChevron expanded={trendExpanded} />
                </Pressable>
              ) : null}
              {showsBalanceTrend && trendExpanded ? (
                <View style={styles.balanceTrendCard}>
                  <BalanceTrendChart
                    points={balanceTrend}
                    showSpending={isCreditCard}
                  />
                </View>
              ) : null}
              {isCashOrSavings ? (
                <InterestRateDetails accountId={accountId} />
              ) : null}
              {accountWithBalance && isLoanLike ? (
                <LoanDetailsCard
                  account={accountWithBalance.account}
                  transactions={transactions}
                />
              ) : null}
            </View>
            {futureTransactions.length > 0 ||
            scheduledTransactions.length > 0 ? (
              <View style={styles.scheduledCard}>
                <Pressable
                  style={styles.scheduledHeader}
                  onPress={() => setScheduledExpanded((v) => !v)}
                >
                  <Text style={styles.scheduledTitle}>
                    {t('accountDetail.scheduledHeading', {
                      count:
                        futureTransactions.length +
                        scheduledTransactions.length,
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
                    {scheduledTransactions.map((s) => (
                      <View
                        key={`recurring-${s.id}`}
                        style={styles.scheduledRow}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.payee}>
                            {s.payeeName ?? t('common.noPayee')}
                          </Text>
                          {/* A schedule belongs to the account being viewed
                              and hasn't posted, so it is never a transfer leg
                              of its own. */}
                          <TransactionSubLabel
                            row={{
                              ...s,
                              accountType:
                                accountWithBalance?.account.type ?? 'cash',
                              transferAccountId: null,
                            }}
                            suffix={t('accountDetail.nextDateLabel', {
                              date: s.nextDate,
                            })}
                          />
                        </View>
                        <Text
                          style={[
                            styles.amount,
                            s.amountCents < 0
                              ? styles.negative
                              : styles.positive,
                          ]}
                        >
                          {formatMoneyExact(s.amountCents)}
                        </Text>
                        {s.nextDate <= today ? (
                          <Pressable
                            style={styles.approveBtn}
                            onPress={() => approveSchedule(s.id)}
                          >
                            <Text style={styles.approveBtnText}>
                              {t('pendingScheduled.approve')}
                            </Text>
                          </Pressable>
                        ) : null}
                        <RowMenuButton
                          items={[
                            {
                              label: t('accountDetail.cancelSchedule'),
                              destructive: true,
                              onPress: () => cancelSchedule(s.id),
                            },
                          ]}
                        />
                      </View>
                    ))}
                    {futureTransactions.map((item) => (
                      <Pressable
                        key={item.id}
                        style={styles.scheduledRow}
                        onPress={() =>
                          rootNavigation.navigate('AddTransaction', {
                            transactionId: item.id,
                          })
                        }
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.payee}>
                            {item.payeeName ?? t('common.noPayee')}
                          </Text>
                          <TransactionSubLabel row={item} suffix={item.date} />
                        </View>
                        <Text
                          style={[
                            styles.amount,
                            item.amountCents < 0
                              ? styles.negative
                              : styles.positive,
                          ]}
                        >
                          {formatMoneyExact(item.amountCents)}
                        </Text>
                      </Pressable>
                    ))}
                  </>
                ) : null}
              </View>
            ) : null}
            {rows.length > 0 ? (
              // A section header for the register below, with the filter as
              // its trailing control — the filter used to hang on its own
              // between the scheduled card and the first row, touching both
              // and belonging to neither.
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {t('accountDetail.transactionsHeading', {
                    count: visibleRows.length,
                  })}
                </Text>
                <DropdownField
                  compact
                  link
                  label={t('review.title')}
                  valueLabel={reviewFilterLabel}
                  placeholder={t('transactions.allRows')}
                >
                  {(close) => (
                    <>
                      <DropdownOption
                        label={t('transactions.allRows')}
                        selected={reviewFilter == null}
                        onPress={() => {
                          setReviewFilter(null);
                          close();
                        }}
                      />
                      {REVIEW_FILTER_OPTIONS.map((o) => (
                        <DropdownOption
                          key={o.value}
                          label={o.label}
                          selected={reviewFilter === o.value}
                          onPress={() => {
                            setReviewFilter(o.value);
                            close();
                          }}
                        />
                      ))}
                    </>
                  )}
                </DropdownField>
              </View>
            ) : null}
          </>
        }
        data={visibleRows}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            style={styles.txnRow}
            onPress={() =>
              selectMode
                ? toggle(item.id)
                : rootNavigation.navigate('AddTransaction', {
                    transactionId: item.id,
                  })
            }
            onLongPress={() => beginWith(item.id)}
          >
            {selectMode ? (
              <View
                style={[
                  styles.checkbox,
                  selectedIds.includes(item.id) && styles.checkboxChecked,
                ]}
              />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.payee}>
                {item.payeeName ?? t('common.noPayee')}
              </Text>
              <TransactionSubLabel row={item} suffix={item.date} />
              {item.memo ? (
                <Text style={styles.memo} numberOfLines={1}>
                  {item.memo}
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={[
                  styles.amount,
                  item.amountCents < 0 ? styles.negative : styles.positive,
                ]}
              >
                {formatMoneyExact(item.amountCents)}
              </Text>
              {/* A loan's balance is its remaining principal, derived — not a
                  running sum of these rows (see accountsRepo), so a
                  per-row running balance there would be a different number
                  walking backwards from an unrelated total. */}
              {isLoanLike ? null : (
                <Text style={styles.running}>
                  {formatMoneyExact(item.runningBalanceCents)}
                </Text>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {t('accountDetail.noTransactionsYet')}
          </Text>
        }
      />
      {selectMode ? (
        <TransactionSelectionBar
          selectedCount={selectedIds.length}
          allSelected={
            selectedIds.length >= visibleRows.length && visibleRows.length > 0
          }
          onToggleAll={() => toggleAll(visibleRows.map((r) => r.id))}
          onSetPayee={setPayeeForSelected}
          onDelete={deleteSelected}
          onDone={exit}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  listHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryLeft: { gap: spacing.xs },
  summaryRight: { alignItems: 'flex-end', gap: spacing.xs },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  summaryValue: { fontSize: 30, fontWeight: '700', color: colors.text },
  depositGainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  depositedText: { fontSize: 12, color: colors.textMuted },
  gainText: { fontSize: 12, fontWeight: '700', color: colors.positive },
  hint: { fontSize: 12, color: colors.textMuted },
  houseValueText: { fontSize: 15, fontWeight: '700', color: colors.text },
  trackingValueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  trackingValueHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  balanceTrendCard: { marginTop: spacing.sm },
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
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    opacity: 0.7,
  },
  approveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  txnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  payee: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  memo: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
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
