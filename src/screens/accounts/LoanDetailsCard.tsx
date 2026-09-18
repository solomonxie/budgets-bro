import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addMonths,
  monthlyPaymentCents,
  remainingMonthsToPayoff,
  totalInterestRemainingCents,
} from '../../finance-tools/amortization';
import { splitActualPayments } from '../../finance-tools/paymentSplit';
import { getDb } from '../../db/client';
import * as transactionsRepo from '../../db/repositories/transactionsRepo';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { computeBalanceCorrectionCents } from '../../domain/register';
import { useAppStore } from '../../state/useAppStore';
import { useAccountRateHistory } from '../../hooks/useAccountRateHistory';
import { TextField } from '../../components/ui/TextField';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Account, TransactionWithLabels } from '../../domain/types';

// Amortization projection for a loan/mortgage account: its stored terms
// plus the ledger's *actual* current balance, so extra payments already
// made show up as a shorter projected payoff. Rate comes from the account's
// rate history (its latest entry), not a static column — see
// accountRateHistoryRepo. Renders as a section of the balance box
// (AccountDetailScreen) below the balance number — one summary line by
// default, tap to expand.
//
// No what-if inputs: everything here describes the loan as it actually is.
// What-if extra payments belong to the payoff/early-repayment calculators
// (screens/finance-tools), which is also where the schedule table lives.
// The one field that does exist writes a fact, not a hypothetical — the
// balance the lender says you owe, saved as one adjustment transaction.
//
// Two balances are deliberately shown when they disagree: the ledger's
// (opening + every transaction) and the one derived by splitting each real
// payment into interest and principal (finance-tools/paymentSplit). They
// drift when a whole payment was logged against the loan instead of just
// its principal share, and naming the gap is what lets the user fix it.
export function LoanDetailsCard({
  account,
  balanceCents,
  transactions,
}: {
  account: Account;
  balanceCents: number;
  transactions: TransactionWithLabels[];
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [statementOwed, setStatementOwed] = useState('');
  const openEditAccount = useAppStore((s) => s.openEditAccount);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const { currentRateBps } = useAccountRateHistory(account.id);

  // Every real transaction on the loan account, split interest-first. On a
  // loan account a payment arrives positive (debt is stored negative, so
  // paying it down moves the balance toward zero) — exactly the sign
  // splitActualPayments wants.
  const split = useMemo(() => {
    if (currentRateBps == null) return null;
    return splitActualPayments({
      openingOwedCents: -account.openingBalanceCents,
      annualRateBps: currentRateBps,
      startDate: account.originationDate ?? currentDateISO(),
      payments: transactions.map((tx) => ({ date: tx.date, amountCents: tx.amountCents })),
    });
  }, [currentRateBps, account.openingBalanceCents, account.originationDate, transactions]);

  if (currentRateBps == null || account.termMonths == null || account.originalPrincipalCents == null) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>{t('loanDetailsCard.label')}</Text>
        <Text style={styles.hint}>{t('loanDetailsCard.addHint')}</Text>
        <Pressable onPress={() => openEditAccount(account.id)}>
          <Text style={styles.link}>{t('loanDetailsCard.addTerms')}</Text>
        </Pressable>
      </View>
    );
  }

  const outstandingCents = Math.max(0, -balanceCents);
  const scheduledPaymentCents = monthlyPaymentCents(account.originalPrincipalCents, currentRateBps, account.termMonths);
  const remainingMonths = remainingMonthsToPayoff(outstandingCents, currentRateBps, scheduledPaymentCents);
  const remainingInterestCents = totalInterestRemainingCents(outstandingCents, scheduledPaymentCents, remainingMonths);
  const payoffDate = Number.isFinite(remainingMonths) ? addMonths(currentDateISO(), remainingMonths) : null;

  const lastPayment = split?.rows.filter((r) => r.amountCents > 0).at(-1) ?? null;
  // Worth surfacing only once it is more than rounding — a cent or two of
  // drift is the split's own rounding, not a mis-logged payment.
  const derivedOwedCents = split?.owedCents ?? null;
  const ledgerOwedCents = outstandingCents;
  const owedGapCents = derivedOwedCents != null ? derivedOwedCents - ledgerOwedCents : 0;
  const showsOwedGap = Math.abs(owedGapCents) > 100;

  const statementOwedCents = (() => {
    const value = parseFloat(statementOwed);
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  })();
  // Debts are stored negative, so what the statement says you owe is the
  // negated target balance.
  const adjustmentCents =
    statementOwedCents == null ? null : computeBalanceCorrectionCents(balanceCents, -statementOwedCents);

  const saveStatementBalance = async () => {
    if (adjustmentCents == null || adjustmentCents === 0) return;
    const db = await getDb();
    await transactionsRepo.correctBalance(db, boardId, account.id, adjustmentCents);
    bumpDataVersion();
    setStatementOwed('');
  };

  return (
    <View style={styles.card}>
      <Pressable style={styles.summaryRow} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.label}>{t('loanDetailsCard.label')}</Text>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryText}>
            {t('loanDetailsCard.summary', { rate: (currentRateBps / 100).toFixed(2), payment: formatMoney(scheduledPaymentCents) })}
          </Text>
          <Text style={styles.chevron}>{expanded ? '▾' : '›'}</Text>
        </View>
      </Pressable>
      {expanded ? (
        <>
          <Row label={t('loanDetailsCard.rateLabel')} value={`${(currentRateBps / 100).toFixed(2)}%`} />
          <Row label={t('loanDetailsCard.scheduledPaymentLabel')} value={t('common.perMonth', { amount: formatMoney(scheduledPaymentCents) })} />
          <Row
            label={t('loanDetailsCard.projectedPayoffLabel')}
            value={payoffDate ? t('loanDetailsCard.payoffValue', { date: payoffDate, months: remainingMonths }) : t('loanDetailsCard.paymentTooLow')}
          />
          <Row
            label={t('loanDetailsCard.remainingInterestLabel')}
            value={Number.isFinite(remainingInterestCents) ? formatMoney(remainingInterestCents) : '—'}
          />
          {lastPayment ? (
            <Row
              label={t('loanDetailsCard.lastPaymentLabel', { date: lastPayment.date })}
              value={t('loanDetailsCard.splitValue', {
                interest: formatMoney(lastPayment.interestCents),
                principal: formatMoney(lastPayment.principalCents),
              })}
            />
          ) : null}
          {split && split.rows.length > 0 ? (
            <Row
              label={t('loanDetailsCard.paidToDateLabel')}
              value={t('loanDetailsCard.splitValue', {
                interest: formatMoney(split.interestPaidCents),
                principal: formatMoney(split.principalPaidCents),
              })}
            />
          ) : null}
          {showsOwedGap && derivedOwedCents != null ? (
            <>
              <Row label={t('loanDetailsCard.derivedOwedLabel')} value={formatMoney(derivedOwedCents)} />
              <Text style={styles.warnHint}>
                {t('loanDetailsCard.owedGapHint', { amount: formatMoney(Math.abs(owedGapCents)) })}
              </Text>
            </>
          ) : null}
          <Text style={styles.hint}>{t('loanDetailsCard.actualsOnlyHint')}</Text>
          <TextField
            label={t('loanDetailsCard.statementOwedLabel')}
            value={statementOwed}
            onChangeText={setStatementOwed}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
            hint={t('loanDetailsCard.statementOwedHint')}
          />
          {adjustmentCents != null && adjustmentCents !== 0 ? (
            <Pressable onPress={saveStatementBalance}>
              <Text style={styles.link}>
                {t('loanDetailsCard.saveAdjustment', { amount: formatMoney(adjustmentCents) })}
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => openEditAccount(account.id)}>
            <Text style={styles.link}>{t('loanDetailsCard.editTerms')}</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  warnHint: { fontSize: 12, color: colors.negative, lineHeight: 16 },
  link: { color: colors.accent, fontWeight: '600', fontSize: 13, marginTop: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  summaryText: { fontSize: 13, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 14, color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13, fontWeight: '700', color: colors.text },
});
