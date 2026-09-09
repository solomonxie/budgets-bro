import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useAppStore } from '../../state/useAppStore';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { getDb } from '../../db/client';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import { Chip } from '../../components/ui/Chip';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { currentDateISO } from '../../domain/month';

export function AddTransactionModal() {
  const isOpen = useAppStore((s) => s.isAddTransactionOpen);
  const close = useAppStore((s) => s.closeAddTransaction);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const { accounts } = useAccounts();
  const { categories } = useCategories();

  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [payee, setPayee] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  const [cleared, setCleared] = useState(false);
  const [isInterest, setIsInterest] = useState(false);

  useEffect(() => {
    if (isOpen && accounts.length > 0 && accountId == null) {
      setAccountId(accounts[0].account.id);
    }
  }, [isOpen, accounts, accountId]);

  const reset = () => {
    setAmount('');
    setDirection('out');
    setPayee('');
    setCategoryId(null);
    setMemo('');
    setCleared(false);
    setIsInterest(false);
  };

  const cancel = () => {
    close();
    reset();
  };

  const save = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0 || accountId == null) {
      cancel();
      return;
    }
    const amountCents = Math.round(parsed * 100) * (direction === 'out' ? -1 : 1);
    const db = await getDb();
    await transactionsRepo.createTransaction(db, {
      accountId,
      categoryId,
      payeeName: payee,
      memo: memo || null,
      amountCents,
      date: currentDateISO(),
      cleared,
      isInterest: direction === 'in' && isInterest,
    });
    bumpDataVersion();
    close();
    reset();
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancel}>
      <ScrollView contentContainerStyle={styles.sheet}>
        <View style={styles.header}>
          <Pressable onPress={cancel}>
            <Text style={styles.headerBtn}>Cancel</Text>
          </Pressable>
          <Pressable onPress={save}>
            <Text style={[styles.headerBtn, styles.saveBtn]}>Save</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.amountInput}
          placeholder="$0.00"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.segmented}>
          <Pressable
            style={[styles.segment, direction === 'out' && styles.segmentActive]}
            onPress={() => setDirection('out')}
          >
            <Text style={[styles.segmentText, direction === 'out' && styles.segmentTextActive]}>Spending</Text>
          </Pressable>
          <Pressable
            style={[styles.segment, direction === 'in' && styles.segmentActive]}
            onPress={() => setDirection('in')}
          >
            <Text style={[styles.segmentText, direction === 'in' && styles.segmentTextActive]}>Income</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.textInput}
          placeholder="Payee"
          value={payee}
          onChangeText={setPayee}
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.label}>Category</Text>
        <View style={styles.chipRow}>
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={`${c.icon ? c.icon + ' ' : ''}${c.name}`}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            />
          ))}
        </View>
        <Text style={styles.label}>Account</Text>
        <View style={styles.chipRow}>
          {accounts.map(({ account }) => (
            <Chip
              key={account.id}
              label={account.name}
              selected={accountId === account.id}
              onPress={() => setAccountId(account.id)}
            />
          ))}
        </View>
        <TextInput
          style={styles.textInput}
          placeholder="Memo"
          value={memo}
          onChangeText={setMemo}
          placeholderTextColor={colors.textMuted}
        />
        {direction === 'in' ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Interest income</Text>
            <Switch value={isInterest} onValueChange={setIsInterest} trackColor={{ true: colors.accent, false: colors.border }} />
          </View>
        ) : null}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Cleared</Text>
          <Switch value={cleared} onValueChange={setCleared} trackColor={{ true: colors.accent, false: colors.border }} />
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: spacing.md, gap: spacing.md, backgroundColor: colors.background, flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  saveBtn: { color: colors.accent },
  amountInput: {
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
    paddingVertical: 6,
  },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  switchLabel: { fontSize: 15, color: colors.text },
});
