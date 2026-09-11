import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { useTransactions } from '../../hooks/useTransactions';
import { getDb } from '../../db/client';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import { useAppStore } from '../../state/useAppStore';
import { formatMoney } from '../../domain/money';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { TransactionWithLabels } from '../../domain/types';

interface DateGroup {
  date: string;
  items: TransactionWithLabels[];
}

export function TransactionsScreen() {
  const { transactions, refresh } = useTransactions();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const openEditTransaction = useAppStore((s) => s.openEditTransaction);
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (t) => (t.payeeName ?? '').toLowerCase().includes(q) || (t.memo ?? '').toLowerCase().includes(q),
    );
  }, [transactions, query]);

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

  return (
    <ScreenContainer>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          placeholder="Search payee or memo"
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          onPress={() => {
            setSelectMode((v) => !v);
            setSelectedIds([]);
          }}
        >
          <Text style={styles.selectLink}>{selectMode ? 'Done' : 'Select'}</Text>
        </Pressable>
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={grouped}
        keyExtractor={(g) => g.date}
        renderItem={({ item: group }) => (
          <View style={styles.dateGroup}>
            <Text style={styles.dateHeader}>{group.date}</Text>
            {group.items.map((t) => (
              <Pressable
                key={t.id}
                style={styles.row}
                onPress={() => (selectMode ? toggleSelected(t.id) : openEditTransaction(t.id))}
              >
                {selectMode ? (
                  <View style={[styles.checkbox, selectedIds.includes(t.id) && styles.checkboxChecked]} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.payee}>{t.payeeName ?? '(No payee)'}</Text>
                  <Text style={styles.sub}>
                    {t.categoryIcon ? `${t.categoryIcon} ` : ''}
                    {t.categoryName ?? 'Uncategorized'}
                  </Text>
                </View>
                <View style={[styles.signDot, { backgroundColor: t.amountCents < 0 ? colors.negative : colors.positive }]} />
                <Text style={styles.amount}>{formatMoney(t.amountCents)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
      />
      {selectMode && selectedIds.length > 0 ? (
        <Pressable style={styles.deleteBar} onPress={deleteSelected}>
          <Text style={styles.deleteBarText}>Delete {selectedIds.length} selected</Text>
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
  dateGroup: { marginBottom: spacing.sm },
  dateHeader: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.sm,
    marginBottom: 6,
  },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.border },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  payee: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  signDot: { width: 8, height: 8, borderRadius: 999 },
  amount: { fontSize: 15, fontWeight: '700', color: colors.text },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.lg },
  deleteBar: { backgroundColor: colors.negative, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  deleteBarText: { color: '#fff', fontWeight: '700' },
});
