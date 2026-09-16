import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useAppStore } from '../../state/useAppStore';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { usePayees } from '../../hooks/usePayees';
import { getDb } from '../../db/client';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import * as scheduledTransactionsRepo from '../../db/repositories/scheduledTransactionsRepo';
import {
  DropdownField,
  DropdownGroupLabel,
  DropdownOption,
} from '../../components/ui/DropdownField';
import { SearchableDropdownField } from '../../components/ui/SearchableDropdownField';
import { DateField } from '../../components/ui/DateField';
import { RepeatField } from '../../components/ui/RepeatField';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { currentDateISO } from '../../domain/month';
import type { RecurrenceRule } from '../../domain/recurrence';

const DEFAULT_RULE: RecurrenceRule = {
  frequency: 'monthly',
  intervalN: 1,
  daysOfWeekMask: null,
};

// YNAB-style amount entry: `amount` holds raw digits, always read right-to-
// left as cents — typing "4444" reads as $44.44, no decimal point needed.
//
// The displayed text is reformatted from those digits on every keystroke, so
// it never matches what the native input just showed: type "3" into "$0.05"
// and the field momentarily holds "$0.053" (6 chars) before React Native
// replaces it with "$0.53" (5). Every replacement resets the native
// selection, which is the caret jumping back and forth — hence the pinned
// `selection` on the input below.
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
  const {
    open: isOpen,
    editingTransactionId,
    presetAccountId,
  } = useAppStore((s) => s.transactionModal);
  const close = useAppStore((s) => s.closeTransactionModal);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const { accounts } = useAccounts();
  const { groups, categories } = useCategories();
  const { payees } = usePayees();
  const isEditing = editingTransactionId != null;

  const amountInputRef = useRef<TextInput>(null);
  // iOS leaves the InputAccessoryView floating at the bottom of the screen
  // after the keyboard dismisses if it stays mounted — only mount it while
  // the amount field actually has focus.
  const [amountFocused, setAmountFocused] = useState(false);

  const [amount, setAmount] = useState('');
  const amountDisplay = amount ? `$${formatAmountDigits(amount)}` : '';
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [payee, setPayee] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  // Income accounts hold no real balance — they're a tag on a transaction,
  // not somewhere money sits (see migration 021) — so they're never a
  // choice in the real "Account" field, only in the separate Income
  // Account tag below.
  const realAccounts = accounts.filter((a) => a.account.type !== 'income');
  const incomeAccounts = accounts.filter((a) => a.account.type === 'income');
  const [incomeAccountId, setIncomeAccountId] = useState<number | null>(null);
  const selectIncomeAccount = (id: number | null) => {
    Keyboard.dismiss();
    setIncomeAccountId(id);
    // Tagging only ever makes sense on an inflow — switch the toggle so
    // picking one doesn't silently get dropped by the outflow branch below.
    // Scheduling isn't offered for income (see the toggle below), so drop
    // it too rather than leave a hidden-but-still-active schedule behind.
    if (id != null) {
      setDirection('in');
      setIsScheduled(false);
    }
  };
  // Off-budget accounts (Tracking, Asset) sit outside the envelope system
  // entirely (net-worth-only, never assigned money — see accountsRepo's
  // on_budget derivation), so a category there wouldn't mean anything:
  // there's no assigned cash for it to be spent out of. Budget activity
  // queries already guard against this server-side (see
  // databases/queries/budgets.ts), but the field shouldn't even be offered
  // here.
  const isTrackingAccount =
    accounts.find((a) => a.account.id === accountId)?.account.onBudget ===
    false;
  const [date, setDate] = useState(currentDateISO());
  // Recurring-schedule fields — only offered for a brand-new transaction
  // (see the toggle below); editing an already-posted one has no
  // "make this recurring" path. Every schedule auto-posts on its due date
  // (see useAutoPostScheduledTransactions) — there's no manual-approve
  // queue to review first.
  const [isScheduled, setIsScheduled] = useState(false);
  const [rule, setRule] = useState<RecurrenceRule>(DEFAULT_RULE);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState(currentDateISO());

  useEffect(() => {
    if (!isOpen) return;
    if (editingTransactionId != null) {
      (async () => {
        const db = await getDb();
        const t = await transactionsRepo.getTransaction(
          db,
          editingTransactionId,
        );
        if (!t) return;
        setAmount(String(Math.abs(t.amountCents)));
        setDirection(t.amountCents < 0 ? 'out' : 'in');
        setPayee(t.payeeName ?? '');
        setCategoryId(t.categoryId);
        setAccountId(t.accountId);
        setIncomeAccountId(t.incomeAccountId);
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
    if (!isOpen || editingTransactionId != null || realAccounts.length === 0)
      return;
    setAccountId(
      (prev) => presetAccountId ?? prev ?? realAccounts[0].account.id,
    );
  }, [isOpen, editingTransactionId, presetAccountId, realAccounts]);

  useEffect(() => {
    // An income transaction must be tagged to a stream — default to
    // whichever one was last used (or the first) so the field is never
    // blank, same as the real Account field above.
    if (!isOpen || incomeAccounts.length === 0) return;
    setIncomeAccountId((prev) => prev ?? incomeAccounts[0].account.id);
  }, [isOpen, incomeAccounts]);

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
    setIncomeAccountId(null);
    setMemo('');
    setDate(currentDateISO());
    setIsScheduled(false);
    setRule(DEFAULT_RULE);
    setHasEndDate(false);
    setEndDate(currentDateISO());
  };

  const cancel = () => {
    close();
    reset();
  };

  const selectPayee = async (name: string, id: number) => {
    setPayee(name);
    const db = await getDb();
    const lastCategoryId = await transactionsRepo.getLastCategoryIdForPayee(
      db,
      id,
    );
    if (lastCategoryId != null) setCategoryId(lastCategoryId);
  };

  const save = async () => {
    Keyboard.dismiss();
    const enteredCents = centsFromAmountDigits(amount);
    const missingIncomeAccount =
      direction === 'in' &&
      incomeAccounts.length > 0 &&
      incomeAccountId == null;
    if (!enteredCents || accountId == null || missingIncomeAccount) {
      cancel();
      return;
    }
    const amountCents = enteredCents * (direction === 'out' ? -1 : 1);
    const db = await getDb();
    // Defense in depth — the field's already hidden for a tracking account
    // or an income transaction (income needs no category), but never let a
    // stale categoryId slip through regardless.
    const categoryIdToSave =
      isTrackingAccount || direction === 'in' ? null : categoryId;
    if (isScheduled && editingTransactionId == null) {
      await scheduledTransactionsRepo.createScheduledTransaction(db, boardId, {
        accountId,
        categoryId: categoryIdToSave,
        payeeName: payee,
        memo: memo || null,
        amountCents,
        frequency: rule.frequency,
        intervalN: rule.intervalN,
        daysOfWeekMask: rule.daysOfWeekMask,
        nextDate: date,
        endDate: hasEndDate ? endDate : null,
        incomeAccountId: direction === 'in' ? incomeAccountId : null,
      });
      bumpDataVersion();
      close();
      reset();
      return;
    }
    const input = {
      accountId,
      categoryId: categoryIdToSave,
      payeeName: payee,
      memo: memo || null,
      amountCents,
      date,
      incomeAccountId: direction === 'in' ? incomeAccountId : null,
    };
    if (editingTransactionId != null) {
      await transactionsRepo.updateTransaction(db, boardId, {
        ...input,
        id: editingTransactionId,
      });
    } else {
      await transactionsRepo.createTransaction(db, boardId, input);
    }
    bumpDataVersion();
    close();
    reset();
  };

  const remove = () => {
    if (editingTransactionId == null) return;
    Keyboard.dismiss();
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
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={cancel}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tapping any blank gap between fields dismisses the keyboard —
              keyboardShouldPersistTaps="handled" above already lets taps on
              the fields/buttons themselves still register in one tap. */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    cancel();
                  }}
                >
                  <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
                </Pressable>
                {/* Folded into the header's empty right side instead of its own
                full-width checkbox row below — a "Scheduled" toggle doesn't
                need a whole line to itself, and the header has the room.
                Hidden for income: paychecks/deposits are logged after the
                fact, not set up in advance like a recurring bill, and
                dropping it keeps the Income form short enough that the
                keyboard doesn't push Save off-screen. */}
                {isEditing || direction === 'in' ? null : (
                  <Pressable
                    style={[
                      styles.scheduledPill,
                      isScheduled && styles.scheduledPillActive,
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setIsScheduled((v) => !v);
                    }}
                  >
                    <Text
                      style={[
                        styles.scheduledPillText,
                        isScheduled && styles.scheduledPillTextActive,
                      ]}
                    >
                      {t(
                        isScheduled
                          ? 'addTransactionModal.scheduledToggleLabelActive'
                          : 'addTransactionModal.scheduledToggleLabel',
                      )}
                    </Text>
                  </Pressable>
                )}
              </View>
              <TextInput
                ref={amountInputRef}
                style={styles.amountInput}
                placeholder={t('spend.amountPlaceholder')}
                keyboardType="number-pad"
                keyboardAppearance="dark"
                inputAccessoryViewID={
                  Platform.OS === 'ios' ? AMOUNT_ACCESSORY_ID : undefined
                }
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
                value={amountDisplay}
                // The caret can only ever belong at the end here — digits
                // accumulate right-to-left and there is nothing to edit in
                // the middle. Pinning it stops the bounce described above.
                selection={amountFocused ? { start: amountDisplay.length, end: amountDisplay.length } : undefined}
                onChangeText={(text) =>
                  setAmount(
                    text
                      .replace(/\D/g, '')
                      .replace(/^0+(?=\d)/, '')
                      .slice(0, 9),
                  )
                }
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.segmented}>
                <Pressable
                  style={[
                    styles.segment,
                    direction === 'out' && styles.segmentActive,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setDirection('out');
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      direction === 'out' && styles.segmentTextActive,
                    ]}
                  >
                    {t('spend.spending')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.segment,
                    direction === 'in' && styles.segmentActive,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setDirection('in');
                    setIsScheduled(false);
                  }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      direction === 'in' && styles.segmentTextActive,
                    ]}
                  >
                    {t('spend.income')}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.microLabel}>{t('common.payee')}</Text>
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
                {direction === 'in' ? (
                  incomeAccounts.length > 0 ? (
                    <View style={styles.half}>
                      <Text style={styles.microLabel}>
                        {t('addTransactionModal.incomeAccountLabel')}
                      </Text>
                      <DropdownField
                        compact
                        hideLabel
                        label={t('addTransactionModal.incomeAccountLabel')}
                        placeholder={t(
                          'addTransactionModal.incomeAccountLabel',
                        )}
                        valueLabel={
                          incomeAccounts.find(
                            (a) => a.account.id === incomeAccountId,
                          )?.account.name ?? ''
                        }
                      >
                        {(close) => (
                          <>
                            {incomeAccounts.map(({ account }) => (
                              <DropdownOption
                                key={account.id}
                                label={account.name}
                                selected={incomeAccountId === account.id}
                                onPress={() => {
                                  selectIncomeAccount(account.id);
                                  close();
                                }}
                              />
                            ))}
                          </>
                        )}
                      </DropdownField>
                    </View>
                  ) : null
                ) : isTrackingAccount ? null : (
                  <View style={styles.half}>
                    <Text style={styles.microLabel}>
                      {t('common.category')}
                    </Text>
                    <DropdownField
                      compact
                      hideLabel
                      label={t('common.category')}
                      valueLabel={
                        categoryId == null
                          ? ''
                          : (() => {
                              const c = categories.find(
                                (cat) => cat.id === categoryId,
                              );
                              return c
                                ? `${c.icon ? c.icon + ' ' : ''}${c.name}`
                                : '';
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
                )}
              </View>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.microLabel}>
                    {t(
                      isScheduled
                        ? 'addTransactionModal.startDateLabel'
                        : 'common.date',
                    )}
                  </Text>
                  <DateField
                    hideLabel
                    shortFormat
                    label={t(
                      isScheduled
                        ? 'addTransactionModal.startDateLabel'
                        : 'common.date',
                    )}
                    value={date}
                    onChange={setDate}
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.microLabel}>{t('common.account')}</Text>
                  <DropdownField
                    compact
                    hideLabel
                    label={t('common.account')}
                    placeholder={t('common.account')}
                    valueLabel={
                      realAccounts.find((a) => a.account.id === accountId)
                        ?.account.name ?? ''
                    }
                  >
                    {(close) => (
                      <>
                        {realAccounts.map(({ account }) => (
                          <DropdownOption
                            key={account.id}
                            label={account.name}
                            selected={accountId === account.id}
                            onPress={() => {
                              setAccountId(account.id);
                              if (!account.onBudget) setCategoryId(null);
                              close();
                            }}
                          />
                        ))}
                      </>
                    )}
                  </DropdownField>
                </View>
              </View>
              {isScheduled ? (
                <>
                  <RepeatField
                    label={t('addTransactionModal.repeatLabel')}
                    rule={rule}
                    onChange={setRule}
                    startDate={date}
                  />
                  <Pressable
                    style={styles.checkboxRow}
                    onPress={() => {
                      Keyboard.dismiss();
                      setHasEndDate((v) => !v);
                    }}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        hasEndDate && styles.checkboxChecked,
                      ]}
                    >
                      {hasEndDate ? (
                        <Text style={styles.checkboxMark}>✓</Text>
                      ) : null}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      {t('addTransactionModal.hasEndDateLabel')}
                    </Text>
                  </Pressable>
                  {hasEndDate ? (
                    <DateField
                      label={t('addTransactionModal.endDateLabel')}
                      value={endDate}
                      onChange={setEndDate}
                    />
                  ) : null}
                </>
              ) : null}
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
                  <Text style={styles.deleteButtonText}>
                    {t('spend.deleteTransaction')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
        {Platform.OS === 'ios' && amountFocused ? (
          <InputAccessoryView nativeID={AMOUNT_ACCESSORY_ID}>
            <View style={styles.accessoryBar}>
              <Pressable
                onPress={() => amountInputRef.current?.blur()}
                hitSlop={10}
              >
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
  // flexGrow on the ScrollView's own contentContainer, not `sheet` below —
  // `sheet` sits one level deeper now (inside the tap-to-dismiss wrapper),
  // so it just needs to fill whatever height the container grew to.
  scrollContent: { flexGrow: 1, backgroundColor: colors.background },
  sheet: {
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  scheduledPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  scheduledPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  scheduledPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  scheduledPillTextActive: { color: '#fff' },
  // Payee+category, then date+account — each pair side by side instead of
  // stacked, so the form reads shorter without dropping any field.
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  // A tiny caption above an otherwise-unlabeled compact field, just enough
  // to say what it is without pushing the form taller like the full-size
  // label (fontSize 13 + marginBottom 6) would.
  microLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 2,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkboxLabel: { fontSize: 14, color: colors.text },
  bigSaveButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
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
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
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
