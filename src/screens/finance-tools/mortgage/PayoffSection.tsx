import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ResultRow } from '../../../components/ui/ResultRow';
import { useCalcField } from '../useCalcField';
import { BalanceChart } from './BalanceChart';
import { ScheduleSection } from './ScheduleSection';
import type { Extras } from './ScheduleSection';
import { SliderField, steps } from './SliderField';
import {
  InlineMore,
  Section,
  payoffTime,
  text,
  yearsMonths,
} from './parts';
import {
  extraMonthlyToPayOffBy,
  monthAt,
  monthIndex,
} from '../../../finance-tools/mortgagePlan';
import type {
  PlanResult,
  ScheduleRow,
} from '../../../finance-tools/mortgagePlan';
import type { Compounding } from '../../../finance-tools/canadianMortgage';
import { formatMoney } from '../../../domain/money';
import { useT } from '../../../i18n';
import { spacing } from '../../../theme/spacing';

// The schedule: balance over time, a year to pay it off by, and every
// month, where extra payments are planned.
export function PayoffSection({
  r,
  pastRows,
  extras,
  onChangeExtras,
  firstUpcoming,
  rateBps,
  compounding,
  onScheduleExtras,
  inline,
}: {
  r: PlanResult;
  pastRows: ScheduleRow[];
  extras: Extras;
  onChangeExtras: (next: Extras) => void;
  firstUpcoming: string;
  rateBps: number;
  compounding: Compounding;
  /** A real mortgage only: turn planned extras into scheduled payments. */
  onScheduleExtras?: () => void;
  /** Folded into the loan box as a link rather than a card of its own. */
  inline?: boolean;
}) {
  const t = useT();
  const payoffBy = useCalcField('', 'payoffBy');
  const hasPrepayments =
    r.withPrepayments.months !== r.baseline.months ||
    r.withPrepayments.interestCents !== r.baseline.interestCents;

  const baseline = useMemo(
    () => [...pastRows, ...r.baselineSchedule],
    [pastRows, r.baselineSchedule],
  );
  const planned = useMemo(
    () => (hasPrepayments ? [...pastRows, ...r.schedule] : null),
    [hasPrepayments, pastRows, r.schedule],
  );

  const thisYear = Number(firstUpcoming.slice(0, 4));
  const yearsLeft = Math.ceil(r.withPrepayments.months / 12);
  const firstStop = thisYear + 1;
  const lastStop = thisYear + Math.max(2, yearsLeft);
  const payoffStops = useMemo(
    () => steps(firstStop, lastStop, 1),
    [firstStop, lastStop],
  );

  const payoffTarget =
    payoffBy.int > 0 ? monthIndex(firstUpcoming, `${payoffBy.int}-12`) : 0;
  const principalCents = r.insurance.totalMortgageCents;
  const paymentCents = r.monthlyPaymentCents;
  const payoffExtra = useMemo(
    () =>
      r.ready && payoffTarget > 0
        ? extraMonthlyToPayOffBy(
            principalCents,
            rateBps,
            compounding,
            paymentCents,
            payoffTarget,
          )
        : null,
    [r.ready, payoffTarget, principalCents, rateBps, compounding, paymentCents],
  );

  const Wrapper = inline ? InlineMore : Section;
  return (
    <Wrapper
      title={t('mortgagePlan.scheduleHeading')}
      summary={
        r.withPrepayments.paysOff
          ? t('mortgagePlan.timeLeft', {
              time: yearsMonths(t, r.withPrepayments.months),
            })
          : payoffTime(t, r.withPrepayments)
      }
    >
      <BalanceChart
        startCents={
          pastRows.length > 0
            ? pastRows[0].balanceCents + pastRows[0].principalCents
            : r.insurance.totalMortgageCents
        }
        baseline={baseline}
        planned={planned}
        firstYear={Number(
          monthAt(firstUpcoming, 1 - pastRows.length).slice(0, 4),
        )}
        todayYears={pastRows.length / 12}
      />
      <SliderField
        label={t('mortgagePlan.payoffBy')}
        field={payoffBy}
        kind="number"
        stops={payoffStops}
        empty={Math.min(
          lastStop,
          Math.max(firstStop, thisYear + yearsLeft - 5),
        )}
      />
      {payoffBy.int > 0 ? (
        payoffExtra != null ? (
          <Text style={text.hint}>
            {t('mortgagePlan.payoffNeeds', {
              amount: formatMoney(payoffExtra),
              year: payoffBy.int,
            })}{' '}
            <Text
              style={text.link}
              onPress={() =>
                onChangeExtras({
                  lumps: extras.lumps,
                  recurring: { 1: payoffExtra },
                })
              }
            >
              {t('mortgagePlan.payoffPlanIt')}
            </Text>
          </Text>
        ) : (
          <Text style={text.hint}>
            {t('mortgagePlan.payoffAlready', { year: payoffBy.int })}
          </Text>
        )
      ) : null}
      <Text style={text.hint}>{t('mortgagePlan.scheduleHint')}</Text>
      {hasPrepayments && onScheduleExtras ? (
        <Pressable style={styles.actionLink} onPress={onScheduleExtras}>
          <Text style={text.link}>{t('mortgagePlan.scheduleExtras')}</Text>
        </Pressable>
      ) : null}
      {hasPrepayments ? (
        <>
          <ResultRow
            label={t('financeTools.timeSaved')}
            value={yearsMonths(t, r.baseline.months - r.withPrepayments.months)}
            tone="positive"
          />
          <ResultRow
            label={t('financeTools.interestSaved')}
            value={formatMoney(
              r.baseline.interestCents - r.withPrepayments.interestCents,
            )}
            tone="positive"
          />
        </>
      ) : null}
      <ScheduleSection
        rows={r.schedule}
        pastRows={pastRows}
        firstMonth={monthAt(firstUpcoming, 1 - pastRows.length)}
        extras={extras}
        onChangeExtras={onChangeExtras}
      />
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  actionLink: { alignSelf: 'flex-start', paddingTop: spacing.xs },
});
