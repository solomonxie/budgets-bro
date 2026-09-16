import { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { UnitAmountField } from '../../components/ui/UnitAmountField';
import { LinkableNumberField } from '../../components/ui/LinkableNumberField';
import { AssumptionNote, CalcScreen, ResultsCard } from './CalcScreen';
import { ScheduleCard } from './ScheduleCard';
import { useCalcField, monthsFromYears } from './useCalcField';
import { buildAmortizationSchedule } from '../../finance-tools/amortization';
import { monthlyHousingCost } from '../../finance-tools/affordability';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';

type DownUnit = 'percent' | 'amount';

// "What does this house cost me a month" — the whole payment, not just
// principal and interest, because the escrow line is what surprises people.
export function MortgageScreen() {
  const t = useT();
  const price = useCalcField();
  const down = useCalcField();
  const [downUnit, setDownUnit] = useState<DownUnit>('percent');
  const rate = useCalcField();
  const years = useCalcField('30');
  const propertyTax = useCalcField();
  const insurance = useCalcField();
  const hoa = useCalcField();

  const termMonths = monthsFromYears(years);
  const ready = price.cents > 0 && termMonths > 0;

  const cost = useMemo(
    () =>
      monthlyHousingCost(price.cents, {
        annualRateBps: rate.bps,
        termMonths,
        downPaymentPercent: downUnit === 'percent' ? down.number : undefined,
        downPaymentCents: downUnit === 'amount' ? down.cents : undefined,
        propertyTaxAnnualBps: propertyTax.bps,
        insuranceAnnualCents: insurance.cents,
        hoaAnnualCents: hoa.cents * 12,
      }),
    [price.cents, rate.bps, termMonths, downUnit, down.number, down.cents, propertyTax.bps, insurance.cents, hoa.cents],
  );

  const schedule = useMemo(
    () => (ready ? buildAmortizationSchedule(cost.loanCents, rate.bps, cost.principalInterestCents, currentDateISO(), termMonths + 2) : []),
    [ready, cost.loanCents, cost.principalInterestCents, rate.bps, termMonths],
  );
  const totalInterestCents = schedule.reduce((sum, row) => sum + row.interestCents, 0);

  return (
    <CalcScreen>
      <Card title={t('financeTools.inputs')}>
        <LinkableNumberField
          label={t('financeTools.homePrice')}
          quantity="housePrice"
          value={price.text}
          onChangeText={price.set}
          linkedAccountId={price.linkedAccountId}
          onLink={price.link}
          accountFilter={(a) => a.account.type === 'mortgage'}
          placeholder={t('common.amountPlaceholder')}
        />
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
          placeholder={downUnit === 'percent' ? '20' : t('common.amountPlaceholder')}
        />
        <LinkableNumberField
          label={t('calculators.interestRateLabel')}
          quantity="rateBps"
          value={rate.text}
          onChangeText={rate.set}
          linkedAccountId={rate.linkedAccountId}
          onLink={rate.link}
          accountFilter={(a) => a.account.type === 'mortgage'}
          placeholder="6.5"
        />
        <TextField label={t('financeTools.termYears')} value={years.text} onChangeText={years.set} keyboardType="number-pad" />
        <TextField
          label={t('financeTools.propertyTaxRate')}
          value={propertyTax.text}
          onChangeText={propertyTax.set}
          keyboardType="decimal-pad"
          placeholder="1.2"
        />
        <TextField
          label={t('financeTools.insuranceAnnual')}
          value={insurance.text}
          onChangeText={insurance.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
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
        <ResultRow label={t('financeTools.monthlyTotal')} value={formatMoney(cost.totalMonthlyCents)} big />
        <ResultRow label={t('financeTools.principalAndInterest')} value={formatMoney(cost.principalInterestCents)} />
        <ResultRow label={t('financeTools.propertyTax')} value={formatMoney(cost.propertyTaxCents)} />
        <ResultRow label={t('financeTools.homeInsurance')} value={formatMoney(cost.insuranceCents)} />
        {cost.hoaCents > 0 ? <ResultRow label={t('financeTools.hoa')} value={formatMoney(cost.hoaCents)} /> : null}
        <ResultRow label={t('financeTools.maintenance')} value={formatMoney(cost.maintenanceCents)} tone="muted" />
        <ResultRow label={t('financeTools.loanAmount')} value={formatMoney(cost.loanCents)} />
        <ResultRow label={t('financeTools.downPayment')} value={formatMoney(cost.downPaymentCents)} />
        <ResultRow label={t('calculators.totalInterestLabel')} value={formatMoney(totalInterestCents)} tone="negative" />
        <AssumptionNote text={t('financeTools.maintenanceNote')} />
      </ResultsCard>

      <ScheduleCard
        title={t('amortizationSchedule.scheduleTitle')}
        columns={[
          t('amortizationSchedule.colDate'),
          t('amortizationSchedule.colPrincipal'),
          t('amortizationSchedule.colInterest'),
          t('amortizationSchedule.colBalance'),
        ]}
        rows={schedule.map((row) => [
          row.date,
          formatMoney(row.principalCents),
          formatMoney(row.interestCents),
          formatMoney(row.balanceCents),
        ])}
      />
    </CalcScreen>
  );
}
