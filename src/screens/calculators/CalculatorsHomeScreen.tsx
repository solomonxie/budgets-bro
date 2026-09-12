import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import {
  addMonths,
  monthlyPaymentCents,
  totalInterestRemainingCents,
} from '../../finance-tools/amortization';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Ad-hoc mortgage/loan calculator — same math as the per-account Loan
// Details card, but for "what if" numbers not tied to a real account.
export function CalculatorsHomeScreen() {
  const t = useT();
  const [principal, setPrincipal] = useState('300000');
  const [rate, setRate] = useState('6.5');
  const [termMonths, setTermMonths] = useState('360');

  const result = useMemo(() => {
    const principalCents = Math.round((parseFloat(principal) || 0) * 100);
    const rateBps = Math.round((parseFloat(rate) || 0) * 100);
    const months = Math.round(parseFloat(termMonths) || 0);
    if (principalCents <= 0 || months <= 0) return null;
    const paymentCents = monthlyPaymentCents(principalCents, rateBps, months);
    const totalInterestCents = totalInterestRemainingCents(principalCents, paymentCents, months);
    const payoffDate = addMonths(currentDateISO(), months);
    return { paymentCents, totalInterestCents, payoffDate };
  }, [principal, rate, termMonths]);

  return (
    <ScreenContainer scroll>
      <View style={styles.card}>
        <Text style={styles.title}>{t('calculators.title')}</Text>
        <TextField label={t('calculators.loanAmountLabel')} value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" />
        <TextField label={t('calculators.interestRateLabel')} value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
        <TextField label={t('common.termMonthsLabel')} value={termMonths} onChangeText={setTermMonths} keyboardType="number-pad" />
      </View>

      {result ? (
        <View style={styles.card}>
          <Row label={t('calculators.monthlyPaymentLabel')} value={t('common.perMonth', { amount: formatMoney(result.paymentCents) })} big />
          <Row label={t('calculators.totalInterestLabel')} value={formatMoney(result.totalInterestCents)} />
          <Row label={t('calculators.payoffDateLabel')} value={result.payoffDate} />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.title}>{t('calculators.moreHeading')}</Text>
        <Text style={styles.hint}>{t('calculators.moreHint')}</Text>
      </View>
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
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: colors.textMuted },
  rowValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  rowValueBig: { fontSize: 20 },
});
