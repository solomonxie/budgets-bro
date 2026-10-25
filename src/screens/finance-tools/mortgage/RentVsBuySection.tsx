import { useMemo } from 'react';
import { Text } from 'react-native';
import { ResultRow } from '../../../components/ui/ResultRow';
import { AssumptionNote } from '../CalcScreen';
import { useCalcField } from '../useCalcField';
import { SliderField, steps } from './SliderField';
import { Section, text } from './parts';
import type { PlanInputs } from './planInputs';
import { monthlyEquivalentBps } from '../../../finance-tools/canadianMortgage';
import type { PlanResult } from '../../../finance-tools/mortgagePlan';
import { compareRentVsBuy } from '../../../finance-tools/rentVsBuy';
import { formatMoney } from '../../../domain/money';
import { useT } from '../../../i18n';

// Stated in mortgagePlan.rentNote.
const SELLING_COST_BPS = 500;

const RENT_STOPS = steps(0, 8000, 50);
const HORIZON_YEARS = 30;
const MILESTONES = [10, 20, 30];

function interestVsRent(ratio: number) {
  if (ratio < 0.9)
    return { hint: 'mortgagePlan.rentInterestBelow', tone: 'positive' } as const;
  if (ratio <= 1.1)
    return { hint: 'mortgagePlan.rentInterestNear', tone: 'default' } as const;
  return { hint: 'mortgagePlan.rentInterestAbove', tone: 'negative' } as const;
}
const GROWTH_STOPS = steps(0, 10, 0.5);
const APPRECIATION_STOPS = steps(-5, 10, 0.5);
const RETURN_STOPS = steps(0, 12, 0.5);

export function RentVsBuySection({
  r,
  inputs,
  homeValueCents,
  rateBps,
  amortizationMonths,
}: {
  r: PlanResult;
  inputs: PlanInputs;
  homeValueCents: number;
  rateBps: number;
  amortizationMonths: number;
}) {
  const t = useT();
  const rent = useCalcField('', 'rent');
  const rentGrowth = useCalcField('3', 'rentGrowth');
  const appreciation = useCalcField('3', 'appreciation');
  const investReturn = useCalcField('5', 'investReturn');
  const { compounding, propertyTaxRate, otherExpenses, condoFees, heat } =
    inputs;

  const closingCosts = r.closing.totalCents - r.downCents;
  const result = useMemo(() => {
    if (rent.cents <= 0 || !r.ready) return null;
    return compareRentVsBuy({
      years: HORIZON_YEARS,
      monthlyRentCents: rent.cents,
      annualRentGrowthBps: rentGrowth.bps,
      priceCents: homeValueCents,
      downPaymentCents: r.downCents,
      annualRateBps: monthlyEquivalentBps(rateBps, compounding),
      termMonths: amortizationMonths,
      closingCostBps:
        homeValueCents > 0
          ? Math.round((closingCosts / homeValueCents) * 10000)
          : 0,
      propertyTaxAnnualBps: propertyTaxRate.bps,
      insuranceAnnualBps: 0,
      maintenanceAnnualBps:
        homeValueCents > 0
          ? Math.round(((otherExpenses.cents * 12) / homeValueCents) * 10000)
          : 0,
      hoaMonthlyCents: condoFees.cents + heat.cents,
      annualAppreciationBps: appreciation.bps,
      sellingCostBps: SELLING_COST_BPS,
      annualInvestmentReturnBps: investReturn.bps,
    });
  }, [
    rent.cents,
    r.ready,
    r.downCents,
    closingCosts,
    rentGrowth.bps,
    homeValueCents,
    rateBps,
    compounding,
    amortizationMonths,
    propertyTaxRate.bps,
    otherExpenses.cents,
    condoFees.cents,
    heat.cents,
    appreciation.bps,
    investReturn.bps,
  ]);
  // Year one's average: the first month alone overstates it slightly.
  const interestCents = useMemo(() => {
    const year = r.schedule.slice(0, 12);
    if (year.length === 0) return 0;
    return year.reduce((sum, row) => sum + row.interestCents, 0) / year.length;
  }, [r.schedule]);
  const ratio = rent.cents > 0 ? interestCents / rent.cents : 0;
  const vsRent = interestVsRent(ratio);

  return (
    <Section
      title={t('mortgagePlan.rentHeading')}
      summary={
        result
          ? result.breakEvenYear != null
            ? t('mortgagePlan.rentBreakEven', { year: result.breakEvenYear })
            : t('mortgagePlan.rentNever', { years: HORIZON_YEARS })
          : ''
      }
    >
      <SliderField
        label={t('mortgagePlan.rentShort')}
        field={rent}
        kind="money"
        stops={RENT_STOPS}
        empty={3000}
      />
      <SliderField
        label={t('mortgagePlan.rentGrowthShort')}
        field={rentGrowth}
        kind="percent"
        stops={GROWTH_STOPS}
      />
      <SliderField
        label={t('mortgagePlan.appreciationShort')}
        field={appreciation}
        kind="percent"
        stops={APPRECIATION_STOPS}
      />
      <SliderField
        label={t('mortgagePlan.returnShort')}
        field={investReturn}
        kind="percent"
        stops={RETURN_STOPS}
        hint={
          result
            ? t('mortgagePlan.returnHint', {
                amount: formatMoney(
                  Math.round((result.upfrontCents * investReturn.bps) / 10000),
                ),
                kept: formatMoney(result.upfrontCents),
              })
            : undefined
        }
      />
      {result ? (
        <>
          <ResultRow
            label={t('mortgagePlan.rentWhenPaysOff')}
            value={
              result.breakEvenYear != null
                ? t('mortgagePlan.rentWorthFrom', { year: result.breakEvenYear })
                : t('mortgagePlan.rentNotIn', { years: HORIZON_YEARS })
            }
            big
          />
          <ResultRow
            label={t('mortgagePlan.rentInterestShort')}
            value={t('mortgagePlan.rentInterestRatio', {
              ratio: ratio.toFixed(1),
            })}
            hint={t(vsRent.hint, {
              amount: formatMoney(Math.round(interestCents)),
            })}
            tone={vsRent.tone}
          />
          <Text style={text.subheading}>{t('mortgagePlan.rentAfter')}</Text>
          {MILESTONES.map((years) => {
            const row = result.rows[years - 1];
            if (!row) return null;
            const gain = row.advantageCents >= 0;
            return (
              <ResultRow
                key={years}
                label={t('mortgagePlan.rentAfterYears', { years })}
                value={t(
                  gain ? 'mortgagePlan.rentGain' : 'mortgagePlan.rentLose',
                  { amount: formatMoney(Math.abs(row.advantageCents)) },
                )}
                tone={gain ? 'positive' : 'negative'}
              />
            );
          })}
          <AssumptionNote text={t('mortgagePlan.rentNote')} />
        </>
      ) : null}
    </Section>
  );
}
