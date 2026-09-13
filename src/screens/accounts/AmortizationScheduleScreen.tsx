import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { useAccounts } from '../../hooks/useAccounts';
import { useAccountRateHistory } from '../../hooks/useAccountRateHistory';
import {
  addMonths,
  buildAmortizationSchedule,
  monthlyPaymentCents,
  remainingMonthsToPayoff,
  totalInterestRemainingCents,
} from '../../finance-tools/amortization';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { AccountsStackParamList } from '../../navigation/types';
import type { AmortizationPaymentRow } from '../../finance-tools/amortization';

type Route = RouteProp<AccountsStackParamList, 'AmortizationSchedule'>;

// Full mortgage/loan calculator reached from a real account's Loan
// Details card: normal payment math (same formula as
// CalculatorsHomeScreen), an early/extra-payment payoff projection (same
// as LoanDetailsCard), and the full per-payment amortization table —
// all three use cases share one screen because they share one input set.
// Inputs prefill from the account's *current* outstanding balance and
// rate (not its original terms) but stay editable, so this also works as
// an ad-hoc "what if" calculator.
export function AmortizationScheduleScreen() {
  const t = useT();
  const route = useRoute<Route>();
  const { accountId } = route.params;
  const { accounts } = useAccounts();
  const { currentRateBps } = useAccountRateHistory(accountId);
  const account = accounts.find((a) => a.account.id === accountId);
  const outstandingCents = Math.max(0, -(account?.balanceCents ?? 0));
  const scheduledTermMonths = account?.account.termMonths ?? null;
  const scheduledPrincipalCents = account?.account.originalPrincipalCents ?? null;
  const scheduledRateBps =
    scheduledPrincipalCents != null && scheduledTermMonths != null && currentRateBps != null
      ? monthlyPaymentCents(scheduledPrincipalCents, currentRateBps, scheduledTermMonths)
      : null;

  const [principal, setPrincipal] = useState(String(outstandingCents / 100 || 0));
  const [rate, setRate] = useState(currentRateBps != null ? String(currentRateBps / 100) : '');
  const [termMonths, setTermMonths] = useState(scheduledTermMonths != null ? String(scheduledTermMonths) : '360');
  const [extraPayment, setExtraPayment] = useState('');

  const result = useMemo(() => {
    const principalCents = Math.round((parseFloat(principal) || 0) * 100);
    const rateBps = Math.round((parseFloat(rate) || 0) * 100);
    const months = Math.round(parseFloat(termMonths) || 0);
    const extraCents = Math.round((parseFloat(extraPayment) || 0) * 100);
    if (principalCents <= 0 || months <= 0) return null;
    const basePaymentCents =
      scheduledRateBps != null ? scheduledRateBps : monthlyPaymentCents(principalCents, rateBps, months);
    const paymentCents = basePaymentCents + extraCents;
    const payoffMonths = remainingMonthsToPayoff(principalCents, rateBps, paymentCents);
    const totalInterestCents = totalInterestRemainingCents(principalCents, paymentCents, payoffMonths);
    const payoffDate = Number.isFinite(payoffMonths) ? addMonths(currentDateISO(), payoffMonths) : null;
    const schedule: AmortizationPaymentRow[] = buildAmortizationSchedule(
      principalCents,
      rateBps,
      paymentCents,
      currentDateISO(),
    );
    return { paymentCents, payoffMonths, totalInterestCents, payoffDate, schedule };
  }, [principal, rate, termMonths, extraPayment, scheduledRateBps]);

  return (
    <ScreenContainer>
      <FlatList
        style={{ flex: 1 }}
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
    </ScreenContainer>
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
