import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addMonths,
  monthlyPaymentCents,
  remainingMonthsToPayoff,
  totalInterestRemainingCents,
} from '../../finance-tools/amortization';
import { remainingPrincipal } from '../../finance-tools/remainingPrincipal';
import { getDb } from '../../db/client';
import * as accountValueHistoryRepo from '../../db/repositories/accountValueHistoryRepo';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useAppStore } from '../../state/useAppStore';
import { useAccountRateHistory } from '../../hooks/useAccountRateHistory';
import { useAccountValueHistory } from '../../hooks/useAccountValueHistory';
import { LoggedValueModal } from '../../components/ui/LoggedValueModal';
import type { LoggedValueChange } from '../../components/ui/LoggedValueModal';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Account, AccountValueChange, TransactionWithLabels } from '../../domain/types';

// The loan as it actually stands, in the balance box (AccountDetailScreen) —
// one summary line, tap to expand. No what-if inputs: extra-payment
// scenarios belong to the payoff/early-repayment calculators
// (screens/finance-tools), which is also where the schedule table lives.
//
// Remaining principal is never summed from the ledger. Payments stay exactly
// what the bank statement shows — one transaction, full amount — and each is
// split interest-first at read time from the last principal reading the user
// logged (finance-tools/remainingPrincipal). Logging a new reading re-anchors
// everything after it and writes no transaction: it is a reading, not a
// correction to the ledger.
export function LoanDetailsCard({
  account,
  transactions,
}: {
  account: Account;
  transactions: TransactionWithLabels[];
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [readingModal, setReadingModal] = useState<{ editing: AccountValueChange | null } | null>(null);
  const openEditAccount = useAppStore((s) => s.openEditAccount);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const { currentRateBps } = useAccountRateHistory(account.id);
  const { history: readings, refresh: refreshReadings } = useAccountValueHistory(account.id, 'principal');

  // On a loan account a payment arrives positive — debt is stored negative,
  // so paying it down moves the balance toward zero, which is the sign
  // remainingPrincipal wants.
  const payments = useMemo(
    () => transactions.map((tx) => ({ date: tx.date, amountCents: tx.amountCents })),
    [transactions],
  );
  const principal = useMemo(
    () =>
      remainingPrincipal({
        loggedPrincipal: readings[0] ?? null,
        originalPrincipalCents: account.originalPrincipalCents,
        originationDate: account.originationDate,
        openingBalanceCents: account.openingBalanceCents,
        fallbackDate: account.createdAt.slice(0, 10),
        annualRateBps: currentRateBps,
        payments,
      }),
    [readings, account, currentRateBps, payments],
  );

  const submitReading = async (value: LoggedValueChange) => {
    const valueCents = Math.round(parseFloat(value.value) * 100);
    if (!Number.isFinite(valueCents)) return;
    const db = await getDb();
    const note = value.note.trim() || null;
    if (readingModal?.editing) {
      await accountValueHistoryRepo.updateValueChange(db, readingModal.editing.id, valueCents, value.effectiveDate, note);
    } else {
      await accountValueHistoryRepo.addValueChange(db, account.id, valueCents, value.effectiveDate, note, 'principal');
    }
    bumpDataVersion();
    refreshReadings();
    setReadingModal(null);
  };

  const deleteReading = async () => {
    if (!readingModal?.editing) return;
    const db = await getDb();
    await accountValueHistoryRepo.deleteValueChange(db, readingModal.editing.id);
    bumpDataVersion();
    refreshReadings();
    setReadingModal(null);
  };

  const readingSection = (
    <>
      <Text style={styles.hint}>
        {principal.anchorWasLogged
          ? t('loanDetailsCard.sinceReadingHint', {
              count: principal.paymentsSinceAnchor,
              amount: formatMoney(principal.anchorOwedCents),
              date: principal.anchorDate,
            })
          : t('loanDetailsCard.sinceOriginHint', { count: principal.paymentsSinceAnchor })}
      </Text>
      {!principal.splitInterest && currentRateBps == null ? (
        <Text style={styles.warnHint}>{t('loanDetailsCard.noRateHint')}</Text>
      ) : null}
      {readings.map((reading) => (
        <Pressable key={reading.id} style={styles.readingRow} onPress={() => setReadingModal({ editing: reading })}>
          <View style={styles.readingLeft}>
            <Text style={styles.readingText}>{formatMoney(reading.valueCents)}</Text>
            {reading.note ? (
              <Text style={styles.readingNote} numberOfLines={1}>
                {reading.note}
              </Text>
            ) : null}
          </View>
          <Text style={styles.readingDate}>{t('common.effectivePrefix', { date: reading.effectiveDate })}</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => setReadingModal({ editing: null })}>
        <Text style={styles.link}>{t('loanDetailsCard.updatePrincipal')}</Text>
      </Pressable>
      <LoggedValueModal
        visible={readingModal != null}
        title={t('principalModal.title')}
        valueLabel={t('principalModal.valueLabel')}
        notePlaceholder={t('principalModal.notePlaceholder')}
        initial={{
          value: readingModal?.editing ? (readingModal.editing.valueCents / 100).toString() : '',
          effectiveDate: readingModal?.editing?.effectiveDate ?? currentDateISO(),
          note: readingModal?.editing?.note ?? '',
        }}
        onCancel={() => setReadingModal(null)}
        onSubmit={submitReading}
        onDelete={readingModal?.editing ? deleteReading : undefined}
      />
    </>
  );

  // Without a rate, a term and an amount borrowed there is no payment to
  // schedule and no payoff to project — but a principal reading still works,
  // so the section stays reachable.
  const hasTerms = currentRateBps != null && account.termMonths != null && account.originalPrincipalCents != null;
  if (!hasTerms) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>{t('loanDetailsCard.label')}</Text>
        <Text style={styles.hint}>{t('loanDetailsCard.addHint')}</Text>
        <Pressable onPress={() => openEditAccount(account.id)}>
          <Text style={styles.link}>{t('loanDetailsCard.addTerms')}</Text>
        </Pressable>
        {readingSection}
      </View>
    );
  }

  const scheduledPaymentCents = monthlyPaymentCents(account.originalPrincipalCents!, currentRateBps!, account.termMonths!);
  const remainingMonths = remainingMonthsToPayoff(principal.owedCents, currentRateBps!, scheduledPaymentCents);
  const remainingInterestCents = totalInterestRemainingCents(principal.owedCents, scheduledPaymentCents, remainingMonths);
  const payoffDate = Number.isFinite(remainingMonths) ? addMonths(currentDateISO(), remainingMonths) : null;
  const lastPayment = principal.rows.filter((r) => r.amountCents > 0).at(-1) ?? null;

  return (
    <View style={styles.card}>
      <Pressable style={styles.summaryRow} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.label}>{t('loanDetailsCard.label')}</Text>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryText}>
            {t('loanDetailsCard.summary', { rate: (currentRateBps! / 100).toFixed(2), payment: formatMoney(scheduledPaymentCents) })}
          </Text>
          <Text style={styles.chevron}>{expanded ? '▾' : '›'}</Text>
        </View>
      </Pressable>
      {expanded ? (
        <>
          <Row label={t('loanDetailsCard.rateLabel')} value={`${(currentRateBps! / 100).toFixed(2)}%`} />
          <Row label={t('loanDetailsCard.scheduledPaymentLabel')} value={t('common.perMonth', { amount: formatMoney(scheduledPaymentCents) })} />
          {lastPayment ? (
            <Row
              label={t('loanDetailsCard.lastPaymentLabel', { date: lastPayment.date })}
              value={t('loanDetailsCard.splitValue', {
                interest: formatMoney(lastPayment.interestCents),
                principal: formatMoney(lastPayment.principalCents),
              })}
            />
          ) : null}
          {principal.rows.length > 0 ? (
            <Row
              label={t('loanDetailsCard.paidSinceReadingLabel')}
              value={t('loanDetailsCard.splitValue', {
                interest: formatMoney(principal.interestPaidCents),
                principal: formatMoney(principal.principalPaidCents),
              })}
            />
          ) : null}
          <Row
            label={t('loanDetailsCard.projectedPayoffLabel')}
            value={payoffDate ? t('loanDetailsCard.payoffValue', { date: payoffDate, months: remainingMonths }) : t('loanDetailsCard.paymentTooLow')}
          />
          <Row
            label={t('loanDetailsCard.remainingInterestLabel')}
            value={Number.isFinite(remainingInterestCents) ? formatMoney(remainingInterestCents) : '—'}
          />
          <Text style={styles.hint}>{t('loanDetailsCard.actualsOnlyHint')}</Text>
          {readingSection}
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
  readingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  readingLeft: { flex: 1, gap: 2 },
  readingText: { fontSize: 15, fontWeight: '700', color: colors.text },
  readingNote: { fontSize: 12, color: colors.textMuted },
  readingDate: { fontSize: 12, color: colors.textMuted },
});
