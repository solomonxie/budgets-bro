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
import { ExpandingFieldGroup } from '../../components/ui/ExpandingField';
import {
  isLoanLikeType,
  isSpendingAccountType,
} from '../../domain/accountKind';
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
  // Every picker below opens in place: its options unfold in the row's own
  // space and push the pad down, rather than a sheet covering the amount and
  // the fields already filled in (see ExpandingField).
  return (
    <ExpandingFieldGroup>
      <AddTransactionForm />
    </ExpandingFieldGroup>
  );
}

function AddTransactionForm() {
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
  const rememberAccounts = useAppStore((s) => s.rememberTransactionAccounts);
  const { accounts } = useAccounts();
  const { groups, categories } = useCategories();
  const { payees } = usePayees('usage');
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
  const realAccounts = accounts;
  // A loan/mortgage row is half of a payment pair, and every leg names the
  // account across from it, never itself (migration 027). So the payee here
  // is the *paying* account: read out when editing (rewriting it would
  // orphan the pair — and pinning it to this account's own name, which this
  // used to do, quietly undid that migration one row at a time), and picked
  // from the other accounts when entering a new payment from this page.
  const selectedAccount = accounts.find(
    (a) => a.account.id === accountId,
  )?.account;
  const isLoanAccount =
    selectedAccount != null && isLoanLikeType(selectedAccount.type);
  const payeeReadOnly = isLoanAccount && isEditing;
  // Only an account can pay a loan: a typed name would make a plain payee,
  // which posts no mirror leg and leaves the payment one-sided.
  const payeeOptions =
    isLoanAccount && !isEditing
      ? payees.filter(
          (p) => p.linkedAccountId != null && p.linkedAccountId !== accountId,
        )
      : payees;
  // Opened from an account's page, the account is the context you came from,
  // not a field — and an existing loan row cannot move accounts at all
  // without orphaning its mirror.
  // Both locks render the account's name, so neither can engage before the
  // account is resolved: `accounts` loads async and `accountId` is set by an
  // effect, so the first render of a preset-opened form has neither yet.
  const accountLocked =
    selectedAccount != null &&
    ((isLoanAccount && isEditing) || presetAccountId != null);
  // A category only means something where money is actually spent out of
  // assigned cash — a cash account, savings, a credit card. Off-budget
  // accounts (Tracking, Asset) have no assigned cash for it to come out of,
  // and a loan account's rows are mirrored payment legs whose category lives
  // on the paying side. Budget activity queries already guard against this
  // (see databases/queries/budgets.ts); the field shouldn't be offered
  // either.
  // Choosing an account-linked payee makes this a transfer: the money is
  // moving between your own accounts, not being spent, and it gets its
  // category when it leaves the other side. Categorising it here would count
  // the same money twice.
  const isTransfer = payees.some(
    (p) => p.name === payee && p.linkedAccountId != null,
  );
  const takesCategory =
    selectedAccount != null &&
    isSpendingAccountType(selectedAccount.type) &&
    !isTransfer;
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
      setMemo(txn.memo ?? '');
      setDate(txn.date);
    })();
  }, [editingTransactionId]);

  useEffect(() => {
    // A preset (opened from an account page) always wins; otherwise the
    // account last saved to, which the store remembers across visits now
    // that this form unmounts when you leave it.
    if (editingTransactionId != null || realAccounts.length === 0) return;
    // Opened from the budget rather than an account, the sensible default is
    // the last account actually spent from — one where a category means
    // something. Falling back to whatever was saved last would land on a
    // mortgage or a tracking account, which take no category at all.
    const spendable = realAccounts.filter((a) =>
      isSpendingAccountType(a.account.type),
    );
    const lastSpendable = spendable.some((a) => a.account.id === lastAccountId)
      ? lastAccountId
      : null;
    setAccountId(
      (prev) =>
        presetAccountId ??
        prev ??
        lastSpendable ??
        spendable[0]?.account.id ??
        realAccounts[0].account.id,
    );
  }, [editingTransactionId, presetAccountId, realAccounts, lastAccountId]);

  // Money entered on a loan account's own page is a payment against it, so
  // it comes in (debt down) — the outflow default belongs to the account
  // paying, not the one being paid. A default, not a lock: the toggle still
  // wins, and this only re-fires when the account itself changes.
  useEffect(() => {
    if (isEditing || !isLoanAccount) return;
    setDirection('in');
  }, [isEditing, isLoanAccount]);

  // The "repeating" toggle lives in the header rather than costing the form
  // a whole row of its own. Hidden on an inflow: money coming in is logged
  // after the fact, not set up in advance like a recurring bill.
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
    if (!enteredCents || accountId == null) {
      navigation.goBack();
      return;
    }
    const signedCents = enteredCents * (direction === 'out' ? -1 : 1);
    const db = await getDb();
    // Defense in depth — the field is already hidden where a category means
    // nothing, but never let a stale categoryId slip through after the
    // account or the direction changed under it.
    const categoryIdToSave =
      takesCategory && direction === 'out' ? categoryId : null;
    // Whatever the row already names on the other side, unchanged — see
    // payeeReadOnly.
    const payeeToSave = payee;
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
      });
    } else {
      const input = {
        accountId,
        categoryId: categoryIdToSave,
        payeeName: payeeToSave,
        memo: memo || null,
        amountCents: signedCents,
        date,
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
    // Only remember somewhere you'd spend from — paying a mortgage or logging
    // a tracking entry shouldn't become the next spend's default.
    if (selectedAccount != null && isSpendingAccountType(selectedAccount.type))
      rememberAccounts(accountId);
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
          await transactionsRepo.deleteTransactions(db, boardId, [
            editingTransactionId,
          ]);
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
          // The home indicator sits over the last few points of the screen,
          // and Delete is the last thing on the page — the inset alone left
          // its text running under the bar.
          { paddingBottom: insets.bottom + spacing.lg },
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
            <FieldCard grow>
              {payeeReadOnly ? (
                <FieldRow label={t('common.payee')} value={payee} />
              ) : (
                <SearchableDropdownField
                  compact
                  row
                  label={t('common.payee')}
                  valueLabel={payee}
                  placeholder={t(
                    isLoanAccount
                      ? 'spend.paidFromPlaceholder'
                      : 'spend.payeePlaceholder',
                  )}
                  searchPlaceholder={t('spend.payeeSearchPlaceholder')}
                  options={payeeOptions.map((p) => ({
                    id: p.id,
                    label: p.name,
                    badge:
                      p.linkedAccountId != null
                        ? t('payeePicker.accountBadge')
                        : undefined,
                  }))}
                  onSelect={(o) => selectPayee(o.label, o.id)}
                  onUseText={isLoanAccount ? () => {} : setPayee}
                />
              )}
              {/* An inflow's source is its payee, so it needs no category and
                  no second field naming where it came from. */}
              {direction === 'in' || !takesCategory ? null : (
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
                <FieldRow
                  label={t('common.account')}
                  value={selectedAccount?.name ?? ''}
                />
              ) : (
                <DropdownField
                  compact
                  row
                  label={t('common.account')}
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
              )}
              <DateField
                row
                label={dateLabel}
                value={date}
                onChange={setDate}
              />
              {/* Multiline: return inserts a newline instead of closing the
                  keyboard, and the text starts at the top of the row rather
                  than floating in the middle of it. Dismissal is by tapping
                  off it or dragging the form. */}
              <TextInput
                style={styles.memoRow}
                placeholder={t('spend.memoPlaceholder')}
                value={memo}
                onChangeText={setMemo}
                placeholderTextColor={colors.textMuted}
                keyboardAppearance="dark"
                multiline
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
  // Grows into leftover space but never shrinks below its content — same as
  // FieldCard's `grow`: an unfolded picker pushes the pad past the bottom of
  // the screen and the page scrolls to it.
  form: { flexGrow: 1, flexShrink: 0, padding: spacing.md, gap: spacing.md },
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
  // The card's last row, typed into in place — no box of its own. It takes
  // the leftover height so the pad below it doesn't move between accounts
  // (see FieldCard's `grow`).
  memoRow: {
    flex: 1,
    minHeight: 58,
    textAlignVertical: 'top',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  deleteButtonText: { color: colors.negative, fontWeight: '700' },
});
