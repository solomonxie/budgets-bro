import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { DropdownField, DropdownGroupLabel, DropdownOption } from '../../components/ui/DropdownField';
import { useTransactions } from '../../hooks/useTransactions';
import { useCategories } from '../../hooks/useCategories';
import { getDb } from '../../db/client';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import { useAppStore } from '../../state/useAppStore';
import { formatMoney } from '../../domain/money';
import { lastNMonths, formatMonthLabel, currentMonth } from '../../domain/month';
import { useI18n, localeTag } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { TransactionWithLabels } from '../../domain/types';
import type { TransactionsFilterParams } from '../../navigation/types';

type Route = RouteProp<{ Transactions: TransactionsFilterParams }, 'Transactions'>;

interface DateGroup {
  date: string;
  items: TransactionWithLabels[];
}

const MONTH_FILTER_OPTIONS = lastNMonths(currentMonth(), 12).reverse();

export function TransactionsScreen() {
  const { t, language } = useI18n();
  const route = useRoute<Route>();
  const { transactions, refresh } = useTransactions();
  const { groups, categories } = useCategories();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const openEditTransaction = useAppStore((s) => s.openEditTransaction);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  // Set only by Insights' "All Others" row — every category outside its
  // top-N breakdown, matched instead of (and clearing) the single-select
  // `categoryFilter` above.
  const [otherCategoryIds, setOtherCategoryIds] = useState<number[] | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Arriving from the Budget screen's "Details" button or Insights presets filters.
  useEffect(() => {
    if (route.params?.categoryId != null) setCategoryFilter(route.params.categoryId);
    if (route.params?.categoryIds != null) setOtherCategoryIds(route.params.categoryIds);
    if (route.params?.month != null) setMonthFilter(route.params.month);
  }, [route.params]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (otherCategoryIds != null) {
        if (t.categoryId == null || !otherCategoryIds.includes(t.categoryId)) return false;
      } else if (categoryFilter != null && t.categoryId !== categoryFilter) {
        return false;
      }
      if (monthFilter != null && !t.date.startsWith(monthFilter)) return false;
      if (q && !(t.payeeName ?? '').toLowerCase().includes(q) && !(t.memo ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [transactions, query, categoryFilter, otherCategoryIds, monthFilter]);

  const grouped = useMemo<DateGroup[]>(() => {
    const byDate: DateGroup[] = [];
    for (const t of filtered) {
      const last = byDate[byDate.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else byDate.push({ date: t.date, items: [t] });
    }
    return byDate;
  }, [filtered]);

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const deleteSelected = async () => {
    const db = await getDb();
    await transactionsRepo.deleteTransactions(db, selectedIds);
    setSelectedIds([]);
    setSelectMode(false);
    bumpDataVersion();
    refresh();
  };

  const categoryFilterLabel = otherCategoryIds != null
    ? t('transactions.allOthers')
    : categoryFilter == null
      ? ''
      : (() => {
          const c = categories.find((cat) => cat.id === categoryFilter);
          return c ? `${c.icon ? c.icon + ' ' : ''}${c.name}` : '';
        })();
  const monthFilterLabel = monthFilter == null ? '' : formatMonthLabel(monthFilter, localeTag(language));

  return (
    <ScreenContainer>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          placeholder={t('transactions.searchPlaceholder')}
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={colors.textMuted}
          keyboardAppearance="dark"
        />
        <Pressable
          onPress={() => {
            setSelectMode((v) => !v);
            setSelectedIds([]);
          }}
        >
          <Text style={styles.selectLink}>{selectMode ? t('common.done') : t('transactions.select')}</Text>
        </Pressable>
      </View>
      <View style={styles.filterRow}>
        <View style={styles.filterField}>
          <DropdownField label={t('common.category')} valueLabel={categoryFilterLabel} placeholder={t('transactions.allCategories')}>
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
                  const groupCategories = categories.filter((c) => c.groupId === group.id);
                  if (groupCategories.length === 0) return null;
                  return (
                    <View key={group.id}>
                      <DropdownGroupLabel label={group.name} />
                      {groupCategories.map((c) => (
                        <DropdownOption
                          key={c.id}
                          label={`${c.icon ? c.icon + ' ' : ''}${c.name}`}
                          selected={otherCategoryIds == null && categoryFilter === c.id}
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
          <DropdownField compact label={t('common.month')} valueLabel={monthFilterLabel} placeholder={t('transactions.allMonths')}>
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
                onPress={() => (selectMode ? toggleSelected(txn.id) : openEditTransaction(txn.id))}
              >
                {selectMode ? (
                  <View style={[styles.checkbox, selectedIds.includes(txn.id) && styles.checkboxChecked]} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.payee}>{txn.payeeName ?? t('common.noPayee')}</Text>
                  <Text style={styles.sub}>
                    {txn.categoryIcon ? `${txn.categoryIcon} ` : ''}
                    {txn.categoryName ?? t('common.uncategorized')}
                  </Text>
                  {txn.memo ? (
                    <Text style={styles.memo} numberOfLines={1}>
                      {txn.memo}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.signDot, { backgroundColor: txn.amountCents < 0 ? colors.negative : colors.positive }]} />
                <Text style={styles.amount}>{formatMoney(txn.amountCents)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t('transactions.noMatch')}</Text>}
      />
      {selectMode && selectedIds.length > 0 ? (
        <Pressable style={styles.deleteBar} onPress={deleteSelected}>
          <Text style={styles.deleteBarText}>{t('transactions.deleteSelected', { count: selectedIds.length })}</Text>
        </Pressable>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  filterField: { flex: 1 },
  dateGroup: { marginBottom: spacing.sm },
  dateHeader: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.border },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  payee: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  memo: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  signDot: { width: 8, height: 8, borderRadius: 999 },
  amount: { fontSize: 15, fontWeight: '700', color: colors.text },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.lg },
  deleteBar: { backgroundColor: colors.negative, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  deleteBarText: { color: '#fff', fontWeight: '700' },
});
