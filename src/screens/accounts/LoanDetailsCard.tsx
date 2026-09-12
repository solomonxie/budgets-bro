import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addMonths,
  monthlyPaymentCents,
  remainingMonthsToPayoff,
  totalInterestRemainingCents,
} from '../../finance-tools/amortization';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useAppStore } from '../../state/useAppStore';
import { useAccountRateHistory } from '../../hooks/useAccountRateHistory';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Account } from '../../domain/types';

// Full-context amortization projection for a loan/mortgage account: its
// stored terms plus the ledger's *actual* current balance, so extra
// payments already made show up as a shorter projected payoff. Rate comes
// from the account's rate history (its latest entry), not a static column
// — see accountRateHistoryRepo. Collapsed to one summary line by default —
// tap to expand, so it doesn't push the transaction list off screen.
export function LoanDetailsCard({ account, balanceCents }: { account: Account; balanceCents: number }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const openEditAccount = useAppStore((s) => s.openEditAccount);
  const { currentRateBps } = useAccountRateHistory(account.id);

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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textMuted },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  link: { color: colors.accent, fontWeight: '600', fontSize: 13, marginTop: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  summaryText: { fontSize: 13, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 14, color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13, fontWeight: '700', color: colors.text },
});
