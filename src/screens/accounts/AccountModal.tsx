import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { DateField } from '../../components/ui/DateField';
import { DropdownField, DropdownOption } from '../../components/ui/DropdownField';
import { RateChangeModal } from '../../components/ui/RateChangeModal';
import type { RateChangeValue } from '../../components/ui/RateChangeModal';
import { IncomeDetailModal } from '../../components/ui/IncomeDetailModal';
import type { IncomeDetailValue } from '../../components/ui/IncomeDetailModal';
import { AmortizationCalculator } from '../../components/ui/AmortizationCalculator';
import { getDb } from '../../db/client';
import * as accountsRepo from '../../db/repositories/accountsRepo';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import * as accountRateHistoryRepo from '../../db/repositories/accountRateHistoryRepo';
import * as accountValueHistoryRepo from '../../db/repositories/accountValueHistoryRepo';
import * as incomeDetailHistoryRepo from '../../db/repositories/incomeDetailHistoryRepo';
import { useAccounts } from '../../hooks/useAccounts';
import { useAccountRateHistory } from '../../hooks/useAccountRateHistory';
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
import type { Account, AccountRateChange, AccountType, IncomeDetail } from '../../domain/types';

const TYPE_LABEL_KEY: Record<AccountType, TranslationKey> = {
  income: 'accountModal.typeIncome',
  cash: 'accountModal.typeCash',
  savings: 'accountModal.typeSavings',
  tracking: 'accountModal.typeTracking',
  asset: 'accountModal.typeAsset',
  loan: 'accountModal.typeLoan',
  mortgage: 'accountModal.typeMortgage',
  credit_card: 'accountModal.typeCreditCard',
};
const TYPE_VALUES: AccountType[] = ['income', 'cash', 'savings', 'tracking', 'asset', 'loan', 'mortgage', 'credit_card'];

const parseCents = (text: string): number | null => {
  const value = parseFloat(text);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
};

// Same "one sheet, create or edit" pattern as the transaction modal —
// "+ Add Account" used to push a full-screen form; this matches it.
export function AccountModal() {
  const t = useT();
  const TYPE_OPTIONS: { value: AccountType; label: string }[] = TYPE_VALUES.map((value) => ({ value, label: t(TYPE_LABEL_KEY[value]) }));
  const { open: isOpen, editingAccountId } = useAppStore((s) => s.accountModal);
  const close = useAppStore((s) => s.closeAccountModal);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const { accounts } = useAccounts();
  const { history: rateHistory, currentRateBps } = useAccountRateHistory(editingAccountId);
  const isEditing = editingAccountId != null;

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [latestBalance, setLatestBalance] = useState('0');
  const [loadedBalanceCents, setLoadedBalanceCents] = useState(0);
  const [initialInterestRate, setInitialInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [originalPrincipal, setOriginalPrincipal] = useState('');
  const [originalHousePrice, setOriginalHousePrice] = useState('');
  // A brand-new loan's starting balance IS what was borrowed, negated — so
  // auto-fill it rather than make the same number get typed twice. Stops
  // the moment the field is edited by hand: someone adding a loan they had
  // already been paying owes less now than they borrowed.
  const [openingBalanceEdited, setOpeningBalanceEdited] = useState(false);
  const [originationDate, setOriginationDate] = useState(currentDateISO());
  const [note, setNote] = useState('');
  const [archivedAt, setArchivedAt] = useState<Account['archivedAt']>(null);
  const [rateModal, setRateModal] = useState<{ editing: AccountRateChange | null } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [incomeHistory, setIncomeHistory] = useState<IncomeDetail[]>([]);
  const [incomeDetailModal, setIncomeDetailModal] = useState<{ editing: IncomeDetail | null } | null>(null);

  const reset = () => {
    setName('');
    setType('cash');
    setOpeningBalance('0');
    setLatestBalance('0');
    setLoadedBalanceCents(0);
    setInitialInterestRate('');
    setTermMonths('');
    setOriginalPrincipal('');
    setOriginalHousePrice('');
    setOpeningBalanceEdited(false);
    setOriginationDate(currentDateISO());
    setNote('');
    setArchivedAt(null);
    setRateModal(null);
    setToolsOpen(false);
    setIncomeHistory([]);
    setIncomeDetailModal(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (editingAccountId == null) return;
    (async () => {
      const db = await getDb();
      const account = await accountsRepo.getAccount(db, editingAccountId);
      if (!account) return;
      const balanceCents = accounts.find((a) => a.account.id === editingAccountId)?.balanceCents ?? account.openingBalanceCents;
      setName(account.name);
      setType(account.type);
      setOpeningBalance((account.openingBalanceCents / 100).toString());
      setLatestBalance((balanceCents / 100).toString());
      setLoadedBalanceCents(balanceCents);
      setTermMonths(account.termMonths != null ? String(account.termMonths) : '');
      setOriginalPrincipal(account.originalPrincipalCents != null ? (account.originalPrincipalCents / 100).toString() : '');
      setOriginalHousePrice(account.originalHousePriceCents != null ? (account.originalHousePriceCents / 100).toString() : '');
      setOriginationDate(account.originationDate ?? currentDateISO());
      setNote(account.note ?? '');
      setArchivedAt(account.archivedAt);
      setIncomeHistory(await incomeDetailHistoryRepo.listHistory(db, editingAccountId));
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

  const editOpeningBalance = (text: string) => {
    setOpeningBalanceEdited(true);
    setOpeningBalance(text);
  };

  const editAmountBorrowed = (text: string) => {
    setOriginalPrincipal(text);
    if (isEditing || openingBalanceEdited) return;
    const cents = parseCents(text);
    setOpeningBalance(cents == null ? '' : String(-cents / 100));
  };
  const isIncomeType = type === 'income';

  const refreshIncomeHistory = async () => {
    if (editingAccountId == null) return;
    const db = await getDb();
    setIncomeHistory(await incomeDetailHistoryRepo.listHistory(db, editingAccountId));
  };

  const submitIncomeDetail = async (value: IncomeDetailValue) => {
    if (editingAccountId == null) return;
    const db = await getDb();
    const input = {
      amountCents: Math.round((parseFloat(value.amount) || 0) * 100),
      unit: value.unit,
      effectiveDate: value.effectiveDate,
      note: value.note || null,
    };
    if (incomeDetailModal?.editing) await incomeDetailHistoryRepo.updateDetail(db, incomeDetailModal.editing.id, input);
    else await incomeDetailHistoryRepo.addDetail(db, editingAccountId, input);
    await refreshIncomeHistory();
    setIncomeDetailModal(null);
  };

  const deleteIncomeDetail = async () => {
    if (!incomeDetailModal?.editing) return;
    const db = await getDb();
    await incomeDetailHistoryRepo.deleteDetail(db, incomeDetailModal.editing.id);
    await refreshIncomeHistory();
    setIncomeDetailModal(null);
  };

  const housePriceCents = parseCents(originalHousePrice);
  const borrowedCents = parseCents(originalPrincipal);
  const downPaymentCents = housePriceCents != null && borrowedCents != null ? housePriceCents - borrowedCents : null;
  const downPaymentPercent = downPaymentCents != null && housePriceCents ? ((downPaymentCents / housePriceCents) * 100).toFixed(1) : null;

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

  const save = async () => {
    if (!name.trim()) {
      cancel();
      return;
    }
    const db = await getDb();
    const typedOpeningCents = parseCents(openingBalance) ?? 0;
    const input = {
      name: name.trim(),
      type,
      // A loan is money owed — stored negative, so the accounts list and Net
      // Worth read it as debt rather than as something you own. The field
      // auto-fills negated from the amount borrowed, but a hand-typed
      // positive number is the obvious mistake to absorb here.
      openingBalanceCents: isLoanLike ? -Math.abs(typedOpeningCents) : typedOpeningCents,
      termMonths: isLoanLike && termMonths ? Math.round(parseFloat(termMonths)) : null,
      originalPrincipalCents: isLoanLike && originalPrincipal ? Math.round(parseFloat(originalPrincipal) * 100) : null,
      originationDate: isLoanLike ? originationDate : null,
      originalHousePriceCents: isLoanLike && originalHousePrice ? Math.round(parseFloat(originalHousePrice) * 100) : null,
      note: note.trim() || null,
    };
    if (editingAccountId != null) {
      await accountsRepo.updateAccount(db, boardId, editingAccountId, input);
      // Tracking/asset accounts don't have a "Latest Balance" correction
      // field — their balance is driven by the value log (see
      // TrackingValueDetails), not by a correction transaction.
      if (!usesLoggedValue(type)) {
        const actualBalanceCents = Math.round(parseFloat(latestBalance || '0') * 100);
        const deltaCents = computeBalanceCorrectionCents(loadedBalanceCents, actualBalanceCents);
        if (deltaCents !== 0) await transactionsRepo.correctBalance(db, boardId, editingAccountId, deltaCents);
      }
    } else {
      const id = await accountsRepo.createAccount(db, boardId, { ...input, interestRateBps: initialInterestRate ? Math.round(parseFloat(initialInterestRate) * 100) : null });
      if (initialInterestRate) {
        await accountRateHistoryRepo.addRateChange(db, id, Math.round(parseFloat(initialInterestRate) * 100), originationDate);
      }
      if (type === 'mortgage' && originalHousePrice) {
        await accountValueHistoryRepo.addValueChange(db, id, Math.round(parseFloat(originalHousePrice) * 100), originationDate);
      }
    }
    bumpDataVersion();
    close();
    reset();
  };

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

  const submitRateChange = async (value: RateChangeValue) => {
    if (editingAccountId == null) return;
    const rateBps = Math.round(parseFloat(value.ratePercent) * 100);
    const db = await getDb();
    if (rateModal?.editing) await accountRateHistoryRepo.updateRateChange(db, rateModal.editing.id, rateBps, value.effectiveDate);
    else await accountRateHistoryRepo.addRateChange(db, editingAccountId, rateBps, value.effectiveDate);
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
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancel}>
      <ScreenContainer modal>
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={cancel}>
              <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={styles.title}>{isEditing ? t('accountModal.editTitle') : t('accountModal.newTitle')}</Text>
            <Pressable onPress={save}>
              <Text style={[styles.headerBtn, styles.saveBtn]}>{t('common.save')}</Text>
            </Pressable>
          </View>
          <TextField label={t('accountModal.nameLabel')} value={name} onChangeText={setName} placeholder={t('accountModal.namePlaceholder')} />
          <DropdownField compact label={t('accountModal.typeLabel')} valueLabel={TYPE_OPTIONS.find((o) => o.value === type)?.label ?? ''}>
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
          <TextField
            label={t(isLoanLike ? 'accountModal.openingBalanceLoanLabel' : 'accountModal.openingBalanceLabel')}
            value={openingBalance}
            onChangeText={editOpeningBalance}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
            hint={t(isLoanLike ? 'accountModal.openingBalanceLoanHint' : 'accountModal.openingBalanceHint')}
          />
          {isEditing && !usesLoggedValue(type) ? (
            <TextField
              label={t('accountModal.latestBalanceLabel')}
              value={latestBalance}
              onChangeText={setLatestBalance}
              keyboardType="decimal-pad"
              placeholder={t('common.amountPlaceholder')}
              hint={t('accountModal.latestBalanceHint')}
            />
          ) : null}
          <Text style={styles.sectionLabel}>{t('accountModal.interestRateHeading')}</Text>
          {isEditing ? (
            <View style={styles.field}>
              <Text style={styles.label}>{t('accountModal.interestRateHistoryLabel')}</Text>
              {rateHistory.length === 0 ? <Text style={styles.hint}>{t('accountModal.noRateRecorded')}</Text> : null}
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
                  <Text style={styles.rateRowText}>{(r.rateBps / 100).toFixed(2)}%</Text>
                  <Text style={styles.rateRowDate}>{t('common.effectivePrefix', { date: r.effectiveDate })}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.addRateBtn} onPress={() => setRateModal({ editing: null })}>
                <Text style={styles.addRateBtnText}>{t('accountModal.addRateChange')}</Text>
              </Pressable>
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
          {isLoanLike ? (
            <>
              <Text style={styles.sectionLabel}>{t('accountModal.loanTermsHeading')}</Text>
              <TextField
                label={t('common.termMonthsLabel')}
                value={termMonths}
                onChangeText={setTermMonths}
                keyboardType="number-pad"
                placeholder={t('accountModal.termMonthsPlaceholder')}
                hint={t('accountModal.termMonthsHint')}
              />
              {isMortgage ? (
                <TextField
                  label={t('accountModal.originalHousePriceLabel')}
                  value={originalHousePrice}
                  onChangeText={setOriginalHousePrice}
                  keyboardType="decimal-pad"
                  placeholder={t('accountModal.originalHousePricePlaceholder')}
                  hint={t('accountModal.originalHousePriceHint')}
                />
              ) : null}
              <TextField
                label={isMortgage ? t('accountModal.mortgageAmountLabel') : t('accountModal.originalPrincipalLabel')}
                value={originalPrincipal}
                onChangeText={editAmountBorrowed}
                keyboardType="decimal-pad"
                placeholder={t('common.amountPlaceholder')}
                hint={t('accountModal.originalPrincipalHint')}
              />
              {isMortgage ? (
                <View style={styles.computedRow}>
                  <Text style={styles.label}>{t('accountModal.downPaymentLabel')}</Text>
                  {downPaymentCents == null ? (
                    <Text style={styles.hint}>{t('accountModal.downPaymentPending')}</Text>
                  ) : downPaymentCents < 0 ? (
                    <Text style={styles.computedWarning}>{t('accountModal.principalExceedsHint')}</Text>
                  ) : (
                    <Text style={styles.computedValue}>
                      {t('accountModal.downPaymentValue', { amount: formatMoney(downPaymentCents), percent: downPaymentPercent ?? '' })}
                    </Text>
                  )}
                </View>
              ) : null}
              <DateField label={t('accountModal.originationDateLabel')} value={originationDate} onChange={setOriginationDate} />
            </>
          ) : null}
          <TextField
            label={t('accountModal.noteLabel')}
            value={note}
            onChangeText={setNote}
            placeholder={t('accountModal.notePlaceholder')}
            multiline
            style={styles.noteInput}
          />
          {isEditing && isIncomeType ? (
            <View style={styles.field}>
              <Text style={styles.sectionLabel}>{t('accountModal.incomeDetailsHeading')}</Text>
              <Text style={styles.hint}>{t('accountModal.incomeDetailsHint')}</Text>
              {incomeHistory.length === 0 ? <Text style={styles.hint}>{t('accountModal.noIncomeDetails')}</Text> : null}
              {incomeHistory.map((detail) => (
                <Pressable key={detail.id} style={styles.rateRow} onPress={() => setIncomeDetailModal({ editing: detail })}>
                  <Text style={styles.rateRowText}>
                    {formatMoney(detail.amountCents)}
                    {t(`incomeDetailModal.unit${detail.unit.charAt(0).toUpperCase()}${detail.unit.slice(1)}` as TranslationKey)}
                  </Text>
                  <Text style={styles.rateRowDate}>{t('common.effectivePrefix', { date: detail.effectiveDate })}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.addRateBtn} onPress={() => setIncomeDetailModal({ editing: null })}>
                <Text style={styles.addRateBtnText}>{t('accountModal.addIncomeDetail')}</Text>
              </Pressable>
            </View>
          ) : null}
          {isEditing && isLoanLike ? (
            <View style={styles.field}>
              <Text style={styles.sectionLabel}>{t('accountModal.toolsHeading')}</Text>
              <Pressable style={styles.rateRow} onPress={() => setToolsOpen(true)}>
                <Text style={styles.rateRowText}>{t('amortizationSchedule.title')}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </View>
          ) : null}
          {isEditing ? (
            <View style={styles.dangerZone}>
              {archivedAt ? (
                <Pressable onPress={reopenAccount}>
                  <Text style={styles.reopenLink}>{t('accountModal.reopenAccount')}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={closeAccount}>
                  <Text style={styles.closeLink}>{t('accountModal.closeAccount')}</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </ScrollView>
      </ScreenContainer>
      <RateChangeModal
        visible={rateModal != null}
        initial={{
          ratePercent: rateModal?.editing ? (rateModal.editing.rateBps / 100).toString() : '',
          effectiveDate: rateModal?.editing?.effectiveDate ?? currentDateISO(),
        }}
        onCancel={() => setRateModal(null)}
        onSubmit={submitRateChange}
        onDelete={rateModal?.editing ? deleteRateChange : undefined}
      />
      <IncomeDetailModal
        visible={incomeDetailModal != null}
        initial={{
          amount: incomeDetailModal?.editing ? String(incomeDetailModal.editing.amountCents / 100) : '',
          unit: incomeDetailModal?.editing?.unit ?? 'year',
          effectiveDate: incomeDetailModal?.editing?.effectiveDate ?? currentDateISO(),
          note: incomeDetailModal?.editing?.note ?? '',
        }}
        onCancel={() => setIncomeDetailModal(null)}
        onSubmit={submitIncomeDetail}
        onDelete={incomeDetailModal?.editing ? deleteIncomeDetail : undefined}
      />
      <Modal visible={toolsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setToolsOpen(false)}>
        <ScreenContainer modal>
          <View style={styles.header}>
            <Pressable onPress={() => setToolsOpen(false)}>
              <Text style={styles.headerBtn}>{t('common.back')}</Text>
            </Pressable>
            <Text style={styles.title}>{t('amortizationSchedule.title')}</Text>
            <Text style={[styles.headerBtn, { opacity: 0 }]}>{t('common.back')}</Text>
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

const styles = StyleSheet.create({
  sheet: { padding: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.text },
  saveBtn: { color: colors.accent },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginTop: spacing.xs },
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
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  dangerZone: {
 marginTop: spacing.md, alignItems: 'center' },
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
  rateRowText: { fontSize: 15, fontWeight: '700', color: colors.text },
  rateRowDate: { fontSize: 12, color: colors.textMuted },
  addRateBtn: { alignItems: 'center', paddingVertical: 8 },
  addRateBtnText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  chevron: { color: colors.textMuted, fontSize: 15 },
});
