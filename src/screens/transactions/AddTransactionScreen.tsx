import { useEffect, useLayoutEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { FieldCard, FieldRow } from '../../components/ui/FieldCard';
import { isLoanLikeType } from '../../domain/accountKind';
import { NumberPad } from '../../components/ui/NumberPad';
import { DateField } from '../../components/ui/DateField';
import { RepeatField } from '../../components/ui/RepeatField';
import { useT } from '../../i18n';
import {
  AmountExpression,
  EMPTY_AMOUNT,
  amountCents,
  amountFromCents,
  formatAmountExpression,
} from '../../domain/amountExpression';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { currentDateISO } from '../../domain/month';
import type { RecurrenceRule } from '../../domain/recurrence';
import type { RootStackParamList } from '../../navigation/types';

const DEFAULT_RULE: RecurrenceRule = {
  frequency: 'monthly',
  intervalN: 1,
  daysOfWeekMask: null,
};

type Nav = NativeStackNavigationProp<RootStackParamList, 'AddTransaction'>;
type Route = RouteProp<RootStackParamList, 'AddTransaction'>;

// A pushed page, not a sheet: back button top-left, swipe right from
// anywhere to leave (see RootNavigator's fullScreenGestureEnabled). It used
// to be a pageSheet you dismissed by dragging down, which fought the
// scrolling form underneath it.
export function AddTransactionScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const params = useRoute<Route>().params;
  const editingTransactionId = params?.transactionId ?? null;
  const presetAccountId = params?.presetAccountId ?? null;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const lastAccountId = useAppStore((s) => s.lastAccountId);
  const lastIncomeAccountId = useAppStore((s) => s.lastIncomeAccountId);
  const rememberAccounts = useAppStore((s) => s.rememberTransactionAccounts);
  const { accounts } = useAccounts();
  const { groups, categories } = useCategories();
  const { payees } = usePayees();
  const isEditing = editingTransactionId != null;

  // Typed on the page's own calculator pad — digits read right-to-left as
  // cents, plus one pending arithmetic operation. No TextInput behind the
  // number at all (see domain/amountExpression).
  const [amount, setAmount] = useState<AmountExpression>(EMPTY_AMOUNT);
  const amountDisplay = formatAmountExpression(amount);
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
  // A loan/mortgage account's rows are its own payment mirror legs: the payee
  // is the auto-managed one named after the account (payeesRepo's
  // ensureAccountPayee — that name is the link), and an existing row cannot be
  // moved to another account without orphaning the pair. Both read out,
  // neither invites an edit that would break the link.
  const selectedAccount = accounts.find((a) => a.account.id === accountId)?.account;
  const isLoanAccount = selectedAccount != null && isLoanLikeType(selectedAccount.type);
  const payeeLocked = isLoanAccount;
  const presetIsIncomeAccount =
    presetAccountId != null &&
    incomeAccounts.some((a) => a.account.id === presetAccountId);
  // Opened from an account's page, the account is the context you came from,
  // not a field — and an existing loan row cannot move accounts at all
  // without orphaning its mirror. (An Income preset fills the stream tag
  // instead, so the real account stays a choice there.)
  const accountLocked = (isLoanAccount && isEditing) || (presetAccountId != null && !presetIsIncomeAccount);
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
    if (editingTransactionId == null) return;
    (async () => {
      const db = await getDb();
      const txn = await transactionsRepo.getTransaction(
        db,
        editingTransactionId,
      );
      if (!txn) return;
      setAmount(amountFromCents(txn.amountCents));
      setDirection(txn.amountCents < 0 ? 'out' : 'in');
      setPayee(txn.payeeName ?? '');
      setCategoryId(txn.categoryId);
      setAccountId(txn.accountId);
      setIncomeAccountId(txn.incomeAccountId);
      setMemo(txn.memo ?? '');
      setDate(txn.date);
    })();
  }, [editingTransactionId]);

  useEffect(() => {
    // A preset (opened from an account page) always wins; otherwise the
    // account last saved to, which the store remembers across visits now
    // that this form unmounts when you leave it.
    if (editingTransactionId != null || realAccounts.length === 0) return;
    const preset = presetIsIncomeAccount ? null : presetAccountId;
    setAccountId(
      (prev) => preset ?? prev ?? lastAccountId ?? realAccounts[0].account.id,
    );
  }, [
    editingTransactionId,
    presetAccountId,
    presetIsIncomeAccount,
    realAccounts,
    lastAccountId,
  ]);

  useEffect(() => {
    // An income transaction must be tagged to a stream — default to
    // whichever one was last used (or the first) so the field is never
    // blank, same as the real Account field above.
    if (incomeAccounts.length === 0) return;
    setIncomeAccountId(
      (prev) => prev ?? lastIncomeAccountId ?? incomeAccounts[0].account.id,
    );
  }, [incomeAccounts, lastIncomeAccountId]);

  useEffect(() => {
    // Opened from an Income account's page: money never sits in one (see
    // migration 021), so preselect it as the stream tag and flip to inflow
    // instead of trying to use it as the account.
    if (editingTransactionId != null || !presetIsIncomeAccount) return;
    setIncomeAccountId(presetAccountId);
    setDirection('in');
  }, [editingTransactionId, presetIsIncomeAccount, presetAccountId]);

  // The "repeating" toggle lives in the header rather than costing the form
  // a whole row of its own. Hidden for income: paychecks are logged after
  // the fact, not set up in advance like a recurring bill.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight:
        isEditing || direction === 'in'
          ? undefined
          : () => (
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
            ),
    });
  }, [navigation, isEditing, direction, isScheduled, t]);

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
    const enteredCents = amountCents(amount);
    const missingIncomeAccount =
      direction === 'in' &&
      incomeAccounts.length > 0 &&
      incomeAccountId == null;
    if (!enteredCents || accountId == null || missingIncomeAccount) {
      navigation.goBack();
      return;
    }
    const signedCents = enteredCents * (direction === 'out' ? -1 : 1);
    const db = await getDb();
    // Defense in depth — the field's already hidden for a tracking account
    // or an income transaction (income needs no category), but never let a
    // stale categoryId slip through regardless.
    const categoryIdToSave =
      isTrackingAccount || direction === 'in' ? null : categoryId;
    // A loan account's payee is the one named after it — the link itself, not
    // a label. The field reads out rather than picks, so pin it here too.
    const payeeToSave = payeeLocked ? selectedAccount!.name : payee;
    if (isScheduled && editingTransactionId == null) {
      await scheduledTransactionsRepo.createScheduledTransaction(db, boardId, {
        accountId,
        categoryId: categoryIdToSave,
        payeeName: payeeToSave,
        memo: memo || null,
        amountCents: signedCents,
        frequency: rule.frequency,
        intervalN: rule.intervalN,
        daysOfWeekMask: rule.daysOfWeekMask,
        nextDate: date,
        endDate: hasEndDate ? endDate : null,
        incomeAccountId: direction === 'in' ? incomeAccountId : null,
      });
    } else {
      const input = {
        accountId,
        categoryId: categoryIdToSave,
        payeeName: payeeToSave,
        memo: memo || null,
        amountCents: signedCents,
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
    }
    rememberAccounts(accountId, incomeAccountId);
    bumpDataVersion();
    navigation.goBack();
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
          navigation.goBack();
        },
      },
    ]);
  };

  const dateLabel = t(
    isScheduled ? 'addTransactionModal.startDateLabel' : 'common.date',
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // The page starts below a navigation header now; without its height
      // the memo's keyboard lifts the form by that much too far.
      keyboardVerticalOffset={headerHeight}
    >
      {/* Amount and direction stay pinned above the scroll: the pad further
          down is always editing this number, so it must stay in sight
          however far the form is scrolled. */}
      <View style={styles.amountHeader}>
        <Text
          style={[styles.amount, !amountDisplay && styles.amountPlaceholder]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {amountDisplay || t('spend.amountPlaceholder')}
        </Text>
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
            style={[styles.segment, direction === 'in' && styles.segmentActive]}
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
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        // The memo's keyboard is the only thing on this page that floats
        // over the form — so it goes away the moment you drag, rather than
        // hanging over the pad and Save button while you scroll past them.
        keyboardDismissMode="on-drag"
      >
        {/* Tapping any blank gap between fields dismisses the memo's
            keyboard — keyboardShouldPersistTaps="handled" above already lets
            taps on the fields/buttons themselves still register in one tap. */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.form}>
            {/* One card, one row per field — outlined boxes stacked
                above an outlined pad was all border and no form. */}
            <FieldCard>
              {payeeLocked ? (
                <FieldRow label={t('common.payee')} value={selectedAccount!.name} />
              ) : (
                <SearchableDropdownField
                  compact
                  row
                  label={t('common.payee')}
                  valueLabel={payee}
                  placeholder={t('spend.payeePlaceholder')}
                  searchPlaceholder={t('spend.payeeSearchPlaceholder')}
                  options={payees.map((p) => ({ id: p.id, label: p.name }))}
                  onSelect={(o) => selectPayee(o.label, o.id)}
                  onUseText={setPayee}
                />
              )}
              {direction === 'in' ? (
                incomeAccounts.length > 0 ? (
                  <DropdownField
                    compact
                    row
                    label={t('addTransactionModal.incomeAccountLabel')}
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
                ) : null
              ) : isTrackingAccount ? null : (
                <DropdownField
                  compact
                  row
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
              )}
              {accountLocked ? (
                <FieldRow label={t('common.account')} value={selectedAccount!.name} />
              ) : (
              <DropdownField
                compact
                row
                label={t('common.account')}
                valueLabel={
                  realAccounts.find((a) => a.account.id === accountId)?.account
                    .name ?? ''
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
              )}
              <DateField
                row
                label={dateLabel}
                value={date}
                onChange={setDate}
              />
              <TextInput
                style={styles.memoRow}
                placeholder={t('spend.memoPlaceholder')}
                value={memo}
                onChangeText={setMemo}
                placeholderTextColor={colors.textMuted}
                keyboardAppearance="dark"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </FieldCard>
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
            <NumberPad
              value={amount}
              onChange={setAmount}
              submitLabel={t('common.save')}
              onSubmit={save}
            />
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  amountHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  amount: {
    fontSize: 52,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
    paddingVertical: 6,
  },
  amountPlaceholder: { color: colors.textMuted },
  scrollContent: { flexGrow: 1 },
  form: { padding: spacing.md, gap: spacing.md },
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
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  // The card's last row, typed into in place — no box of its own.
  memoRow: {
    minHeight: 58,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  deleteButton: { alignItems: 'center', paddingVertical: spacing.sm },
  deleteButtonText: { color: colors.negative, fontWeight: '700' },
});
