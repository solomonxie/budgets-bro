import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  InputAccessoryView,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppStore } from '../../state/useAppStore';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { getDb } from '../../db/client';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import { DropdownField, DropdownGroupLabel, DropdownOption } from '../../components/ui/DropdownField';
import { SearchableDropdownField } from '../../components/ui/SearchableDropdownField';
import { DateField } from '../../components/ui/DateField';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { currentDateISO } from '../../domain/month';

// YNAB-style amount entry: `amount` holds raw digits, always read right-to-
// left as cents — typing "4444" reads as $44.44, no decimal point needed.
function centsFromAmountDigits(digits: string): number {
  return digits ? parseInt(digits, 10) : 0;
}

function formatAmountDigits(digits: string): string {
  return (centsFromAmountDigits(digits) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const AMOUNT_ACCESSORY_ID = 'add-transaction-amount-accessory';

export function AddTransactionModal() {
  const t = useT();
  const { open: isOpen, editingTransactionId, presetAccountId } = useAppStore((s) => s.transactionModal);
  const close = useAppStore((s) => s.closeTransactionModal);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const { accounts } = useAccounts();
  const { groups, categories } = useCategories();
  const { payees } = usePayees();
  const isEditing = editingTransactionId != null;

  const amountInputRef = useRef<TextInput>(null);

  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [payee, setPayee] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  const [date, setDate] = useState(currentDateISO());

  useEffect(() => {
    if (!isOpen) return;
    if (editingTransactionId != null) {
      (async () => {
        const db = await getDb();
        const t = await transactionsRepo.getTransaction(db, editingTransactionId);
        if (!t) return;
        setAmount(String(Math.abs(t.amountCents)));
        setDirection(t.amountCents < 0 ? 'out' : 'in');
        setPayee(t.payeeName ?? '');
        setCategoryId(t.categoryId);
        setAccountId(t.accountId);
        setMemo(t.memo ?? '');
        setDate(t.date);
      })();
    }
  }, [isOpen, editingTransactionId]);

  useEffect(() => {
    // A preset (opened from an account page) always wins; otherwise keep
    // remembering whatever account was last used. Kept separate from the
    // focus effect below so an unrelated `accounts` refetch (e.g. another
    // screen bumping dataVersion) never steals focus back to the amount
    // field mid-edit.
    if (!isOpen || editingTransactionId != null || accounts.length === 0) return;
    setAccountId((prev) => presetAccountId ?? prev ?? accounts[0].account.id);
  }, [isOpen, editingTransactionId, presetAccountId, accounts]);

  useEffect(() => {
    // Autofocus the amount field and pop the number pad — but only the
    // instant the sheet opens for a brand-new transaction, never when
    // editing an existing one (its amount is already known).
    if (!isOpen || editingTransactionId != null) return;
    requestAnimationFrame(() => amountInputRef.current?.focus());
  }, [isOpen, editingTransactionId]);

  const reset = () => {
    setAmount('');
    setDirection('out');
    setPayee('');
    setCategoryId(null);
    setMemo('');
    setDate(currentDateISO());
  };

  const cancel = () => {
    close();
    reset();
  };

  const selectPayee = async (name: string, id: number) => {
    setPayee(name);
    const db = await getDb();
    const lastCategoryId = await transactionsRepo.getLastCategoryIdForPayee(db, id);
    if (lastCategoryId != null) setCategoryId(lastCategoryId);
  };

  const save = async () => {
    const enteredCents = centsFromAmountDigits(amount);
    if (!enteredCents || accountId == null) {
      cancel();
      return;
    }
    const amountCents = enteredCents * (direction === 'out' ? -1 : 1);
    const db = await getDb();
    const input = {
      accountId,
      categoryId,
      payeeName: payee,
      memo: memo || null,
      amountCents,
      date,
    };
    if (editingTransactionId != null) {
      await transactionsRepo.updateTransaction(db, boardId, { ...input, id: editingTransactionId });
    } else {
      await transactionsRepo.createTransaction(db, boardId, input);
    }
    bumpDataVersion();
    close();
    reset();
  };

  const remove = () => {
    if (editingTransactionId == null) return;
    Alert.alert(t('spend.deleteConfirmTitle'), t('common.cannotBeUndone'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={cancel}>
              <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
          <TextInput
            ref={amountInputRef}
            style={styles.amountInput}
            placeholder={t('spend.amountPlaceholder')}
            keyboardType="number-pad"
            keyboardAppearance="dark"
            inputAccessoryViewID={Platform.OS === 'ios' ? AMOUNT_ACCESSORY_ID : undefined}
            value={amount ? `$${formatAmountDigits(amount)}` : ''}
            onChangeText={(text) => setAmount(text.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9))}
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.segmented}>
            <Pressable
              style={[styles.segment, direction === 'out' && styles.segmentActive]}
              onPress={() => setDirection('out')}
            >
              <Text style={[styles.segmentText, direction === 'out' && styles.segmentTextActive]}>{t('spend.spending')}</Text>
            </Pressable>
            <Pressable
              style={[styles.segment, direction === 'in' && styles.segmentActive]}
              onPress={() => setDirection('in')}
            >
              <Text style={[styles.segmentText, direction === 'in' && styles.segmentTextActive]}>{t('spend.income')}</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <SearchableDropdownField
                compact
                hideLabel
                label={t('common.payee')}
                valueLabel={payee}
                placeholder={t('spend.payeePlaceholder')}
                searchPlaceholder={t('spend.payeeSearchPlaceholder')}
                options={payees.map((p) => ({ id: p.id, label: p.name }))}
                onSelect={(o) => selectPayee(o.label, o.id)}
                onUseText={setPayee}
              />
            </View>
            <View style={styles.half}>
              <DropdownField
                compact
                hideLabel
                label={t('common.category')}
                valueLabel={
                  categoryId == null
                    ? ''
                    : (() => {
                        const c = categories.find((cat) => cat.id === categoryId);
                        return c ? `${c.icon ? c.icon + ' ' : ''}${c.name}` : '';
                      })()
                }
                placeholder={t('common.uncategorized')}
              >
                {(close) => (
                  <>
                    <DropdownOption
                      label={t('common.uncategorized')}
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
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <DateField hideLabel shortFormat label={t('common.date')} value={date} onChange={setDate} />
            </View>
            <View style={styles.half}>
              <DropdownField
                compact
                hideLabel
                label={t('common.account')}
                placeholder={t('common.account')}
                valueLabel={accounts.find((a) => a.account.id === accountId)?.account.name ?? ''}
              >
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
            </View>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder={t('spend.memoPlaceholder')}
            value={memo}
            onChangeText={setMemo}
            placeholderTextColor={colors.textMuted}
            keyboardAppearance="dark"
          />
          <Pressable style={styles.bigSaveButton} onPress={save}>
            <Text style={styles.bigSaveButtonText}>{t('common.save')}</Text>
          </Pressable>
          {isEditing ? (
            <Pressable style={styles.deleteButton} onPress={remove}>
              <Text style={styles.deleteButtonText}>{t('spend.deleteTransaction')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
        {Platform.OS === 'ios' ? (
          <InputAccessoryView nativeID={AMOUNT_ACCESSORY_ID}>
            <View style={styles.accessoryBar}>
              <Pressable onPress={() => amountInputRef.current?.blur()} hitSlop={10}>
                <Text style={styles.accessoryDoneText}>{t('common.done')}</Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  sheet: { padding: spacing.md, gap: spacing.md, backgroundColor: colors.background, flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  // Payee+category, then date+account — each pair side by side instead of
  // stacked, so the form reads shorter without dropping any field.
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  bigSaveButton: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  bigSaveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accessoryDoneText: { fontSize: 16, fontWeight: '600', color: colors.accent },
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
  deleteButton: { alignItems: 'center', paddingVertical: spacing.sm },
  deleteButtonText: { color: colors.negative, fontWeight: '700' },
});
