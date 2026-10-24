import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../components/ui/Card';
import { ResultRow } from '../../../components/ui/ResultRow';
import { AssumptionNote } from '../CalcScreen';
import { payoffTime, text } from './parts';
import type { PlanResult } from '../../../finance-tools/mortgagePlan';
import { formatMoney, formatPercent } from '../../../domain/money';
import { useT } from '../../../i18n';
import type { TranslationKey } from '../../../i18n';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';

// The answers, live.
export function SummaryCard({
  r,
  isHeld,
  freqLabel,
  frequencyIsMonthly,
  hasIncome,
  homeValueCents,
}: {
  r: PlanResult;
  isHeld: boolean;
  freqLabel: string;
  frequencyIsMonthly: boolean;
  hasIncome: boolean;
  homeValueCents: number;
}) {
  const t = useT();
  const insuranceNote: TranslationKey | null =
    r.insurance.status === 'priceTooHigh'
      ? 'canadaPurchase.noteOverCeiling'
      : r.insurance.status === 'downTooSmall'
        ? 'canadaPurchase.noteBelowMinimum'
        : null;
  const hasPrepayments =
    r.withPrepayments.months !== r.baseline.months ||
    r.withPrepayments.interestCents !== r.baseline.interestCents;

  return (
    <Card style={styles.summary}>
      {!r.ready ? (
        <Text style={text.hint}>{t('financeTools.enterInputs')}</Text>
      ) : (
        <>
          <ResultRow
            label={t('canadaPurchase.totalMonthlyCost')}
            value={formatMoney(r.monthlyTotalCents)}
            big
          />
          {isHeld ? (
            <>
              <ResultRow
                label={t('mortgagePlan.paidOffIn')}
                value={payoffTime(t, r.withPrepayments)}
                tone={
                  !r.withPrepayments.paysOff
                    ? 'negative'
                    : hasPrepayments
                      ? 'positive'
                      : 'default'
                }
              />
              {r.withPrepayments.paysOff ? (
                <ResultRow
                  label={t('mortgagePlan.interestLeft')}
                  value={formatMoney(r.withPrepayments.interestCents)}
                  tone="negative"
                />
              ) : null}
            </>
          ) : (
            <>
              <ResultRow
                label={t('canadaPurchase.paymentEach', {
                  frequency: freqLabel,
                })}
                value={formatMoney(r.payment.paymentCents)}
              />
              {!frequencyIsMonthly ? (
                <ResultRow
                  label={t('canadaPurchase.paymentPerMonthEquivalent')}
                  value={formatMoney(r.monthlyPaymentCents)}
                  tone="muted"
                />
              ) : null}
              <ResultRow
                label={t('canadaPurchase.mortgageAmount')}
                value={formatMoney(r.insurance.totalMortgageCents)}
              />
              {r.insurance.status === 'insured' ? (
                <ResultRow
                  label={t('canadaPurchase.insurancePremium', {
                    rate: (r.insurance.premiumRateBps / 100).toFixed(2),
                  })}
                  value={formatMoney(r.insurance.premiumCents)}
                  tone="negative"
                  hint={t('canadaPurchase.premiumFinancedHint')}
                />
              ) : null}
              <ResultRow
                label={t('canadaPurchase.loanToValue')}
                value={`${(r.insurance.ltvBps / 100).toFixed(1)}%`}
                tone="muted"
              />
              <ResultRow
                label={t('canadaPurchase.payoffIn')}
                value={payoffTime(t, r.withPrepayments)}
              />
              <ResultRow
                label={t('canadaPurchase.totalInterest')}
                value={formatMoney(r.withPrepayments.interestCents)}
                tone="negative"
              />
              <View style={styles.divider} />
              <ResultRow
                label={t('canadaPurchase.cashToClose')}
                value={formatMoney(r.closing.totalCents)}
                big
              />
              <ResultRow
                label={t('mortgagePlan.incomeNeeded')}
                value={formatMoney(r.qualifying.required.requiredAnnualCents)}
                hint={t('mortgagePlan.incomeNeededHint', {
                  rate: formatPercent(r.qualifying.stressRateBps),
                })}
              />
              {r.qualifying.maxPriceCents != null ? (
                <ResultRow
                  label={t('mortgagePlan.maxPrice')}
                  value={formatMoney(r.qualifying.maxPriceCents)}
                  tone={
                    r.qualifying.maxPriceCents >= homeValueCents
                      ? 'positive'
                      : 'negative'
                  }
                />
              ) : hasIncome ? (
                <ResultRow
                  label={t('mortgagePlan.maxPrice')}
                  value="—"
                  tone="negative"
                />
              ) : null}
            </>
          )}
          {insuranceNote ? <AssumptionNote text={t(insuranceNote)} /> : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { borderColor: colors.accent },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
});
