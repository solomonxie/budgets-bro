import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { MoneyField } from '../../components/ui/MoneyField';
import { DateField } from '../../components/ui/DateField';
import {
  DropdownField,
  DropdownGroupLabel,
  DropdownOption,
} from '../../components/ui/DropdownField';
import { RateChangeModal } from '../../components/ui/RateChangeModal';
import type { RateChangeValue } from '../../components/ui/RateChangeModal';
import { AmortizationCalculator } from '../../components/ui/AmortizationCalculator';
import { getDb } from '../../db/client';
import * as accountsRepo from '../../db/repositories/accountsRepo';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import * as accountRateHistoryRepo from '../../db/repositories/accountRateHistoryRepo';
import * as accountValueHistoryRepo from '../../db/repositories/accountValueHistoryRepo';
import { LoggedValueModal } from '../../components/ui/LoggedValueModal';
import type { LoggedValueChange } from '../../components/ui/LoggedValueModal';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useAccountRateHistory } from '../../hooks/useAccountRateHistory';
import { useAccountValueHistory } from '../../hooks/useAccountValueHistory';
import { useAppStore } from '../../state/useAppStore';
import { isLoanLikeType, usesLoggedValue } from '../../domain/accountKind';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { computeBalanceCorrectionCents } from '../../domain/register';
import { monthlyPaymentCents } from '../../finance-tools/amortization';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type {
  Account,
  AccountRateChange,
  AccountType,
  AccountValueChange,
  AccountValueKind,
  TrackingKind,
} from '../../domain/types';
import { TRACKING_KINDS } from '../../domain/types';
import { ExpandingFieldGroup } from '../../components/ui/ExpandingField';
import { GuideSection } from '../../components/ui/GuideSection';
import { InfoButton } from '../../components/ui/InfoButton';
import { ExpandingSection } from '../../components/ui/ExpandingSection';
import {
  TYPE_LABEL_KEY,
  howItWorksKey,
  trackingKindKey,
  whatItIsForKey,
} from './accountTypeGuide';
import type { ReactNode } from 'react';

// A beat after typing stops — long enough not to write on every keystroke,
// short enough that leaving the page never races the save.
const AUTO_SAVE_DELAY_MS = 800;

const TYPE_VALUES: AccountType[] = [
  'cash',
  'savings',
  'tracking',
  'asset',
  'giving',
  'loan',
  'mortgage',
  'credit_card',
];

const parseCents = (text: string): number | null => {
  const value = parseFloat(text);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
};

// Same "one sheet, create or edit" pattern as the transaction modal —
// "+ Add Account" used to push a full-screen form; this matches it.
// Every ⓘ on this form is the same shape: a title and one or two
// paragraphs from the dictionary. The fields here each carry a rule that a
// one-line hint can't hold — what an opening balance is for, why a loan has
// readings instead of a balance — and the alternative is a page of prose
// nobody reads.
function fieldInfo(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  titleKey: TranslationKey,
  ...bodyKeys: TranslationKey[]
) {
  return (
    <InfoButton
      title={t(titleKey)}
      paragraphs={bodyKeys.map((key) => t(key))}
      closeLabel={t('common.done')}
    />
  );
}

export function AccountModal() {
  const t = useT();
  const TYPE_OPTIONS: { value: AccountType; label: string }[] = TYPE_VALUES.map(
    (value) => ({ value, label: t(TYPE_LABEL_KEY[value]) }),
  );
  const { open: isOpen, editingAccountId } = useAppStore((s) => s.accountModal);
  const close = useAppStore((s) => s.closeAccountModal);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const { accounts } = useAccounts();
  const { groups, categories } = useCategories();
  const { history: rateHistory, currentRateBps } =
    useAccountRateHistory(editingAccountId);
  // Only ever the readings the user typed — an estimate between them is
  // derived on read and never written (see finance-tools/remainingPrincipal),
  // so these lists are exactly the manual history with nothing to filter out.
  const { history: houseValueHistory, refresh: refreshHouseValues } =
    useAccountValueHistory(editingAccountId, 'value');
  const { history: principalHistory, refresh: refreshPrincipals } =
    useAccountValueHistory(editingAccountId, 'principal');
  const isEditing = editingAccountId != null;

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [latestBalance, setLatestBalance] = useState('0');
  const [loadedBalanceCents, setLoadedBalanceCents] = useState(0);
  const [initialInterestRate, setInitialInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [originalPrincipal, setOriginalPrincipal] = useState('');
  const [originalHousePrice, setOriginalHousePrice] = useState('');
  const [originationDate, setOriginationDate] = useState(currentDateISO());
  const [note, setNote] = useState('');
  // A loan's two readings, edited here as plain numbers and saved as
  // account_value_history entries dated today — the same rows the account
  // page logs, so there is one way a loan's principal and a home's value get
  // recorded and no transaction is ever invented for either.
  const [currentHouseValue, setCurrentHouseValue] = useState('');
  const [currentPrincipal, setCurrentPrincipal] = useState('');
  const [loadedHouseValueCents, setLoadedHouseValueCents] = useState<
    number | null
  >(null);
  const [loadedPrincipalCents, setLoadedPrincipalCents] = useState<
    number | null
  >(null);
  const [archivedAt, setArchivedAt] = useState<Account['archivedAt']>(null);
  // Only meaningful on a tracking account; left as typed for every other
  // type so switching type back and forth doesn't quietly lose it.
  const [trackingKind, setTrackingKind] = useState<TrackingKind>('general');
  const [loanPaymentCategoryId, setLoanPaymentCategoryId] = useState<number | null>(null);
  const [rateModal, setRateModal] = useState<{
    editing: AccountRateChange | null;
  } | null>(null);
  const [readingModal, setReadingModal] = useState<{
    kind: AccountValueKind;
    editing: AccountValueChange | null;
  } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  const reset = () => {
    setName('');
    setLoanPaymentCategoryId(null);
    setType('cash');
    setLatestBalance('0');
    setLoadedBalanceCents(0);
    setInitialInterestRate('');
    setTermMonths('');
    setOriginalPrincipal('');
    setOriginalHousePrice('');
    setOriginationDate(currentDateISO());
    setNote('');
    setCurrentHouseValue('');
    setCurrentPrincipal('');
    setLoadedHouseValueCents(null);
    setLoadedPrincipalCents(null);
    setArchivedAt(null);
    setRateModal(null);
    setReadingModal(null);
    setToolsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (editingAccountId == null) return;
    (async () => {
      const db = await getDb();
      const account = await accountsRepo.getAccount(db, editingAccountId);
      if (!account) return;
      const balanceCents =
        accounts.find((a) => a.account.id === editingAccountId)?.balanceCents ??
        account.openingBalanceCents;
      setName(account.name);
      setType(account.type);
      setLatestBalance((balanceCents / 100).toString());
      setLoadedBalanceCents(balanceCents);
      setTermMonths(
        account.termMonths != null ? String(account.termMonths) : '',
      );
      setOriginalPrincipal(
        account.originalPrincipalCents != null
          ? (account.originalPrincipalCents / 100).toString()
          : '',
      );
      setOriginalHousePrice(
        account.originalHousePriceCents != null
          ? (account.originalHousePriceCents / 100).toString()
          : '',
      );
      setOriginationDate(account.originationDate ?? currentDateISO());
      setNote(account.note ?? '');
      setArchivedAt(account.archivedAt);
      setTrackingKind(account.trackingKind ?? 'general');
      setLoanPaymentCategoryId(account.loanPaymentCategoryId ?? null);
      const houseValueCents = await accountValueHistoryRepo.currentValueCents(
        db,
        editingAccountId,
        'value',
      );
      const principalCents = await accountValueHistoryRepo.currentValueCents(
        db,
        editingAccountId,
        'principal',
      );
      setLoadedHouseValueCents(houseValueCents);
      setLoadedPrincipalCents(principalCents);
      setCurrentHouseValue(
        houseValueCents != null ? (houseValueCents / 100).toString() : '',
      );
      // Nothing logged yet: the loan's own terms are what it still owes, so
      // show that rather than an empty field the user has to re-type.
      const owedCents =
        principalCents ??
        account.originalPrincipalCents ??
        -account.openingBalanceCents;
      setCurrentPrincipal(owedCents ? (owedCents / 100).toString() : '');
    })();
    // Deliberately excludes `accounts` — it refreshes on every write (dataVersion
    // bump), and re-running this would clobber in-progress edits with the DB's
    // latest saved balance instead of just seeding the field once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingAccountId]);

  const cancel = () => {
    close();
    reset();
  };

  const isLoanLike = isLoanLikeType(type);
  const isMortgage = type === 'mortgage';

  // Where a rate is a real property of the account: what savings and cash
  // earn, what a loan charges. A tracking/asset account's growth is logged as
  // value, not computed from a rate; a credit card's APR is not something
  // this app does anything with.
  const tracksInterestRate =
    type === 'cash' || type === 'savings' || isLoanLike;

  const housePriceCents = parseCents(originalHousePrice);
  const borrowedCents = parseCents(originalPrincipal);
  const downPaymentCents =
    housePriceCents != null && borrowedCents != null
      ? housePriceCents - borrowedCents
      : null;
  const downPaymentPercent =
    downPaymentCents != null && housePriceCents
      ? ((downPaymentCents / housePriceCents) * 100).toFixed(1)
      : null;

  // Tools > Amortization Schedule prefill — the account's real outstanding
  // balance (not opening balance) and current rate. `fixedPaymentCents` pins the
  // payment to whatever's currently typed in the form's own term/principal
  // fields (the "live" values being edited), not the last-saved DB record.
  const outstandingCents = Math.max(0, -loadedBalanceCents);
  const formTermMonths = termMonths ? Math.round(parseFloat(termMonths)) : null;
  const scheduledPaymentCents =
    borrowedCents != null && formTermMonths != null && currentRateBps != null
      ? monthlyPaymentCents(borrowedCents, currentRateBps, formTermMonths)
      : null;

  // Writes the form to the database. Called on a timer while editing (see
  // the auto-save effect) and again on the way out, so nothing an existing
  // account is told ever needs a Save button.
  //
  // `applyBalanceCorrection` is the one thing the timer must not do: that
  // field posts a correction *transaction* for the difference, so running it
  // per keystroke would post one for "1", then "12", then "123". It waits
  // until you leave the form and the number has stopped changing.
  const persist = async ({
    applyBalanceCorrection,
  }: {
    applyBalanceCorrection: boolean;
  }) => {
    if (!name.trim()) return;
    const db = await getDb();
    const borrowedAtSigningCents = isLoanLike
      ? parseCents(originalPrincipal)
      : null;
    const input = {
      name: name.trim(),
      type,
      // Every account starts at zero — an account's history is its
      // transactions, and a balance to "start" from is one more number to
      // keep true with no ledger row behind it. Money that was already there
      // goes in as a real transaction (or, on an existing account, via
      // Current Balance below, which posts one). A loan keeps the amount
      // borrowed here, negated, purely as the last-resort anchor for one with
      // neither a principal reading nor terms — see remainingPrincipal.
      openingBalanceCents: isLoanLike
        ? -Math.abs(borrowedAtSigningCents ?? 0)
        : 0,
      termMonths:
        isLoanLike && termMonths ? Math.round(parseFloat(termMonths)) : null,
      originalPrincipalCents: borrowedAtSigningCents,
      originationDate: isLoanLike ? originationDate : null,
      originalHousePriceCents: isLoanLike
        ? parseCents(originalHousePrice)
        : null,
      note: note.trim() || null,
      trackingKind: type === 'tracking' ? trackingKind : null,
      loanPaymentCategoryId: isLoanLike ? loanPaymentCategoryId : null,
    };
    // Each figure typed here becomes a reading dated today, and only if it
    // actually changed — re-saving the form otherwise piles up identical rows
    // in the history. `currentHouseValue` carries the 'value' reading for both
    // a mortgage's home and a tracking/asset account's worth: same column,
    // same meaning.
    // Only on the way in. Once an account exists, its readings are a log you
    // add to by hand (each with its own date), not a number the edit form
    // quietly restates as "today" every time it is saved.
    const saveReadings = async (accountId: number) => {
      const today = currentDateISO();
      if (isLoanLike) {
        const principalCents = parseCents(currentPrincipal);
        if (principalCents != null && principalCents !== loadedPrincipalCents) {
          await accountValueHistoryRepo.addValueChange(
            db,
            accountId,
            principalCents,
            today,
            null,
            'principal',
          );
        }
      }
      if (!isMortgage && !usesLoggedValue(type)) return;
      const valueCents = parseCents(currentHouseValue);
      if (valueCents != null && valueCents !== loadedHouseValueCents) {
        await accountValueHistoryRepo.addValueChange(
          db,
          accountId,
          valueCents,
          today,
          null,
          'value',
        );
      }
    };
    if (editingAccountId != null) {
      await accountsRepo.updateAccount(db, boardId, editingAccountId, input);
      // Only a plain ledger account gets the "Current Balance" correction —
      // tracking/asset run off their value log, and a loan off its principal
      // readings, neither of which wants a correction transaction.
      if (applyBalanceCorrection && !usesLoggedValue(type) && !isLoanLike) {
        const actualBalanceCents = parseCents(latestBalance) ?? 0;
        const deltaCents = computeBalanceCorrectionCents(
          loadedBalanceCents,
          actualBalanceCents,
        );
        if (deltaCents !== 0) {
          await transactionsRepo.correctBalance(
            db,
            boardId,
            editingAccountId,
            deltaCents,
          );
          // The form's idea of "what it was" moves with it, so leaving and
          // coming back can't post the same correction twice.
          setLoadedBalanceCents(actualBalanceCents);
        }
      }
      // The purchase price is the home's first value, dated when it was
      // bought. An account that predates that rule — or that only had the
      // price filled in later — has no origin for its chart to start from,
      // so put one there the first time we see both.
      if (isMortgage) {
        const purchasePriceCents = parseCents(originalHousePrice);
        if (purchasePriceCents != null && houseValueHistory.length === 0) {
          await accountValueHistoryRepo.addValueChange(
            db,
            editingAccountId,
            purchasePriceCents,
            originationDate,
            null,
            'value',
          );
        }
      }
    } else {
      const id = await accountsRepo.createAccount(db, boardId, {
        ...input,
        interestRateBps: initialInterestRate
          ? Math.round(parseFloat(initialInterestRate) * 100)
          : null,
      });
      if (initialInterestRate) {
        await accountRateHistoryRepo.addRateChange(
          db,
          id,
          Math.round(parseFloat(initialInterestRate) * 100),
          originationDate,
        );
      }
      // The purchase price is the home's value on the day it was bought — a
      // real first data point, dated then, distinct from any "what is it
      // worth now" reading the form also carries.
      const purchasePriceCents = isMortgage
        ? parseCents(originalHousePrice)
        : null;
      if (purchasePriceCents != null) {
        await accountValueHistoryRepo.addValueChange(
          db,
          id,
          purchasePriceCents,
          originationDate,
          null,
          'value',
        );
      }
      await saveReadings(id);
    }
    bumpDataVersion();
  };

  // Everything an existing account is told is saved as it is typed, a beat
  // after the typing stops. There is no Save button to forget and no Cancel
  // to lose work to — and every write goes through the change log's triggers
  // (see migration 030), so Settings > Change History can put any of it back.
  useEffect(() => {
    if (!isOpen || !isEditing || !name.trim()) return;
    const timer = setTimeout(() => {
      void persist({ applyBalanceCorrection: false });
    }, AUTO_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    isEditing,
    name,
    type,
    note,
    termMonths,
    originalPrincipal,
    originalHousePrice,
    originationDate,
  ]);

  const done = async () => {
    await persist({ applyBalanceCorrection: true });
    close();
    reset();
  };

  const readingForm = (kind: AccountValueKind) =>
    readingModal?.kind === kind ? (
      <LoggedValueModal
        inline
        visible
        title={t(readingWording.title)}
        valueLabel={t(readingWording.valueLabel)}
        notePlaceholder={t(readingWording.notePlaceholder)}
        initial={{
          value: readingModal.editing
            ? (readingModal.editing.valueCents / 100).toString()
            : '',
          effectiveDate:
            readingModal.editing?.effectiveDate ?? currentDateISO(),
          note: readingModal.editing?.note ?? '',
        }}
        onCancel={() => setReadingModal(null)}
        onSubmit={submitReading}
        onDelete={readingModal.editing ? deleteReading : undefined}
      />
    ) : undefined;

  const closeAccount = () => {
    Alert.alert(
      t('accountModal.closeAccountConfirmTitle', { name }),
      t('accountModal.closeAccountConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('accountModal.closeAccount'),
          style: 'destructive',
          onPress: async () => {
            if (editingAccountId == null) return;
            const db = await getDb();
            await accountsRepo.archiveAccount(db, editingAccountId);
            bumpDataVersion();
            close();
            reset();
          },
        },
      ],
    );
  };

  const reopenAccount = async () => {
    if (editingAccountId == null) return;
    const db = await getDb();
    await accountsRepo.reopenAccount(db, boardId, editingAccountId);
    bumpDataVersion();
    close();
    reset();
  };

  // A 'value' reading means something different per account — a home is
  // worth X, an investment totals X — so the dialog takes its wording from
  // the account, not just from the kind of reading. Heading an RRSP's dialog
  // "Home Value" is how this went wrong the first time.
  const readingWording: {
    title: TranslationKey;
    valueLabel: TranslationKey;
    notePlaceholder: TranslationKey;
  } =
    readingModal?.kind === 'principal'
      ? {
          title: 'principalModal.title',
          valueLabel: 'principalModal.valueLabel',
          notePlaceholder: 'principalModal.notePlaceholder',
        }
      : isMortgage
        ? {
            title: 'houseValueModal.title',
            valueLabel: 'houseValueModal.valueLabel',
            notePlaceholder: 'houseValueModal.notePlaceholder',
          }
        : {
            title: 'trackingValueModal.title',
            valueLabel: 'trackingValueModal.totalLabel',
            notePlaceholder: 'trackingValueModal.notePlaceholder',
          };

  const refreshReadings = async (kind: AccountValueKind) => {
    if (kind === 'principal') await refreshPrincipals();
    else await refreshHouseValues();
  };

  const submitReading = async (value: LoggedValueChange) => {
    if (editingAccountId == null || readingModal == null) return;
    const valueCents = parseCents(value.value);
    if (valueCents == null) return;
    const db = await getDb();
    const note = value.note.trim() || null;
    if (readingModal.editing) {
      await accountValueHistoryRepo.updateValueChange(
        db,
        readingModal.editing.id,
        valueCents,
        value.effectiveDate,
        note,
      );
    } else {
      await accountValueHistoryRepo.addValueChange(
        db,
        editingAccountId,
        valueCents,
        value.effectiveDate,
        note,
        readingModal.kind,
      );
    }
    bumpDataVersion();
    await refreshReadings(readingModal.kind);
    setReadingModal(null);
  };

  const deleteReading = async () => {
    if (readingModal?.editing == null) return;
    const db = await getDb();
    await accountValueHistoryRepo.deleteValueChange(
      db,
      readingModal.editing.id,
    );
    bumpDataVersion();
    await refreshReadings(readingModal.kind);
    setReadingModal(null);
  };

  const submitRateChange = async (value: RateChangeValue) => {
    if (editingAccountId == null) return;
    const rateBps = Math.round(parseFloat(value.ratePercent) * 100);
    const db = await getDb();
    const note = value.note.trim() || null;
    if (rateModal?.editing)
      await accountRateHistoryRepo.updateRateChange(
        db,
        rateModal.editing.id,
        rateBps,
        value.effectiveDate,
        note,
      );
    else
      await accountRateHistoryRepo.addRateChange(
        db,
        editingAccountId,
        rateBps,
        value.effectiveDate,
        note,
      );
    bumpDataVersion();
    setRateModal(null);
  };

  const deleteRateChange = async () => {
    if (!rateModal?.editing) return;
    const db = await getDb();
    await accountRateHistoryRepo.deleteRateChange(db, rateModal.editing.id);
    bumpDataVersion();
    setRateModal(null);
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={cancel}
    >
      <ScreenContainer modal>
        <ScrollView
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled"
          // The note sits at the bottom of a long form, so focusing it used
          // to put it straight behind the keyboard. This insets the scroll
          // by the keyboard's height and brings the focused field up with
          // it; dragging the list down dismisses it again.
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
        >
          <ExpandingFieldGroup>
            <View style={styles.header}>
              {/* Editing saves itself, so there is nothing to cancel and
                  nothing to confirm — just a way out. A new account still
                  needs both: there is no row yet to write into. */}
              {isEditing ? (
                <Text style={[styles.headerBtn, { opacity: 0 }]}>
                  {t('common.done')}
                </Text>
              ) : (
                <Pressable onPress={cancel}>
                  <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
                </Pressable>
              )}
              <Text style={styles.title}>
                {isEditing
                  ? t('accountModal.editTitle')
                  : t('accountModal.newTitle')}
              </Text>
              <Pressable onPress={done}>
                <Text style={[styles.headerBtn, styles.saveBtn]}>
                  {t(isEditing ? 'common.done' : 'common.save')}
                </Text>
              </Pressable>
            </View>
            <TextField
              label={t('accountModal.nameLabel')}
              value={name}
              onChangeText={setName}
              placeholder={t('accountModal.namePlaceholder')}
            />
            <DropdownField
              compact
              label={t('accountModal.typeLabel')}
              valueLabel={
                TYPE_OPTIONS.find((o) => o.value === type)?.label ?? ''
              }
            >
              {(closeDropdown) => (
                <>
                  {TYPE_OPTIONS.map((opt) => (
                    <DropdownOption
                      key={opt.value}
                      label={opt.label}
                      selected={type === opt.value}
                      onPress={() => {
                        setType(opt.value);
                        closeDropdown();
                      }}
                    />
                  ))}
                </>
              )}
            </DropdownField>
            {type === 'tracking' ? (
              <DropdownField
                compact
                label={t('accountModal.trackingKindLabel')}
                valueLabel={t(trackingKindKey(trackingKind))}
                info={fieldInfo(
                  t,
                  'accountInfo.trackingKindTitle',
                  'accountInfo.trackingKindBody',
                  'accountInfo.trackingKindScope',
                )}
              >
                {(closeDropdown) => (
                  <>
                    {TRACKING_KINDS.map((kind) => (
                      <DropdownOption
                        key={kind}
                        label={t(trackingKindKey(kind))}
                        selected={trackingKind === kind}
                        onPress={() => {
                          setTrackingKind(kind);
                          closeDropdown();
                        }}
                      />
                    ))}
                  </>
                )}
              </DropdownField>
            ) : null}
            {/* A loan has no ledger balance to seed: what it owes is a reading
              (latest 'principal' entry, estimated from real payments in
              between — see finance-tools/remainingPrincipal), so asking for
              an opening balance and a current balance here would be asking
              for the same number twice in the wrong units. */}
            {isLoanLike ? (
              <>
                {isMortgage ? (
                  <View style={styles.field}>
                    {isEditing ? (
                      <ReadingSummary
                        label={t('accountModal.currentHouseValueLabel')}
                        valueCents={loadedHouseValueCents}
                        info={fieldInfo(
                          t,
                          'accountInfo.houseValueTitle',
                          'accountInfo.houseValueBody',
                          'accountInfo.houseValueUse',
                        )}
                        t={t}
                      />
                    ) : (
                      <MoneyField
                        label={t('accountModal.currentHouseValueLabel')}
                        info={fieldInfo(
                          t,
                          'accountInfo.houseValueTitle',
                          'accountInfo.houseValueBody',
                          'accountInfo.houseValueUse',
                        )}
                        value={currentHouseValue}
                        onChangeText={setCurrentHouseValue}
                        placeholder={t('common.amountPlaceholder')}
                        hint={t('accountModal.currentHouseValueHint')}
                      />
                    )}
                    {isEditing ? (
                      <ReadingList
                        label={t('accountModal.houseValueHistoryLabel')}
                        info={fieldInfo(
                          t,
                          'accountInfo.houseValueTitle',
                          'accountInfo.houseValueBody',
                          'accountInfo.houseValueUse',
                        )}
                        emptyLabel={t('accountModal.noReadings')}
                        addLabel={t('accountModal.addHouseValue')}
                        readings={houseValueHistory}
                        onOpen={(editing) =>
                          setReadingModal({ kind: 'value', editing })
                        }
                        t={t}
                        form={readingForm('value')}
                      />
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.field}>
                  {isEditing ? (
                    <ReadingSummary
                      label={t('accountModal.currentPrincipalLabel')}
                      info={fieldInfo(
                        t,
                        'accountInfo.principalTitle',
                        'accountInfo.principalBody',
                        'accountInfo.principalUse',
                      )}
                      valueCents={loadedPrincipalCents}
                      t={t}
                    />
                  ) : (
                    <MoneyField
                      label={t('accountModal.currentPrincipalLabel')}
                      info={fieldInfo(
                        t,
                        'accountInfo.principalTitle',
                        'accountInfo.principalBody',
                        'accountInfo.principalUse',
                      )}
                      value={currentPrincipal}
                      onChangeText={setCurrentPrincipal}
                      placeholder={t('common.amountPlaceholder')}
                      hint={t('accountModal.currentPrincipalHint')}
                    />
                  )}
                  {isEditing ? (
                    <ReadingList
                      label={t('accountModal.principalHistoryLabel')}
                      info={fieldInfo(
                        t,
                        'accountInfo.principalTitle',
                        'accountInfo.principalBody',
                        'accountInfo.principalUse',
                      )}
                      emptyLabel={t('accountModal.noReadings')}
                      addLabel={t('accountModal.addPrincipal')}
                      readings={principalHistory}
                      onOpen={(editing) =>
                        setReadingModal({ kind: 'principal', editing })
                      }
                      t={t}
                      form={readingForm('principal')}
                    />
                  ) : null}
                </View>
              </>
            ) : usesLoggedValue(type) ? (
              <View style={styles.field}>
                {isEditing ? (
                  <ReadingSummary
                    label={t('accountModal.currentValueLabel')}
                    info={fieldInfo(
                      t,
                      'accountInfo.valueHistoryTitle',
                      'accountInfo.valueHistoryBody',
                      'accountInfo.valueHistoryUse',
                    )}
                    valueCents={loadedHouseValueCents}
                    t={t}
                  />
                ) : (
                  <MoneyField
                    label={t('accountModal.currentValueLabel')}
                    info={fieldInfo(
                      t,
                      'accountInfo.valueHistoryTitle',
                      'accountInfo.valueHistoryBody',
                      'accountInfo.valueHistoryUse',
                    )}
                    value={currentHouseValue}
                    onChangeText={setCurrentHouseValue}
                    placeholder={t('common.amountPlaceholder')}
                    hint={t('accountModal.currentValueHint')}
                  />
                )}
                {isEditing ? (
                  <ReadingList
                    label={t('accountModal.valueHistoryLabel')}
                    info={fieldInfo(
                      t,
                      'accountInfo.valueHistoryTitle',
                      'accountInfo.valueHistoryBody',
                      'accountInfo.valueHistoryUse',
                    )}
                    emptyLabel={t('accountModal.noReadings')}
                    addLabel={t('accountModal.addValue')}
                    readings={houseValueHistory}
                    onOpen={(editing) =>
                      setReadingModal({ kind: 'value', editing })
                    }
                    t={t}
                    form={readingForm('value')}
                  />
                ) : null}
              </View>
            ) : isEditing ? (
              <MoneyField
                label={t('accountModal.latestBalanceLabel')}
                info={fieldInfo(
                  t,
                  'accountInfo.latestBalanceTitle',
                  'accountInfo.latestBalanceBody',
                  'accountInfo.latestBalanceFlow',
                )}
                value={latestBalance}
                onChangeText={setLatestBalance}
                placeholder={t('common.amountPlaceholder')}
                hint={t('accountModal.latestBalanceHint')}
              />
            ) : null}
            {tracksInterestRate ? (
              <>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>
                    {t('accountModal.interestRateHeading')}
                  </Text>
                  {fieldInfo(
                    t,
                    'accountInfo.rateHistoryTitle',
                    'accountInfo.rateHistoryBody',
                    'accountInfo.rateHistoryUse',
                  )}
                </View>
                {isEditing ? (
                  <View style={styles.field}>
                    <Text style={styles.label}>
                      {t('accountModal.interestRateHistoryLabel')}
                    </Text>
                    {rateHistory.length === 0 ? (
                      <Text style={styles.hint}>
                        {t('accountModal.noRateRecorded')}
                      </Text>
                    ) : null}
                    {rateHistory.map((r) => (
                      <Pressable
                        key={r.id}
                        style={styles.rateRow}
                        onPress={() =>
                          setRateModal({
                            editing: r,
                          })
                        }
                      >
                        <View style={styles.readingLeft}>
                          <Text style={styles.rateRowText}>
                            {(r.rateBps / 100).toFixed(2)}%
                          </Text>
                          {r.note ? (
                            <Text style={styles.rateRowDate} numberOfLines={1}>
                              {r.note}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.rateRowDate}>
                          {t('common.effectivePrefix', {
                            date: r.effectiveDate,
                          })}
                        </Text>
                      </Pressable>
                    ))}
                    {rateModal != null ? (
                      <RateChangeModal
                        inline
                        visible
                        initial={{
                          ratePercent: rateModal.editing
                            ? (rateModal.editing.rateBps / 100).toString()
                            : '',
                          effectiveDate:
                            rateModal.editing?.effectiveDate ??
                            currentDateISO(),
                          note: rateModal.editing?.note ?? '',
                        }}
                        onCancel={() => setRateModal(null)}
                        onSubmit={submitRateChange}
                        onDelete={
                          rateModal.editing ? deleteRateChange : undefined
                        }
                      />
                    ) : (
                      <Pressable
                        style={styles.addRateBtn}
                        onPress={() => setRateModal({ editing: null })}
                      >
                        <Text style={styles.addRateBtnText}>
                          {t('accountModal.addRateChange')}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <TextField
                    label={t('accountModal.interestRateAnnualLabel')}
                    value={initialInterestRate}
                    onChangeText={setInitialInterestRate}
                    keyboardType="decimal-pad"
                    placeholder={t('accountModal.interestRatePlaceholder')}
                  />
                )}
              </>
            ) : null}
            {isLoanLike ? (
              <>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>
                    {t('accountModal.loanTermsHeading')}
                  </Text>
                  {fieldInfo(
                    t,
                    'accountInfo.loanTermsTitle',
                    'accountInfo.loanTermsBody',
                    'accountInfo.loanTermsBorrowed',
                  )}
                </View>
                <TextField
                  label={t('common.termMonthsLabel')}
                  value={termMonths}
                  onChangeText={setTermMonths}
                  keyboardType="number-pad"
                  placeholder={t('accountModal.termMonthsPlaceholder')}
                  hint={t('accountModal.termMonthsHint')}
                />
                {isMortgage ? (
                  <MoneyField
                    label={t('accountModal.originalHousePriceLabel')}
                    value={originalHousePrice}
                    onChangeText={setOriginalHousePrice}
                    placeholder={t(
                      'accountModal.originalHousePricePlaceholder',
                    )}
                    hint={t('accountModal.originalHousePriceHint')}
                  />
                ) : null}
                <MoneyField
                  label={
                    isMortgage
                      ? t('accountModal.mortgageAmountLabel')
                      : t('accountModal.originalPrincipalLabel')
                  }
                  value={originalPrincipal}
                  onChangeText={setOriginalPrincipal}
                  placeholder={t('common.amountPlaceholder')}
                  hint={t('accountModal.originalPrincipalHint')}
                />
                {isMortgage ? (
                  <View style={styles.computedRow}>
                    <Text style={styles.label}>
                      {t('accountModal.downPaymentLabel')}
                    </Text>
                    {downPaymentCents == null ? (
                      <Text style={styles.hint}>
                        {t('accountModal.downPaymentPending')}
                      </Text>
                    ) : downPaymentCents < 0 ? (
                      <Text style={styles.computedWarning}>
                        {t('accountModal.principalExceedsHint')}
                      </Text>
                    ) : (
                      <Text style={styles.computedValue}>
                        {t('accountModal.downPaymentValue', {
                          amount: formatMoney(downPaymentCents),
                          percent: downPaymentPercent ?? '',
                        })}
                      </Text>
                    )}
                  </View>
                ) : null}
                <DateField
                  label={t(
                    isMortgage
                      ? 'accountModal.purchaseDateLabel'
                      : 'accountModal.originationDateLabel',
                  )}
                  value={originationDate}
                  onChange={setOriginationDate}
                />
                <DropdownField
                  compact
                  label={t('common.category')}
                  valueLabel={(() => {
                    const category = categories.find((c) => c.id === loanPaymentCategoryId);
                    return category ? `${category.icon ? category.icon + ' ' : ''}${category.name}` : '';
                  })()}
                  placeholder={t('accountModal.loanPaymentCategoryPlaceholder')}
                >
                  {(close) => groups.map((group) => {
                    const options = categories.filter((c) => c.groupId === group.id && c.archivedAt == null);
                    if (!options.length) return null;
                    return <View key={group.id}>
                      <DropdownGroupLabel label={group.name} />
                      {options.map((category) => <DropdownOption
                        key={category.id}
                        label={`${category.icon ? category.icon + ' ' : ''}${category.name}`}
                        selected={loanPaymentCategoryId === category.id}
                        onPress={() => { setLoanPaymentCategoryId(category.id); close(); }}
                      />)}
                    </View>;
                  })}
                </DropdownField>
                <TextField
                  label={t('accountModal.noteLabel')}
                  value={note}
                  onChangeText={setNote}
                  placeholder={t('accountModal.notePlaceholder')}
                  multiline
                  style={styles.noteInput}
                />
              </>
            ) : null}
            {isLoanLike ? null : (
              <TextField
                label={t('accountModal.noteLabel')}
                value={note}
                onChangeText={setNote}
                placeholder={t('accountModal.notePlaceholder')}
                multiline
                style={styles.noteInput}
              />
            )}
            {/* Folded away under the note: the explanation is worth having
                on the page someone edits an account on, but it is not worth
                a screenful every time they open it. */}
            <ExpandingSection
              label={t('accountGuide.learnMore', {
                type: t(TYPE_LABEL_KEY[type]),
              })}
              summary=""
            >
              <GuideSection
                heading={t('accountGuide.howHeading')}
                body={t(howItWorksKey(type))}
              />
              <GuideSection
                heading={t('accountGuide.helpsHeading')}
                body={t(whatItIsForKey(type))}
              />
            </ExpandingSection>
            {isEditing && isLoanLike ? (
              <View style={styles.field}>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>
                    {t('accountModal.toolsHeading')}
                  </Text>
                  {fieldInfo(
                    t,
                    'accountInfo.toolsTitle',
                    'accountInfo.toolsBody',
                  )}
                </View>
                <Pressable
                  style={styles.rateRow}
                  onPress={() => setToolsOpen(true)}
                >
                  <Text style={styles.rateRowText}>
                    {t('amortizationSchedule.title')}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </View>
            ) : null}
            {isEditing ? (
              <View style={styles.dangerZone}>
                {archivedAt ? (
                  <Pressable onPress={reopenAccount}>
                    <Text style={styles.reopenLink}>
                      {t('accountModal.reopenAccount')}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={closeAccount}>
                    <Text style={styles.closeLink}>
                      {t('accountModal.closeAccount')}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </ExpandingFieldGroup>
        </ScrollView>
      </ScreenContainer>

      <Modal
        visible={toolsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setToolsOpen(false)}
      >
        <ScreenContainer modal>
          <View style={styles.header}>
            <Pressable onPress={() => setToolsOpen(false)}>
              <Text style={styles.headerBtn}>{t('common.back')}</Text>
            </Pressable>
            <Text style={styles.title}>{t('amortizationSchedule.title')}</Text>
            <Text style={[styles.headerBtn, { opacity: 0 }]}>
              {t('common.back')}
            </Text>
          </View>
          <AmortizationCalculator
            initialPrincipalCents={outstandingCents}
            initialRateBps={currentRateBps}
            initialTermMonths={formTermMonths ?? 360}
            fixedPaymentCents={scheduledPaymentCents}
          />
        </ScreenContainer>
      </Modal>
    </Modal>
  );
}

// Both of a loan's reading histories look the same — a figure, whatever note
// explains where it came from, and the date it applies to — so they share one
// list rather than two near-identical blocks of JSX.
// What the account is worth (or owes) right now, as a fact rather than a
// field. Typing over it used to silently add a reading dated today, so the
// only way to log a change was to overwrite the current one and hope the
// date was right. Changes go in through the list below this, where each one
// carries its own date and can be read back — this just states where that
// history has got to.
function ReadingSummary({
  label,
  valueCents,
  info,
  t,
}: {
  label: string;
  valueCents: number | null;
  info?: ReactNode;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {info}
      </View>
      <Text style={styles.readingSummaryValue}>
        {valueCents != null
          ? formatMoney(valueCents)
          : t('houseValueCard.notSet')}
      </Text>
      <Text style={styles.hint}>{t('accountModal.currentReadingHint')}</Text>
    </View>
  );
}

function ReadingList({
  label,
  emptyLabel,
  addLabel,
  info,
  readings,
  onOpen,
  t,
  form,
}: {
  label: string;
  emptyLabel: string;
  addLabel: string;
  info?: ReactNode;
  readings: AccountValueChange[];
  onOpen: (editing: AccountValueChange | null) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  // The add/edit form, unfolded here rather than over the page — it belongs
  // to this list, so it stands where the list's own button does.
  form?: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {info}
      </View>
      {readings.length === 0 ? (
        <Text style={styles.hint}>{emptyLabel}</Text>
      ) : null}
      {readings.map((reading) => (
        <Pressable
          key={reading.id}
          style={styles.rateRow}
          onPress={() => onOpen(reading)}
        >
          <View style={styles.readingLeft}>
            <Text style={styles.rateRowText}>
              {formatMoney(reading.valueCents)}
            </Text>
            {reading.note ? (
              <Text style={styles.rateRowDate} numberOfLines={1}>
                {reading.note}
              </Text>
            ) : null}
          </View>
          <Text style={styles.rateRowDate}>
            {t('common.effectivePrefix', { date: reading.effectiveDate })}
          </Text>
        </Pressable>
      ))}
      {form ?? (
        <Pressable style={styles.addRateBtn} onPress={() => onOpen(null)}>
          <Text style={styles.addRateBtnText}>{addLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: spacing.md, gap: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  saveBtn: { color: colors.accent },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  computedRow: {
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  computedValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  computedWarning: { fontSize: 13, fontWeight: '600', color: colors.negative },
  // Room for a few lines without scrolling inside itself — a note on
  // an account is usually a sentence or two about why it exists.
  readingSummaryValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  noteInput: { minHeight: 120, textAlignVertical: 'top' },
  dangerZone: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  closeLink: { color: colors.negative, fontWeight: '600', fontSize: 14 },
  reopenLink: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  readingLeft: { flex: 1, gap: 2 },
  rateRowText: { fontSize: 15, fontWeight: '700', color: colors.text },
  rateRowDate: { fontSize: 12, color: colors.textMuted },
  addRateBtn: { alignItems: 'center', paddingVertical: 8 },
  addRateBtnText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  chevron: { color: colors.textMuted, fontSize: 15 },
});
