import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { DateField } from '../../components/ui/DateField';
import { DropdownField, DropdownOption } from '../../components/ui/DropdownField';
import { RateChangeModal } from '../../components/ui/RateChangeModal';
import type { RateChangeValue } from '../../components/ui/RateChangeModal';
import { getDb } from '../../db/client';
import * as accountsRepo from '../../db/repositories/accountsRepo';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import * as accountRateHistoryRepo from '../../db/repositories/accountRateHistoryRepo';
import * as accountValueHistoryRepo from '../../db/repositories/accountValueHistoryRepo';
import { useAccounts } from '../../hooks/useAccounts';
import { useAccountRateHistory } from '../../hooks/useAccountRateHistory';
import { useAppStore } from '../../state/useAppStore';
import { isLoanLikeType } from '../../domain/accountKind';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { computeBalanceCorrectionCents } from '../../domain/register';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Account, AccountRateChange, AccountType } from '../../domain/types';

const TYPE_LABEL_KEY: Record<AccountType, TranslationKey> = {
  checking: 'accountModal.typeChecking',
  savings: 'accountModal.typeSavings',
  cash: 'accountModal.typeCash',
  income: 'accountModal.typeIncome',
  credit_card: 'accountModal.typeCreditCard',
  loan: 'accountModal.typeLoan',
  mortgage: 'accountModal.typeMortgage',
  tracking: 'accountModal.typeTracking',
};
const TYPE_VALUES: AccountType[] = ['checking', 'savings', 'cash', 'income', 'credit_card', 'loan', 'mortgage', 'tracking'];

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
  const { history: rateHistory } = useAccountRateHistory(editingAccountId);
  const isEditing = editingAccountId != null;

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [latestBalance, setLatestBalance] = useState('0');
  const [loadedBalanceCents, setLoadedBalanceCents] = useState(0);
  const [initialInterestRate, setInitialInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [originalPrincipal, setOriginalPrincipal] = useState('');
  const [originalHousePrice, setOriginalHousePrice] = useState('');
  const [originationDate, setOriginationDate] = useState(currentDateISO());
  const [archivedAt, setArchivedAt] = useState<Account['archivedAt']>(null);
  const [rateModal, setRateModal] = useState<{ editing: AccountRateChange | null } | null>(null);

  const reset = () => {
    setName('');
    setType('checking');
    setOpeningBalance('0');
    setLatestBalance('0');
    setLoadedBalanceCents(0);
    setInitialInterestRate('');
    setTermMonths('');
    setOriginalPrincipal('');
    setOriginalHousePrice('');
    setOriginationDate(currentDateISO());
    setArchivedAt(null);
    setRateModal(null);
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
      setArchivedAt(account.archivedAt);
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
  const downPaymentCents =
    originalHousePrice && originalPrincipal
      ? Math.round(parseFloat(originalHousePrice) * 100) - Math.round(parseFloat(originalPrincipal) * 100)
      : null;

  const save = async () => {
    if (!name.trim()) {
      cancel();
      return;
    }
    const db = await getDb();
    const input = {
      name: name.trim(),
      type,
      openingBalanceCents: Math.round(parseFloat(openingBalance || '0') * 100),
      termMonths: isLoanLike && termMonths ? Math.round(parseFloat(termMonths)) : null,
      originalPrincipalCents: isLoanLike && originalPrincipal ? Math.round(parseFloat(originalPrincipal) * 100) : null,
      originationDate: isLoanLike ? originationDate : null,
      originalHousePriceCents: isLoanLike && originalHousePrice ? Math.round(parseFloat(originalHousePrice) * 100) : null,
    };
    if (editingAccountId != null) {
      await accountsRepo.updateAccount(db, boardId, editingAccountId, input);
      const actualBalanceCents = Math.round(parseFloat(latestBalance || '0') * 100);
      const deltaCents = computeBalanceCorrectionCents(loadedBalanceCents, actualBalanceCents);
      if (deltaCents !== 0) await transactionsRepo.correctBalance(db, boardId, editingAccountId, deltaCents);
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
            label={t('accountModal.openingBalanceLabel')}
            value={openingBalance}
            onChangeText={setOpeningBalance}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
          />
          {isEditing ? (
            <TextField
              label={t('accountModal.latestBalanceLabel')}
              value={latestBalance}
              onChangeText={setLatestBalance}
              keyboardType="decimal-pad"
              placeholder={t('common.amountPlaceholder')}
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
              />
              <TextField
                label={t('accountModal.originalPrincipalLabel')}
                value={originalPrincipal}
                onChangeText={setOriginalPrincipal}
                keyboardType="decimal-pad"
                placeholder={t('common.amountPlaceholder')}
              />
              <View style={styles.field}>
                <TextField
                  label={t('accountModal.originalHousePriceLabel')}
                  value={originalHousePrice}
                  onChangeText={setOriginalHousePrice}
                  keyboardType="decimal-pad"
                  placeholder={t('accountModal.originalHousePricePlaceholder')}
                />
                {downPaymentCents != null ? (
                  <Text style={styles.hint}>
                    {downPaymentCents >= 0
                      ? t('accountModal.downPaymentHint', { amount: formatMoney(downPaymentCents) })
                      : t('accountModal.principalExceedsHint')}
                  </Text>
                ) : null}
              </View>
              <DateField label={t('accountModal.originationDateLabel')} value={originationDate} onChange={setOriginationDate} />
            </>
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
  dangerZone: { marginTop: spacing.md, alignItems: 'center' },
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
});
