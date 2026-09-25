import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FlaggedBanner } from '../../components/ui/FlaggedBanner';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import {
  DropdownField,
  DropdownGroupLabel,
  DropdownOption,
} from '../../components/ui/DropdownField';
import { TransactionSelectionBar } from '../../components/ui/TransactionSelectionBar';
import {
  duplicateTransactionIds,
  matchesReviewFilter,
} from '../../domain/transactionReview';
import type { ReviewFilter } from '../../domain/transactionReview';
import { useTransactions } from '../../hooks/useTransactions';
import { useTransactionSelection } from '../../hooks/useTransactionSelection';
import { useCategories } from '../../hooks/useCategories';
import { getDb } from '../../db/client';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import { useAppStore } from '../../state/useAppStore';
import { TransactionSubLabel } from '../../components/ui/TransactionSubLabel';
import { formatMoneyExact } from '../../domain/money';
import {
  lastNMonths,
  monthsBetween,
  formatMonthLabel,
  currentMonth,
} from '../../domain/month';
import { isSpendingAccountType } from '../../domain/accountKind';
import { MonthlyBarChart } from '../../components/ui/MonthlyBarChart';
import type { MonthAmount } from '../../components/ui/MonthlyBarChart';
import { useI18n, localeTag } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { TransactionWithLabels } from '../../domain/types';
import type {
  RootStackParamList,
  TransactionsFilterParams,
} from '../../navigation/types';

type Route = RouteProp<
  { Transactions: TransactionsFilterParams },
  'Transactions'
>;
// Add Transaction lives on the root stack, above whichever tab stack this
// screen was pushed from.
type RootNav = NativeStackNavigationProp<RootStackParamList>;

interface DateGroup {
  date: string;
  items: TransactionWithLabels[];
}

const MONTH_FILTER_OPTIONS = lastNMonths(currentMonth(), 12).reverse();

// Money that left a spending account for something other than another of
// your own accounts, per month from the first such month to this one.
function monthlySpending(rows: TransactionWithLabels[]): MonthAmount[] {
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    if (
      row.amountCents >= 0 ||
      row.transferAccountId != null ||
      !isSpendingAccountType(row.accountType)
    )
      continue;
    const month = row.date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) - row.amountCents);
  }
  if (byMonth.size === 0) return [];
  const first = [...byMonth.keys()].reduce((a, b) => (a < b ? a : b));
  return monthsBetween(first, currentMonth()).map((month) => ({
    month,
    spentCents: byMonth.get(month) ?? 0,
  }));
}

export function TransactionsScreen() {
  const { t, language } = useI18n();
  const route = useRoute<Route>();
  const { transactions, refresh } = useTransactions();
  const { groups, categories } = useCategories();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const navigation = useNavigation<RootNav>();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  // Set only by Insights' "All Others" row — every category outside its
  // top-N breakdown, matched instead of (and clearing) the single-select
  // `categoryFilter` above.
  const [otherCategoryIds, setOtherCategoryIds] = useState<number[] | null>(
    null,
  );
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  // Null is "everything"; the rest narrow to rows that are missing
  // something (see domain/transactionReview) — the Review page is where
  // they get fixed, this is just to see them in context here.
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter | null>(null);
  const {
    selectMode,
    selectedIds,
    beginWith,
    toggle,
    toggleAll,
    exit,
    setSelectMode,
  } = useTransactionSelection();

  // Arriving from the Budget screen's "Details" button or Insights presets filters.
  useEffect(() => {
    if (route.params?.categoryId != null)
      setCategoryFilter(route.params.categoryId);
    if (route.params?.categoryIds != null)
      setOtherCategoryIds(route.params.categoryIds);
    if (route.params?.month != null) setMonthFilter(route.params.month);
  }, [route.params]);

  const duplicates = useMemo(
    () => duplicateTransactionIds(transactions),
    [transactions],
  );

  // Every filter but the month: the chart above the list needs the months on
  // either side of the one picked.
  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (otherCategoryIds != null) {
        if (t.categoryId == null || !otherCategoryIds.includes(t.categoryId))
          return false;
      } else if (categoryFilter != null && t.categoryId !== categoryFilter) {
        return false;
      }
      if (
        reviewFilter != null &&
        !matchesReviewFilter(t, reviewFilter, duplicates)
      )
        return false;
      if (
        q &&
        !(t.payeeName ?? '').toLowerCase().includes(q) &&
        !(t.memo ?? '').toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [
    transactions,
    query,
    categoryFilter,
    otherCategoryIds,
    reviewFilter,
    duplicates,
  ]);

  const filtered = useMemo(
    () =>
      monthFilter == null
        ? matching
        : matching.filter((t) => t.date.startsWith(monthFilter)),
    [matching, monthFilter],
  );

  const spendingByMonth = useMemo(() => monthlySpending(matching), [matching]);

  const grouped = useMemo<DateGroup[]>(() => {
    const byDate: DateGroup[] = [];
    for (const t of filtered) {
      const last = byDate[byDate.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else byDate.push({ date: t.date, items: [t] });
    }
    return byDate;
  }, [filtered]);

  // Select-all covers what the filters currently show, not the whole ledger —
  // the visible list is what the user is reasoning about.
  const visibleIds = useMemo(() => filtered.map((txn) => txn.id), [filtered]);

  const deleteSelected = async () => {
    const db = await getDb();
    await transactionsRepo.deleteTransactions(db, boardId, selectedIds);
    exit();
    bumpDataVersion();
    refresh();
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
    refresh();
  };

  const categoryFilterLabel =
    otherCategoryIds != null
      ? t('transactions.allOthers')
      : categoryFilter == null
        ? ''
        : (() => {
            const c = categories.find((cat) => cat.id === categoryFilter);
            return c ? `${c.icon ? c.icon + ' ' : ''}${c.name}` : '';
          })();
  const monthFilterLabel =
    monthFilter == null
      ? ''
      : formatMonthLabel(monthFilter, localeTag(language));
  const REVIEW_FILTER_OPTIONS: { value: ReviewFilter; label: string }[] = [
    { value: 'missingPayee', label: t('transactions.needsPayee') },
    { value: 'missingCategory', label: t('transactions.needsCategory') },
    { value: 'any', label: t('transactions.needsReview') },
  ];
  const reviewFilterLabel =
    REVIEW_FILTER_OPTIONS.find((o) => o.value === reviewFilter)?.label ?? '';

  return (
    <ScreenContainer>
      <FlaggedBanner />
      {spendingByMonth.length > 0 ? (
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>
            {t('transactions.spendingByMonth')}
          </Text>
          <MonthlyBarChart
            series={spendingByMonth}
            selectedMonth={monthFilter}
          />
        </View>
      ) : null}
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          placeholder={t('transactions.searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={colors.textMuted}
          keyboardAppearance="dark"
        />
        <Pressable onPress={() => (selectMode ? exit() : setSelectMode(true))}>
          <Text style={styles.selectLink}>
            {selectMode ? t('common.done') : t('transactions.select')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.filterRow}>
        <View style={styles.filterField}>
          <DropdownField
            compact
            link
            label={t('common.category')}
            valueLabel={categoryFilterLabel}
            placeholder={t('transactions.allCategories')}
          >
            {(close) => (
              <>
                <DropdownOption
                  label={t('transactions.allCategories')}
                  selected={categoryFilter == null && otherCategoryIds == null}
                  onPress={() => {
                    setCategoryFilter(null);
                    setOtherCategoryIds(null);
                    close();
                  }}
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
                          selected={
                            otherCategoryIds == null && categoryFilter === c.id
                          }
                          onPress={() => {
                            setCategoryFilter(c.id);
                            setOtherCategoryIds(null);
                            close();
                          }}
                        />
                      ))}
                    </View>
                  );
                })}
              </>
            )}
          </DropdownField>
        </View>
        <View style={styles.filterField}>
          <DropdownField
            compact
            link
            label={t('common.month')}
            valueLabel={monthFilterLabel}
            placeholder={t('transactions.allMonths')}
          >
            {(close) => (
              <>
                <DropdownOption
                  label={t('transactions.allMonths')}
                  selected={monthFilter == null}
                  onPress={() => {
                    setMonthFilter(null);
                    close();
                  }}
                />
                {MONTH_FILTER_OPTIONS.map((m) => (
                  <DropdownOption
                    key={m}
                    label={formatMonthLabel(m, localeTag(language))}
                    selected={monthFilter === m}
                    onPress={() => {
                      setMonthFilter(m);
                      close();
                    }}
                  />
                ))}
              </>
            )}
          </DropdownField>
        </View>
        <View style={styles.filterField}>
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
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={grouped}
        keyExtractor={(g) => g.date}
        renderItem={({ item: group }) => (
          <View style={styles.dateGroup}>
            <Text style={styles.dateHeader}>{group.date}</Text>
            {group.items.map((txn) => (
              <Pressable
                key={txn.id}
                style={styles.row}
                onPress={() =>
                  selectMode
                    ? toggle(txn.id)
                    : navigation.navigate('AddTransaction', {
                        transactionId: txn.id,
                      })
                }
                onLongPress={() => beginWith(txn.id)}
              >
                {selectMode ? (
                  <View
                    style={[
                      styles.checkbox,
                      selectedIds.includes(txn.id) && styles.checkboxChecked,
                    ]}
                  />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.payee}>
                    {txn.payeeName ?? t('common.noPayee')}
                  </Text>
                  {/* What the row is, when the payee doesn't say: its
                      category, or "Income" for money arriving, or nothing at
                      all for a transfer leg (see domain/transactionLabel). */}
                  <TransactionSubLabel row={txn} />
                  {txn.memo ? (
                    <Text style={styles.memo} numberOfLines={1}>
                      {txn.memo}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.amount,
                    txn.amountCents < 0 ? styles.negative : styles.positive,
                  ]}
                >
                  {formatMoneyExact(txn.amountCents)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('transactions.noMatch')}</Text>
        }
      />
      {selectMode ? (
        <TransactionSelectionBar
          selectedCount={selectedIds.length}
          allSelected={
            selectedIds.length >= visibleIds.length && visibleIds.length > 0
          }
          onToggleAll={() => toggleAll(visibleIds)}
          onSetPayee={setPayeeForSelected}
          onDelete={deleteSelected}
          onDone={exit}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.xs,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    fontSize: 14,
    color: colors.text,
  },
  selectLink: { color: colors.accent, fontWeight: '600' },
  // Links, not fields — they sit next to each other and take the width
  // of their own text rather than splitting the row in half.
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  filterField: { flexShrink: 1 },
  // A day is the unit this list is read in, so it gets real air around it —
  // but it is a divider, not content: muted and a size under the payee names
  // it separates, so the eye lands on the transactions first and uses the
  // dates to navigate between them.
  dateGroup: { marginBottom: spacing.lg },
  dateHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  payee: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  memo: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  // Coloured text, no dot beside it — same as an account's own list.
  amount: { fontSize: 15, fontWeight: '700' },
  negative: { color: colors.negative },
  positive: { color: colors.positive },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  deleteBar: {
    backgroundColor: colors.negative,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBarText: { color: '#fff', fontWeight: '700' },
});
