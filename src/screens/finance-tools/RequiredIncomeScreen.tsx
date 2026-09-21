import { useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { AssumptionNote, CalcScreen, ResultsCard } from './CalcScreen';
import { useCalcField, monthsFromYears } from './useCalcField';
import {
  GDS_LIMIT_PERCENT,
  TDS_LIMIT_PERCENT,
  paymentPlan,
  requiredIncome,
  stressTestRateBps,
} from '../../finance-tools/canadianMortgage';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';

// The affordability calculator run backwards: not "what can I buy on what I
// earn" but "what do I have to earn for this house". Lenders answer it with
// two ratios against a rate nobody is offering — the stress test — so both
// are on screen rather than buried in the result.
export function RequiredIncomeScreen() {
  const t = useT();
  const mortgage = useCalcField();
  const rate = useCalcField();
  const years = useCalcField('25');
  const propertyTax = useCalcField();
  const heat = useCalcField('100');
  const condoFees = useCalcField();
  const otherDebts = useCalcField();

  const amortizationMonths = monthsFromYears(years);
  const ready = mortgage.cents > 0 && rate.bps > 0 && amortizationMonths > 0;
  const qualifyingRateBps = stressTestRateBps(rate.bps);

  const contractPlan = useMemo(
    () => paymentPlan(mortgage.cents, rate.bps, amortizationMonths),
    [mortgage.cents, rate.bps, amortizationMonths],
  );
  const qualifyingPlan = useMemo(
    () => paymentPlan(mortgage.cents, qualifyingRateBps, amortizationMonths),
    [mortgage.cents, qualifyingRateBps, amortizationMonths],
  );

  const result = useMemo(
    () =>
      requiredIncome({
        paymentCents: qualifyingPlan.paymentCents,
        propertyTaxMonthlyCents: propertyTax.cents,
        heatMonthlyCents: heat.cents,
        condoFeeMonthlyCents: condoFees.cents,
        otherDebtsMonthlyCents: otherDebts.cents,
      }),
    [
      qualifyingPlan.paymentCents,
      propertyTax.cents,
      heat.cents,
      condoFees.cents,
      otherDebts.cents,
    ],
  );

  return (
    <CalcScreen>
      <Card title={t('financeTools.inputs')}>
        <TextField
          label={t('requiredIncome.mortgageAmount')}
          value={mortgage.text}
          onChangeText={mortgage.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('calculators.interestRateLabel')}
          value={rate.text}
          onChangeText={rate.set}
          keyboardType="decimal-pad"
          placeholder="4.5"
        />
        <TextField
          label={t('canadaPurchase.amortizationYears')}
          value={years.text}
          onChangeText={years.set}
          keyboardType="number-pad"
        />
        <TextField
          label={t('canadaPurchase.propertyTaxMonthly')}
          value={propertyTax.text}
          onChangeText={propertyTax.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('canadaPurchase.heat')}
          value={heat.text}
          onChangeText={heat.set}
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('canadaPurchase.condoFees')}
          value={condoFees.text}
          onChangeText={condoFees.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('requiredIncome.otherDebts')}
          value={otherDebts.text}
          onChangeText={otherDebts.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
      </Card>

      <ResultsCard ready={ready}>
        <ResultRow
          label={t('requiredIncome.requiredAnnual')}
          value={formatMoney(result.requiredAnnualCents)}
          big
        />
        <ResultRow
          label={t('requiredIncome.boundBy')}
          value={t(
            result.boundBy === 'gds'
              ? 'requiredIncome.boundGds'
              : 'requiredIncome.boundTds',
          )}
          tone="muted"
        />
        <ResultRow
          label={t('requiredIncome.qualifyingRate', {
            rate: (qualifyingRateBps / 100).toFixed(2),
          })}
          value={formatMoney(qualifyingPlan.paymentCents)}
          hint={t('requiredIncome.qualifyingHint')}
        />
        <ResultRow
          label={t('requiredIncome.contractPayment', {
            rate: (rate.bps / 100).toFixed(2),
          })}
          value={formatMoney(contractPlan.paymentCents)}
          tone="positive"
        />
        <ResultRow
          label={t('requiredIncome.gdsCosts')}
          value={formatMoney(result.gdsMonthlyCents)}
        />
        <ResultRow
          label={t('requiredIncome.tdsCosts')}
          value={formatMoney(result.tdsMonthlyCents)}
        />
        <AssumptionNote
          text={t('requiredIncome.ratioNote', {
            gds: GDS_LIMIT_PERCENT,
            tds: TDS_LIMIT_PERCENT,
          })}
        />
      </ResultsCard>
    </CalcScreen>
  );
}
