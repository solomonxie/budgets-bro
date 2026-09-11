import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useAppStore } from '../../state/useAppStore';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { getDb } from '../../db/client';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import { DropdownField, DropdownGroupLabel, DropdownOption } from '../../components/ui/DropdownField';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { currentDateISO } from '../../domain/month';

export function AddTransactionModal() {
  const { open: isOpen, editingTransactionId, presetAccountId } = useAppStore((s) => s.transactionModal);
  const close = useAppStore((s) => s.closeTransactionModal);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const { accounts } = useAccounts();
  const { groups, categories } = useCategories();
  const { payees } = usePayees();
  const isEditing = editingTransactionId != null;

  const amountInputRef = useRef<TextInput>(null);

  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [payee, setPayee] = useState('');
  const [showPayeeSuggestions, setShowPayeeSuggestions] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  const [date, setDate] = useState(currentDateISO());
  const [cleared, setCleared] = useState(false);
  const [isInterest, setIsInterest] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingTransactionId != null) {
      (async () => {
        const db = await getDb();
        const t = await transactionsRepo.getTransaction(db, editingTransactionId);
        if (!t) return;
        setAmount((Math.abs(t.amountCents) / 100).toString());
        setDirection(t.amountCents < 0 ? 'out' : 'in');
        setPayee(t.payeeName ?? '');
        setCategoryId(t.categoryId);
        setAccountId(t.accountId);
        setMemo(t.memo ?? '');
        setDate(t.date);
        setCleared(t.cleared);
        setIsInterest(t.isInterest);
      })();
    } else if (accounts.length > 0) {
      // A preset (opened from an account page) always wins; otherwise keep
      // remembering whatever account was last used.
      setAccountId((prev) => presetAccountId ?? prev ?? accounts[0].account.id);
    }
    // Autofocus the amount field and pop the number pad the instant the sheet opens.
    requestAnimationFrame(() => amountInputRef.current?.focus());
  }, [isOpen, editingTransactionId, presetAccountId, accounts]);

  const reset = () => {
    setAmount('');
    setDirection('out');
    setPayee('');
    setShowPayeeSuggestions(false);
    setCategoryId(null);
    setMemo('');
    setDate(currentDateISO());
    setCleared(false);
    setIsInterest(false);
  };

  const cancel = () => {
    close();
    reset();
  };

  const selectPayeeSuggestion = async (name: string, id: number) => {
    setPayee(name);
    setShowPayeeSuggestions(false);
    const db = await getDb();
    const lastCategoryId = await transactionsRepo.getLastCategoryIdForPayee(db, id);
    if (lastCategoryId != null) setCategoryId(lastCategoryId);
  };

  const payeeSuggestions = payees.filter(
    (p) => payee.trim().length > 0 && p.name.toLowerCase().includes(payee.trim().toLowerCase()) && p.name !== payee,
  );

  const save = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0 || accountId == null) {
      cancel();
      return;
    }
    const amountCents = Math.round(parsed * 100) * (direction === 'out' ? -1 : 1);
    const db = await getDb();
    const input = {
      accountId,
      categoryId,
      payeeName: payee,
      memo: memo || null,
      amountCents,
      date,
      cleared,
      isInterest: direction === 'in' && isInterest,
    };
    if (editingTransactionId != null) {
      await transactionsRepo.updateTransaction(db, { ...input, id: editingTransactionId });
    } else {
      await transactionsRepo.createTransaction(db, input);
    }
    bumpDataVersion();
    close();
    reset();
  };

  const remove = () => {
    if (editingTransactionId == null) return;
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await transactionsRepo.deleteTransactions(db, [editingTransactionId]);
          bumpDataVersion();
          close();
          reset();
        },
      },
    ]);
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancel}>
      <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={cancel}>
            <Text style={styles.headerBtn}>Cancel</Text>
          </Pressable>
          <Pressable onPress={save}>
            <Text style={[styles.headerBtn, styles.saveBtn]}>Save</Text>
          </Pressable>
        </View>
        <TextInput
          ref={amountInputRef}
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
        <View>
          <TextInput
            style={styles.textInput}
            placeholder="Payee"
            value={payee}
            onChangeText={(v) => {
              setPayee(v);
              setShowPayeeSuggestions(true);
            }}
            onFocus={() => setShowPayeeSuggestions(true)}
            placeholderTextColor={colors.textMuted}
          />
          {showPayeeSuggestions && payeeSuggestions.length > 0 ? (
            <View style={styles.suggestions}>
              {payeeSuggestions.slice(0, 5).map((p) => (
                <Pressable key={p.id} style={styles.suggestionRow} onPress={() => selectPayeeSuggestion(p.name, p.id)}>
                  <Text style={styles.suggestionText}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <DropdownField
          label="Category"
          valueLabel={
            categoryId == null
              ? ''
              : (() => {
                  const c = categories.find((cat) => cat.id === categoryId);
                  return c ? `${c.icon ? c.icon + ' ' : ''}${c.name}` : '';
                })()
          }
          placeholder="Uncategorized"
        >
          {(close) => (
            <>
              <DropdownOption
                label="Uncategorized"
                selected={categoryId == null}
                onPress={() => {
                  setCategoryId(null);
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
                        selected={categoryId === c.id}
                        onPress={() => {
                          setCategoryId(c.id);
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
        <DropdownField label="Account" valueLabel={accounts.find((a) => a.account.id === accountId)?.account.name ?? ''}>
          {(close) => (
            <>
              {accounts.map(({ account }) => (
                <DropdownOption
                  key={account.id}
                  label={account.name}
                  selected={accountId === account.id}
                  onPress={() => {
                    setAccountId(account.id);
                    close();
                  }}
                />
              ))}
            </>
          )}
        </DropdownField>
        <TextInput
          style={styles.textInput}
          placeholder="Memo"
          value={memo}
          onChangeText={setMemo}
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={styles.textInput}
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
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
        {isEditing ? (
          <Pressable style={styles.deleteButton} onPress={remove}>
            <Text style={styles.deleteButtonText}>Delete Transaction</Text>
          </Pressable>
        ) : null}
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
  suggestions: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  suggestionRow: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionText: { fontSize: 14, color: colors.text },
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
  deleteButton: { alignItems: 'center', paddingVertical: spacing.sm },
  deleteButtonText: { color: colors.negative, fontWeight: '700' },
});
