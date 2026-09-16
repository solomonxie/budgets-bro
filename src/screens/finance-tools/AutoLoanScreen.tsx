import { useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { ChipRow } from '../../components/ui/ChipRow';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { CalcScreen, ResultsCard } from './CalcScreen';
import { ScheduleCard } from './ScheduleCard';
import { useCalcField } from './useCalcField';
import { computeAutoLoan } from '../../finance-tools/autoLoan';
import { buildAmortizationSchedule } from '../../finance-tools/amortization';
import { currentDateISO } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';

type TaxBasis = 'afterTradeIn' | 'fullPrice';

// A car loan is an ordinary amortizing loan; what makes it its own screen is
// everything that happens before the principal is known — tax, dealer fees,
// and a trade-in that can be worth less than it still owes.
export function AutoLoanScreen() {
  const t = useT();
  const price = useCalcField();
  const down = useCalcField();
  const tradeInValue = useCalcField();
  const tradeInOwed = useCalcField();
  const [taxBasis, setTaxBasis] = useState<TaxBasis>('afterTradeIn');
  const salesTax = useCalcField();
  const fees = useCalcField();
  const rate = useCalcField();
  const months = useCalcField('60');

  const ready = price.cents > 0 && months.int > 0;

  const result = useMemo(
    () =>
      computeAutoLoan({
        priceCents: price.cents,
        downPaymentCents: down.cents,
        tradeInValueCents: tradeInValue.cents,
        amountOwedOnTradeCents: tradeInOwed.cents,
        salesTaxBps: salesTax.bps,
        tradeInReducesTaxableAmount: taxBasis === 'afterTradeIn',
        feesCents: fees.cents,
        annualRateBps: rate.bps,
        termMonths: months.int,
      }),
    [price.cents, down.cents, tradeInValue.cents, tradeInOwed.cents, salesTax.bps, taxBasis, fees.cents, rate.bps, months.int],
  );

  const schedule = useMemo(
    () =>
      ready && result.monthlyPaymentCents > 0
        ? buildAmortizationSchedule(result.amountFinancedCents, rate.bps, result.monthlyPaymentCents, currentDateISO(), months.int + 2)
        : [],
    [ready, result.amountFinancedCents, result.monthlyPaymentCents, rate.bps, months.int],
  );

  return (
    <CalcScreen>
      <Card title={t('financeTools.inputs')}>
        <TextField
          label={t('financeTools.vehiclePrice')}
          value={price.text}
          onChangeText={price.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('financeTools.downPayment')}
          value={down.text}
          onChangeText={down.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('financeTools.tradeInValue')}
          value={tradeInValue.text}
          onChangeText={tradeInValue.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        {tradeInValue.cents > 0 ? (
          <TextField
            label={t('financeTools.tradeInOwed')}
            value={tradeInOwed.text}
            onChangeText={tradeInOwed.set}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
          />
        ) : null}
        <TextField
          label={t('financeTools.salesTaxRate')}
          value={salesTax.text}
          onChangeText={salesTax.set}
          keyboardType="decimal-pad"
          placeholder="7"
        />
        {tradeInValue.cents > 0 ? (
          <ChipRow
            value={taxBasis}
            onChange={setTaxBasis}
            options={[
              { value: 'afterTradeIn', label: t('financeTools.taxAfterTradeIn') },
              { value: 'fullPrice', label: t('financeTools.taxFullPrice') },
            ]}
          />
        ) : null}
        <TextField
          label={t('financeTools.feesLabel')}
          value={fees.text}
          onChangeText={fees.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('calculators.interestRateLabel')}
          value={rate.text}
          onChangeText={rate.set}
          keyboardType="decimal-pad"
          placeholder="5"
        />
        <TextField label={t('common.termMonthsLabel')} value={months.text} onChangeText={months.set} keyboardType="number-pad" />
      </Card>

      <ResultsCard ready={ready}>
        <ResultRow
          label={t('calculators.monthlyPaymentLabel')}
          value={t('common.perMonth', { amount: formatMoney(result.monthlyPaymentCents) })}
          big
        />
        <ResultRow label={t('financeTools.amountFinanced')} value={formatMoney(result.amountFinancedCents)} />
        <ResultRow
          label={t('financeTools.salesTax')}
          value={formatMoney(result.salesTaxCents)}
          hint={t('financeTools.taxedOn', { amount: formatMoney(result.taxableCents) })}
        />
        {tradeInValue.cents > 0 ? (
          <ResultRow
            label={t('financeTools.tradeInEquity')}
            value={formatMoney(result.tradeInEquityCents)}
            tone={result.tradeInEquityCents < 0 ? 'negative' : 'positive'}
            hint={result.tradeInEquityCents < 0 ? t('financeTools.underwaterTradeIn') : undefined}
          />
        ) : null}
        <ResultRow label={t('calculators.totalInterestLabel')} value={formatMoney(result.totalInterestCents)} tone="negative" />
        <ResultRow label={t('financeTools.totalOfPayments')} value={formatMoney(result.totalOfPaymentsCents)} />
        <ResultRow label={t('financeTools.totalCost')} value={formatMoney(result.totalCostCents)} />
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
