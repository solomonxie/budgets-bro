import { useMemo } from 'react';
import { Text } from 'react-native';
import { ResultRow } from '../../../components/ui/ResultRow';
import { useCalcField } from '../useCalcField';
import { SliderField, steps } from './SliderField';
import { Section, text, yearsMonths } from './parts';
import { RATE_STOPS } from './constants';
import type { HeldTerms } from './heldTerms';
import { breakPenaltyCents } from '../../../finance-tools/mortgagePlan';
import { compareRefinance } from '../../../finance-tools/refinance';
import { formatMoney } from '../../../domain/money';
import { useT } from '../../../i18n';

const SWITCH_COST_STOPS = steps(0, 10_000, 250);

// A real mortgage: what switching to a new rate saves, after the penalty
// for breaking the term.
export function RefinanceSection({
  terms,
  remainingMonths,
  termMonths,
  fixedRate,
}: {
  terms: HeldTerms;
  remainingMonths: number;
  termMonths: number;
  fixedRate: boolean;
}) {
  const t = useT();
  const newRate = useCalcField('', 'newRate');
  const refiCosts = useCalcField('', 'refiCosts');

  const refinance = useMemo(() => {
    if (newRate.bps <= 0) return null;
    const penalty = breakPenaltyCents({
      balanceCents: terms.owed,
      rateBps: terms.rateBps,
      comparisonRateBps: newRate.bps,
      monthsLeftInTerm: termMonths,
      fixed: fixedRate,
    });
    return {
      penalty,
      ...compareRefinance({
        balanceCents: terms.owed,
        currentRateBps: terms.rateBps,
        currentRemainingMonths: remainingMonths,
        newRateBps: newRate.bps,
        newTermMonths: remainingMonths,
        closingCostsCents: refiCosts.cents + penalty.penaltyCents,
        rollCostsIntoLoan: false,
      }),
    };
  }, [
    terms.owed,
    terms.rateBps,
    newRate.bps,
    refiCosts.cents,
    termMonths,
    fixedRate,
    remainingMonths,
  ]);

  return (
    <Section
      title={t('mortgagePlan.refinanceHeading')}
      summary={
        !refinance
          ? ''
          : refinance.monthlySavingCents > 0
            ? t('mortgagePlan.perMonthLess', {
                amount: formatMoney(refinance.monthlySavingCents),
              })
            : t('mortgagePlan.refiNoSaving')
      }
    >
      <SliderField
        label={t('financeTools.newRate')}
        field={newRate}
        kind="percent"
        stops={RATE_STOPS}
        empty={3.9}
      />
      <SliderField
        label={t('mortgagePlan.switchCosts')}
        field={refiCosts}
        kind="money"
        stops={SWITCH_COST_STOPS}
        empty={3000}
      />
      <Text style={text.hint}>{t('mortgagePlan.switchCostsHint')}</Text>
      {refinance ? (
        <>
          <ResultRow
            label={t('mortgagePlan.breakPenalty')}
            value={formatMoney(refinance.penalty.penaltyCents)}
            tone="negative"
            hint={
              fixedRate
                ? t('mortgagePlan.breakPenaltyFixed', {
                    three: formatMoney(refinance.penalty.threeMonthsCents),
                    ird: formatMoney(refinance.penalty.irdCents),
                  })
                : t('mortgagePlan.breakPenaltyVariable')
            }
          />
          <ResultRow
            label={t('financeTools.newPayment')}
            value={formatMoney(refinance.newPaymentCents)}
          />
          <ResultRow
            label={t('financeTools.monthlySaving')}
            value={formatMoney(refinance.monthlySavingCents)}
            tone={refinance.monthlySavingCents > 0 ? 'positive' : 'negative'}
          />
          <ResultRow
            label={t('financeTools.breakEven')}
            value={
              refinance.breakEvenMonths != null
                ? yearsMonths(t, refinance.breakEvenMonths)
                : t('mortgagePlan.refiNever')
            }
          />
          <ResultRow
            label={t('financeTools.lifetimeInterestSaved')}
            value={formatMoney(refinance.lifetimeInterestSavedCents)}
            tone={
              refinance.lifetimeInterestSavedCents >= 0
                ? 'positive'
                : 'negative'
            }
          />
        </>
      ) : null}
    </Section>
  );
}
