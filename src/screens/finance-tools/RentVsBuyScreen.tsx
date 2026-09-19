import { useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { AssumptionNote, CalcScreen, ResultsCard } from './CalcScreen';
import { ScheduleCard } from './ScheduleCard';
import { useCalcField } from './useCalcField';
import { compareRentVsBuy } from '../../finance-tools/rentVsBuy';
import { formatMoney, formatMoneyCompact } from '../../domain/money';
import { useT } from '../../i18n';

// The one calculator whose answer is an opinion: it turns entirely on the
// return you assume on invested cash, so that field is asked for rather than
// buried, and the verdict is always stated as "on these assumptions".
export function RentVsBuyScreen() {
  const t = useT();
  const rent = useCalcField();
  const rentGrowth = useCalcField('3');
  const price = useCalcField();
  const down = useCalcField();
  const rate = useCalcField();
  const years = useCalcField('30');
  const horizon = useCalcField('10');
  const closing = useCalcField('3');
  const propertyTax = useCalcField('1.2');
  const insurance = useCalcField('0.5');
  const maintenance = useCalcField('1');
  const hoa = useCalcField();
  const appreciation = useCalcField('3');
  const sellingCost = useCalcField('6');
  const investmentReturn = useCalcField('7');

  const ready = rent.cents > 0 && price.cents > 0 && horizon.int > 0;

  const result = useMemo(
    () =>
      compareRentVsBuy({
        years: horizon.int,
        monthlyRentCents: rent.cents,
        annualRentGrowthBps: rentGrowth.bps,
        priceCents: price.cents,
        downPaymentCents: down.cents,
        annualRateBps: rate.bps,
        termMonths: Math.round(years.number * 12),
        closingCostBps: closing.bps,
        propertyTaxAnnualBps: propertyTax.bps,
        insuranceAnnualBps: insurance.bps,
        maintenanceAnnualBps: maintenance.bps,
        hoaMonthlyCents: hoa.cents,
        annualAppreciationBps: appreciation.bps,
        sellingCostBps: sellingCost.bps,
        annualInvestmentReturnBps: investmentReturn.bps,
      }),
    [
      horizon.int,
      rent.cents,
      rentGrowth.bps,
      price.cents,
      down.cents,
      rate.bps,
      years.number,
      closing.bps,
      propertyTax.bps,
      insurance.bps,
      maintenance.bps,
      hoa.cents,
      appreciation.bps,
      sellingCost.bps,
      investmentReturn.bps,
    ],
  );

  // Nothing is rendered from `result` until the inputs behind it are in — a
  // table of zeroes for every year reads as a broken calculator.
  const rows = ready ? result.rows : [];
  const final = ready ? (result.rows[result.rows.length - 1] ?? null) : null;

  return (
    <CalcScreen>
      <Card title={t('financeTools.renting')}>
        <TextField
          label={t('financeTools.monthlyRent')}
          value={rent.text}
          onChangeText={rent.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('financeTools.rentGrowth')}
          value={rentGrowth.text}
          onChangeText={rentGrowth.set}
          keyboardType="decimal-pad"
        />
      </Card>

      <Card title={t('financeTools.buying')}>
        <TextField
          label={t('financeTools.homePrice')}
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
          label={t('calculators.interestRateLabel')}
          value={rate.text}
          onChangeText={rate.set}
          keyboardType="decimal-pad"
          placeholder="6.5"
        />
        <TextField
          label={t('financeTools.termYears')}
          value={years.text}
          onChangeText={years.set}
          keyboardType="number-pad"
        />
        <TextField
          label={t('financeTools.closingCostRate')}
          value={closing.text}
          onChangeText={closing.set}
          keyboardType="decimal-pad"
        />
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
          label={t('financeTools.maintenanceRate')}
          value={maintenance.text}
          onChangeText={maintenance.set}
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('financeTools.hoaMonthly')}
          value={hoa.text}
          onChangeText={hoa.set}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <TextField
          label={t('financeTools.appreciationRate')}
          value={appreciation.text}
          onChangeText={appreciation.set}
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('financeTools.sellingCostRate')}
          value={sellingCost.text}
          onChangeText={sellingCost.set}
          keyboardType="decimal-pad"
        />
      </Card>

      <Card title={t('financeTools.assumptions')}>
        <TextField
          label={t('financeTools.investmentReturn')}
          value={investmentReturn.text}
          onChangeText={investmentReturn.set}
          keyboardType="decimal-pad"
        />
        <TextField
          label={t('financeTools.horizonYears')}
          value={horizon.text}
          onChangeText={horizon.set}
          keyboardType="number-pad"
        />
        <AssumptionNote text={t('financeTools.rentVsBuyNote')} />
      </Card>

      <ResultsCard ready={ready}>
        {final ? (
          <>
            <ResultRow
              label={t('financeTools.breakEvenYear')}
              value={
                result.breakEvenYear == null
                  ? t('financeTools.rentingWins')
                  : t('financeTools.yearValue', { year: result.breakEvenYear })
              }
              big
              tone={result.breakEvenYear == null ? 'negative' : 'positive'}
            />
            <ResultRow
              label={t('financeTools.advantageAtHorizon', { year: final.year })}
              value={formatMoney(final.advantageCents)}
              tone={final.advantageCents >= 0 ? 'positive' : 'negative'}
              hint={
                final.advantageCents >= 0
                  ? t('financeTools.buyingAhead')
                  : t('financeTools.rentingAhead')
              }
            />
            <ResultRow
              label={t('financeTools.monthlyMortgagePayment')}
              value={formatMoney(result.monthlyPaymentCents)}
            />
            <ResultRow
              label={t('financeTools.upfrontCash')}
              value={formatMoney(result.upfrontCents)}
            />
            <ResultRow
              label={t('financeTools.buyerEquity')}
              value={formatMoney(final.buyerEquityCents)}
            />
            <ResultRow
              label={t('financeTools.buyerPortfolio')}
              value={formatMoney(final.buyerPortfolioCents)}
            />
            <ResultRow
              label={t('financeTools.renterPortfolio')}
              value={formatMoney(final.renterPortfolioCents)}
            />
            <ResultRow
              label={t('financeTools.totalRentPaid')}
              value={formatMoney(final.cumulativeRentCents)}
              tone="muted"
            />
          </>
        ) : null}
      </ResultsCard>

      <ScheduleCard
        title={t('financeTools.yearByYear')}
        columns={[
          t('financeTools.colYear'),
          t('financeTools.colBuyer'),
          t('financeTools.colRenter'),
          t('financeTools.colAdvantage'),
        ]}
        rows={rows.map((row) => [
          String(row.year),
          formatMoneyCompact(row.buyerEquityCents + row.buyerPortfolioCents),
          formatMoneyCompact(row.renterPortfolioCents),
          formatMoneyCompact(row.advantageCents),
        ])}
      />
    </CalcScreen>
  );
}
