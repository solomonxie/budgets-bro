import { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { ChipRow } from '../../components/ui/ChipRow';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { UnitAmountField } from '../../components/ui/UnitAmountField';
import { AssumptionNote, CalcScreen, ResultsCard } from './CalcScreen';
import { useCalcField, monthsFromYears } from './useCalcField';
import { CONVENTIONAL_28_36, maxAffordablePrice, maxPriceFromMonthlyBudget } from '../../finance-tools/affordability';
import type { DtiRule, OwnershipCosts } from '../../finance-tools/affordability';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';

type Basis = 'income' | 'budget';
type RuleName = 'conventional' | 'lenient';
type DownUnit = 'percent' | 'amount';

// FHA's looser pair, alongside the conventional one. Not a country-specific
// table: these two ratios are what every lender's calculator exposes, and the
// app ships no rates for anywhere (same stance as taxSavings.ts).
const LENIENT_31_43: DtiRule = { frontEndPercent: 31, backEndPercent: 43 };

// Two genuinely different questions behind one answer: what a lender will
// approve, and what you're willing to pay each month. The second is the one
// that keeps people solvent, so it isn't buried behind the first.
export function AffordabilityScreen() {
  const t = useT();
  const [basis, setBasis] = useState<Basis>('income');
  const [ruleName, setRuleName] = useState<RuleName>('conventional');
  const income = useCalcField();
  const monthlyDebt = useCalcField();
  const budget = useCalcField();
  const down = useCalcField('20');
  const [downUnit, setDownUnit] = useState<DownUnit>('percent');
  const rate = useCalcField();
  const years = useCalcField('30');
  const propertyTax = useCalcField('1.2');
  const insurance = useCalcField('0.5');
  const hoa = useCalcField();

  const termMonths = monthsFromYears(years);
  const ready = termMonths > 0 && rate.filled && (basis === 'income' ? income.cents > 0 : budget.cents > 0);

  const costs: OwnershipCosts = useMemo(
    () => ({
      annualRateBps: rate.bps,
      termMonths,
      downPaymentPercent: downUnit === 'percent' ? down.number : undefined,
      downPaymentCents: downUnit === 'amount' ? down.cents : undefined,
      propertyTaxAnnualBps: propertyTax.bps,
      insuranceAnnualBps: insurance.bps,
      hoaAnnualCents: hoa.cents * 12,
    }),
    [rate.bps, termMonths, downUnit, down.number, down.cents, propertyTax.bps, insurance.bps, hoa.cents],
  );

  const result = useMemo(() => {
    if (!ready) return null;
    return basis === 'income'
      ? maxAffordablePrice({
          annualIncomeCents: income.cents,
          monthlyDebtCents: monthlyDebt.cents,
          rule: ruleName === 'conventional' ? CONVENTIONAL_28_36 : LENIENT_31_43,
          costs,
        })
      : maxPriceFromMonthlyBudget(budget.cents, costs);
  }, [ready, basis, income.cents, monthlyDebt.cents, budget.cents, ruleName, costs]);

  return (
    <CalcScreen>
      <Card title={t('financeTools.inputs')}>
        <ChipRow
          value={basis}
          onChange={setBasis}
          options={[
            { value: 'income', label: t('financeTools.basisIncome') },
            { value: 'budget', label: t('financeTools.basisBudget') },
          ]}
        />
        {basis === 'income' ? (
          <>
            <TextField
              label={t('financeTools.annualIncome')}
              value={income.text}
              onChangeText={income.set}
              keyboardType="decimal-pad"
              placeholder={t('common.amountPlaceholder')}
            />
            <TextField
              label={t('financeTools.monthlyDebtPayments')}
              value={monthlyDebt.text}
              onChangeText={monthlyDebt.set}
              keyboardType="decimal-pad"
              placeholder={t('common.amountPlaceholder')}
            />
            <ChipRow
              value={ruleName}
              onChange={setRuleName}
              options={[
                { value: 'conventional', label: t('financeTools.rule2836') },
                { value: 'lenient', label: t('financeTools.rule3143') },
              ]}
            />
          </>
        ) : (
          <TextField
            label={t('financeTools.monthlyBudget')}
            value={budget.text}
            onChangeText={budget.set}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
          />
        )}
        <UnitAmountField
          label={t('financeTools.downPayment')}
          value={down.text}
          onChangeText={down.set}
          unit={downUnit}
          onUnitChange={setDownUnit}
          units={[
            { value: 'percent', label: '%' },
            { value: 'amount', label: '$' },
          ]}
        />
        <TextField
          label={t('calculators.interestRateLabel')}
          value={rate.text}
          onChangeText={rate.set}
          keyboardType="decimal-pad"
          placeholder="6.5"
        />
        <TextField label={t('financeTools.termYears')} value={years.text} onChangeText={years.set} keyboardType="number-pad" />
        <TextField
          label={t('financeTools.propertyTaxRate')}
          value={propertyTax.text}
          onChangeText={propertyTax.set}
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('financeTools.insuranceRate')}
          value={insurance.text}
          onChangeText={insurance.set}
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('financeTools.hoaMonthly')}
          value={hoa.text}
          onChangeText={hoa.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
      </Card>

      <ResultsCard ready={ready}>
        {result ? (
          <>
            <ResultRow label={t('financeTools.maxHousePrice')} value={formatMoney(result.maxHousePriceCents)} big tone="positive" />
            <ResultRow label={t('financeTools.loanAmount')} value={formatMoney(result.loanCents)} />
            <ResultRow label={t('financeTools.downPayment')} value={formatMoney(result.downPaymentCents)} />
            <ResultRow label={t('financeTools.closingCosts')} value={formatMoney(result.closingCostCents)} />
            <ResultRow label={t('financeTools.cashAtClosing')} value={formatMoney(result.totalAtClosingCents)} tone="negative" />
            <ResultRow label={t('financeTools.principalAndInterest')} value={formatMoney(result.principalInterestCents)} />
            <ResultRow label={t('financeTools.propertyTax')} value={formatMoney(result.propertyTaxCents)} />
            <ResultRow label={t('financeTools.homeInsurance')} value={formatMoney(result.insuranceCents)} />
            {result.hoaCents > 0 ? <ResultRow label={t('financeTools.hoa')} value={formatMoney(result.hoaCents)} /> : null}
            <ResultRow label={t('financeTools.maintenance')} value={formatMoney(result.maintenanceCents)} tone="muted" />
            <ResultRow label={t('financeTools.monthlyTotal')} value={formatMoney(result.totalMonthlyCents)} />
            {basis === 'income' ? (
              <>
                <ResultRow
                  label={t('financeTools.frontEndRatio')}
                  value={`${result.frontEndPercent.toFixed(1)}%`}
                  hint={t('financeTools.frontEndHint')}
                />
                <ResultRow
                  label={t('financeTools.backEndRatio')}
                  value={`${result.backEndPercent.toFixed(1)}%`}
                  hint={t('financeTools.backEndHint')}
                />
              </>
            ) : null}
            <AssumptionNote text={t('financeTools.affordabilityNote')} />
          </>
        ) : null}
      </ResultsCard>
    </CalcScreen>
  );
}
