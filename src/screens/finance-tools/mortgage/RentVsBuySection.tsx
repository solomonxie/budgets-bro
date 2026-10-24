import { useMemo } from 'react';
import { Text } from 'react-native';
import { ResultRow } from '../../../components/ui/ResultRow';
import { AssumptionNote } from '../CalcScreen';
import { useCalcField } from '../useCalcField';
import { SliderField, steps } from './SliderField';
import { Section, text } from './parts';
import type { PlanInputs } from './planInputs';
import { periodicRate } from '../../../finance-tools/canadianMortgage';
import type { Compounding } from '../../../finance-tools/canadianMortgage';
import type { PlanResult } from '../../../finance-tools/mortgagePlan';
import { compareRentVsBuy } from '../../../finance-tools/rentVsBuy';
import { formatMoney } from '../../../domain/money';
import { useT } from '../../../i18n';

// Stated in mortgagePlan.rentNote.
const SELLING_COST_BPS = 500;

const RENT_STOPS = steps(0, 8000, 50);
const HORIZON_STOPS = steps(1, 30, 1);
const GROWTH_STOPS = steps(0, 10, 0.5);
const APPRECIATION_STOPS = steps(-5, 10, 0.5);
const RETURN_STOPS = steps(0, 12, 0.5);

// The functions shared with the US-style tools compound monthly; this is the
// nominal rate that gives the same monthly interest as the Canadian one.
function monthlyEquivalentBps(
  rateBps: number,
  compounding: Compounding,
): number {
  return Math.round(periodicRate(rateBps, 12, compounding) * 12 * 10000);
}

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
  const horizon = useCalcField('10', 'horizon');
  const { compounding, propertyTaxRate, otherExpenses, condoFees, heat } =
    inputs;

  const closingCosts = r.closing.totalCents - r.downCents;
  const result = useMemo(() => {
    if (rent.cents <= 0 || !r.ready) return null;
    return compareRentVsBuy({
      years: Math.max(1, horizon.int),
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
    horizon.int,
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
  const last = result?.rows[result.rows.length - 1];

  return (
    <Section
      title={t('mortgagePlan.rentHeading')}
      summary={
        result
          ? result.breakEvenYear != null
            ? t('mortgagePlan.rentBreakEven', { year: result.breakEvenYear })
            : t('mortgagePlan.rentNever', { years: horizon.int })
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
        label={t('mortgagePlan.horizonShort')}
        field={horizon}
        kind="number"
        stops={HORIZON_STOPS}
        unit={t('mortgagePlan.yearsUnit')}
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
      />
      {result ? (
        <>
          <ResultRow
            label={t('mortgagePlan.rentWhenPaysOff')}
            value={
              result.breakEvenYear != null
                ? t('mortgagePlan.yearN', { year: result.breakEvenYear })
                : t('mortgagePlan.rentNotIn', { years: horizon.int })
            }
            big
          />
          {last ? (
            <>
              <Text style={text.subheading}>
                {t('mortgagePlan.rentHaveAfter', { years: last.year })}
              </Text>
              <ResultRow
                label={t('mortgagePlan.rentIfBuy')}
                value={formatMoney(
                  last.buyerEquityCents + last.buyerPortfolioCents,
                )}
                hint={t('mortgagePlan.rentIfBuyHint')}
              />
              <ResultRow
                label={t('mortgagePlan.rentIfRent')}
                value={formatMoney(last.renterPortfolioCents)}
                hint={t('mortgagePlan.rentIfRentHint')}
              />
              <ResultRow
                label={t('mortgagePlan.rentBetter')}
                value={t(
                  last.advantageCents >= 0
                    ? 'mortgagePlan.rentBetterBuy'
                    : 'mortgagePlan.rentBetterRent',
                  { amount: formatMoney(Math.abs(last.advantageCents)) },
                )}
                tone="positive"
              />
            </>
          ) : null}
          <AssumptionNote text={t('mortgagePlan.rentNote')} />
        </>
      ) : null}
    </Section>
  );
}
