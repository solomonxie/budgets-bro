import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { TextField } from './TextField';
import {
  addMonths,
  buildAmortizationSchedule,
  monthlyPaymentCents,
  remainingMonthsToPayoff,
  totalInterestRemainingCents,
} from '../../finance-tools/amortization';
import type { AmortizationPaymentRow } from '../../finance-tools/amortization';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface AmortizationCalculatorProps {
  initialPrincipalCents?: number;
  initialRateBps?: number | null;
  initialTermMonths?: number;
  // Set only for a real loan/mortgage account with known origination terms
  // — its actual contractual payment is fixed by those, not recomputed
  // from whatever the principal/rate/term fields say (editing them still
  // previews the schedule against a different starting balance/rate).
  // Omit for a plain ad-hoc "what if" calculator, where the payment is
  // always derived fresh from the three fields.
  fixedPaymentCents?: number | null;
}

// Shared by the per-account amortization schedule (AmortizationScheduleScreen)
// and the standalone Calculators tool (CalculatorsHomeScreen) — same
// inputs/result/schedule-table shape either way, see `fixedPaymentCents`
// above for the one real difference between the two callers.
export function AmortizationCalculator({
  initialPrincipalCents = 0,
  initialRateBps = null,
  initialTermMonths = 360,
  fixedPaymentCents = null,
}: AmortizationCalculatorProps) {
  const t = useT();
  const [principal, setPrincipal] = useState(String(initialPrincipalCents / 100 || 0));
  const [rate, setRate] = useState(initialRateBps != null ? String(initialRateBps / 100) : '');
  const [termMonths, setTermMonths] = useState(String(initialTermMonths));
  const [extraPayment, setExtraPayment] = useState('');

  const result = useMemo(() => {
    const principalCents = Math.round((parseFloat(principal) || 0) * 100);
    const rateBps = Math.round((parseFloat(rate) || 0) * 100);
    const months = Math.round(parseFloat(termMonths) || 0);
    const extraCents = Math.round((parseFloat(extraPayment) || 0) * 100);
    if (principalCents <= 0 || months <= 0) return null;
    const basePaymentCents = fixedPaymentCents ?? monthlyPaymentCents(principalCents, rateBps, months);
    const paymentCents = basePaymentCents + extraCents;
    const payoffMonths = remainingMonthsToPayoff(principalCents, rateBps, paymentCents);
    const totalInterestCents = totalInterestRemainingCents(principalCents, paymentCents, payoffMonths);
    const payoffDate = Number.isFinite(payoffMonths) ? addMonths(currentDateISO(), payoffMonths) : null;
    const schedule: AmortizationPaymentRow[] = buildAmortizationSchedule(principalCents, rateBps, paymentCents, currentDateISO());
    return { paymentCents, payoffMonths, totalInterestCents, payoffDate, schedule };
  }, [principal, rate, termMonths, extraPayment, fixedPaymentCents]);

  return (
    <FlatList
      style={styles.flex}
      data={result?.schedule ?? []}
      keyExtractor={(row) => String(row.period)}
      ListHeaderComponent={
        <>
          <View style={styles.card}>
            <Text style={styles.title}>{t('amortizationSchedule.inputsTitle')}</Text>
            <TextField label={t('calculators.loanAmountLabel')} value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" />
            <TextField label={t('calculators.interestRateLabel')} value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
            <TextField label={t('common.termMonthsLabel')} value={termMonths} onChangeText={setTermMonths} keyboardType="number-pad" />
            <TextField
              label={t('loanDetailsCard.extraPaymentLabel')}
              value={extraPayment}
              onChangeText={setExtraPayment}
              keyboardType="decimal-pad"
              placeholder={t('common.amountPlaceholder')}
            />
          </View>

          {result ? (
            <View style={styles.card}>
              <Row label={t('calculators.monthlyPaymentLabel')} value={t('common.perMonth', { amount: formatMoney(result.paymentCents) })} big />
              <Row
                label={t('loanDetailsCard.projectedPayoffLabel')}
                value={
                  result.payoffDate
                    ? t('loanDetailsCard.payoffValue', { date: result.payoffDate, months: result.payoffMonths })
                    : t('loanDetailsCard.paymentTooLow')
                }
              />
              <Row label={t('calculators.totalInterestLabel')} value={formatMoney(result.totalInterestCents)} />
            </View>
          ) : null}

          <View style={styles.scheduleHeaderCard}>
            <Text style={styles.title}>{t('amortizationSchedule.scheduleTitle')}</Text>
            <View style={styles.scheduleRow}>
              <Text style={[styles.scheduleCell, styles.scheduleHeaderCell]}>{t('amortizationSchedule.colDate')}</Text>
              <Text style={[styles.scheduleCell, styles.scheduleHeaderCell, styles.amountCell]}>{t('amortizationSchedule.colPrincipal')}</Text>
              <Text style={[styles.scheduleCell, styles.scheduleHeaderCell, styles.amountCell]}>{t('amortizationSchedule.colInterest')}</Text>
              <Text style={[styles.scheduleCell, styles.scheduleHeaderCell, styles.amountCell]}>{t('amortizationSchedule.colBalance')}</Text>
            </View>
          </View>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.scheduleRow}>
          <Text style={styles.scheduleCell}>{item.date}</Text>
          <Text style={[styles.scheduleCell, styles.amountCell]}>{formatMoney(item.principalCents)}</Text>
          <Text style={[styles.scheduleCell, styles.amountCell]}>{formatMoney(item.interestCents)}</Text>
          <Text style={[styles.scheduleCell, styles.amountCell]}>{formatMoney(item.balanceCents)}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>{t('amortizationSchedule.empty')}</Text>}
    />
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, big && styles.rowValueBig]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  scheduleHeaderCard: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: colors.textMuted },
  rowValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  rowValueBig: { fontSize: 20 },
  scheduleRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scheduleCell: { flex: 1, fontSize: 12, color: colors.text },
  scheduleHeaderCell: { fontWeight: '700', color: colors.textMuted },
  amountCell: { textAlign: 'right' },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.lg },
});
