import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { CalcScreen } from '../CalcScreen';
import { useCalcChoice, useCalcForm } from '../calcForm';
import { useHeldHistory } from './useHeldHistory';
import { addExtrasToScheduled, extrasAsPayments } from './scheduleExtras';
import type { Extras } from './ScheduleSection';
import { heldTerms } from './heldTerms';
import type { HeldMortgage } from './heldTerms';
import { usePlanInputs } from './planInputs';
import { DEFAULT_OTHER_CLOSING_CENTS } from './constants';
import { parseMap, payoffTime } from './parts';
import { HeldCard } from './HeldCard';
import { FREQUENCIES, PurchaseInputs } from './PurchaseInputs';
import { IncomeSection, RunningCosts } from './CostAndIncomeSections';
import { SummaryCard } from './SummaryCard';
import { PayoffSection } from './PayoffSection';
import { TermSection } from './TermSection';
import { RentVsBuySection } from './RentVsBuySection';
import { QualifyLine } from './QualifyLine';
import { RefinanceSection } from './RefinanceSection';
import {
  extrasFromCalendar,
  extrasToCalendar,
  monthAt,
  monthIndex,
  mortgagePlan,
  nextRenewalMonth,
  pastRowsFromPayments,
  recurringAt,
  triggerRateBps,
} from '../../../finance-tools/mortgagePlan';
import type { CalendarExtras } from '../../../finance-tools/mortgagePlan';
import { parseMoneyToCents, formatMoney } from '../../../domain/money';
import { currentMonth, nextMonth } from '../../../domain/month';
import { useT } from '../../../i18n';
import { useAppStore } from '../../../state/useAppStore';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';

export type { HeldMortgage } from './heldTerms';

// One plan, every answer: fill the inputs once at the top and each section
// below is the same purchase seen from another side. A held mortgage (a real
// account) uses the same page with the purchase parts left out.
export function MortgagePlanView({
  held,
  top,
  footer,
}: {
  held?: HeldMortgage;
  /** Above the page body, scrolling with it: the banner and plan tabs. */
  top: ReactNode;
  footer: ReactNode;
}) {
  const t = useT();
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const history = useHeldHistory(held?.entry.account.id ?? null);
  const inputs = usePlanInputs();
  const {
    price,
    down,
    downUnit,
    rate,
    years,
    termYears,
    frequency,
    compounding,
    province,
    firstTime,
    toronto,
    propertyTaxRate,
    condoFees,
    heat,
    otherExpenses,
    rentalIncome,
    otherClosing,
    income,
    otherDebts,
  } = inputs;

  // Extras sit on calendar months, so a plan made in March still pays in
  // the month it named in June. The schedule counts from next month.
  const firstUpcoming = nextMonth(currentMonth());
  const [lumpsJson, setLumpsJson] = useCalcChoice<string>('extraLumps', '{}');
  const [recurringJson, setRecurringJson] = useCalcChoice<string>(
    'extraRecurring',
    '{}',
  );
  const calendarExtras = useMemo<CalendarExtras>(
    () => ({ lumps: parseMap(lumpsJson), recurring: parseMap(recurringJson) }),
    [lumpsJson, recurringJson],
  );
  const extras = useMemo<Extras>(
    () => extrasFromCalendar(calendarExtras, firstUpcoming),
    [calendarExtras, firstUpcoming],
  );
  const setExtras = useCallback(
    (next: Extras) => {
      const cal = extrasToCalendar(next, firstUpcoming, calendarExtras);
      setLumpsJson(JSON.stringify(cal.lumps));
      setRecurringJson(JSON.stringify(cal.recurring));
    },
    [firstUpcoming, calendarExtras, setLumpsJson, setRecurringJson],
  );
  useLegacyExtras(firstUpcoming, years.int * 12 || 300);

  const terms = useMemo(
    () =>
      held
        ? heldTerms(
            held.entry,
            held.rateBps ?? rate.bps,
            compounding,
            history?.usualPaymentCents ?? null,
          )
        : null,
    [held, rate.bps, compounding, history],
  );

  // A held mortgage's term began at its last rate change (a renewal sets a
  // new rate), or at the start; `termYears` is then the term's length.
  const renewalMonth = useMemo(() => {
    const account = held?.entry.account;
    if (!account) return null;
    const lastChange = history?.rates[history.rates.length - 1]?.effectiveDate;
    const start = (lastChange ?? account.originationDate)?.slice(0, 7);
    if (!start) return null;
    return nextRenewalMonth(
      start,
      Math.round(termYears.number * 12),
      currentMonth(),
    );
  }, [held, history, termYears.number]);

  const homeValueCents = held
    ? (held.homeValueCents ?? price.cents)
    : price.cents;
  // A real mortgage runs as long as its payment takes; the plan works it out.
  const amortizationMonths = terms ? 300 : Math.round(years.number * 12);
  const termMonths = renewalMonth
    ? Math.max(1, monthIndex(currentMonth(), renewalMonth) - 1)
    : Math.max(1, Math.round(termYears.number * 12));
  const effectiveRate = terms ? terms.rateBps : rate.bps;
  const otherClosingCents = otherClosing.filled
    ? otherClosing.cents
    : DEFAULT_OTHER_CLOSING_CENTS;

  // Every slider step re-renders the page; the plan only re-runs when one
  // of its own inputs moved.
  const r = useMemo(
    () =>
      mortgagePlan({
        priceCents: homeValueCents,
        down:
          downUnit === 'amount'
            ? { unit: 'amount', cents: down.cents }
            : { unit: 'percent', percent: down.number },
        rateBps: effectiveRate,
        amortizationMonths,
        termMonths,
        frequency: terms ? 'monthly' : frequency,
        compounding,
        province,
        firstTimeBuyer: firstTime === '1',
        inCity: toronto === '1',
        propertyTaxBps: propertyTaxRate.bps,
        condoFeesCents: condoFees.cents,
        heatCents: heat.cents,
        otherMonthlyCents: otherExpenses.cents,
        rentalIncomeCents: rentalIncome.cents,
        otherClosingCents,
        annualIncomeCents: income.cents,
        otherDebtsMonthlyCents: otherDebts.cents,
        prepayments: { monthlyCents: 0, yearlyCents: 0, ...extras },
        existing: terms
          ? { balanceCents: terms.owed, monthlyPaymentCents: terms.payment }
          : undefined,
      }),
    [
      homeValueCents,
      downUnit,
      down.cents,
      down.number,
      effectiveRate,
      amortizationMonths,
      termMonths,
      terms,
      frequency,
      compounding,
      province,
      firstTime,
      toronto,
      propertyTaxRate.bps,
      condoFees.cents,
      heat.cents,
      otherExpenses.cents,
      rentalIncome.cents,
      otherClosingCents,
      income.cents,
      otherDebts.cents,
      extras,
    ],
  );

  // Months already paid on a held mortgage, from the payments on record,
  // so the schedule starts where the ledger does rather than at today.
  const pastRows = useMemo(() => {
    if (!terms || !history?.firstPaidMonth) return [];
    const rates = history.rates;
    return pastRowsFromPayments({
      owedCents: terms.owed,
      paidByMonth: history.paidByMonth,
      fromMonth: history.firstPaidMonth,
      toMonth: currentMonth(),
      rateBpsAt: (month) =>
        rates.filter((x) => x.effectiveDate.slice(0, 7) <= month).pop()
          ?.rateBps ??
        rates[0]?.rateBps ??
        terms.rateBps,
      compounding,
    });
  }, [terms, compounding, history]);

  const pinned = r.ready ? (
    <View style={styles.pinned}>
      <Text style={styles.pinnedText} numberOfLines={1}>
        {t('mortgagePlan.pinnedMonthly', {
          amount: formatMoney(r.monthlyTotalCents),
        })}
        {terms
          ? `  ·  ${
              r.withPrepayments.paysOff
                ? t('mortgagePlan.timeLeft', {
                    time: payoffTime(t, r.withPrepayments),
                  })
                : payoffTime(t, r.withPrepayments)
            }`
          : `  ·  ${t('mortgagePlan.pinnedClose', {
              amount: formatMoney(r.closing.totalCents),
            })}`}
      </Text>
    </View>
  ) : null;

  // Future extras on the real mortgage, as scheduled payments to approve.
  const scheduleExtras = () => {
    if (!held || !history) return;
    const payingAccountId = history.payingAccountId;
    if (payingAccountId == null) {
      Alert.alert(t('mortgagePlan.scheduleNoPayer'));
      return;
    }
    const lastMonth = monthAt(firstUpcoming, r.withPrepayments.months);
    const payments = extrasAsPayments(calendarExtras, firstUpcoming, lastMonth);
    if (payments.length === 0) return;
    Alert.alert(
      t('mortgagePlan.scheduleTitle', { count: payments.length }),
      t('mortgagePlan.scheduleBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('mortgagePlan.scheduleConfirm'),
          onPress: async () => {
            const added = await addExtrasToScheduled({
              boardId,
              mortgageAccountId: held.entry.account.id,
              mortgageName: held.entry.account.name,
              payingAccountId,
              payments,
              memo: t('mortgagePlan.extraMemo'),
            });
            bumpDataVersion();
            Alert.alert(t('mortgagePlan.scheduleDone', { count: added }));
          },
        },
      ],
    );
  };

  const fixedRate = compounding === 'semiAnnual';
  const triggerBps =
    terms && !fixedRate ? triggerRateBps(terms.owed, terms.payment) : null;

  // Inputs start folded once a saved plan is opened; the results are what
  // you came back for. Each box folds on its own title.
  const [foldedAtOpen] = useState(r.ready);

  const payoff = (inline: boolean) => (
    <PayoffSection
      inline={inline}
      r={r}
      pastRows={pastRows}
      extras={extras}
      onChangeExtras={setExtras}
      firstUpcoming={firstUpcoming}
      rateBps={effectiveRate}
      compounding={compounding}
      onScheduleExtras={held ? scheduleExtras : undefined}
    />
  );

  const term = (inline: boolean) => (
    <TermSection
      inline={inline}
      r={r}
      renewalMonth={renewalMonth}
      termYears={termYears.number}
    />
  );

  return (
    <CalcScreen header={pinned} footer={footer}>
      {top}
      <View style={styles.body}>
        {held && terms ? (
          <>
            <HeldCard
              held={held}
              terms={terms}
              inputs={inputs}
              renewalMonth={renewalMonth}
              triggerBps={triggerBps}
            />
            <IncomeSection inputs={inputs} defaultOpen={!foldedAtOpen} />
          </>
        ) : (
          <>
            <PurchaseInputs
              inputs={inputs}
              r={r}
              defaultOpen={!foldedAtOpen}
              extras={
                <>
                  {payoff(true)}
                  {term(true)}
                  <IncomeSection
                    inline
                    inputs={inputs}
                    title={t('mortgagePlan.qualifyHeading')}
                  >
                    <QualifyLine r={r} />
                  </IncomeSection>
                </>
              }
            />
          </>
        )}
        <SummaryCard
          r={r}
          isHeld={terms != null}
          freqLabel={t(
            FREQUENCIES.find((f) => f.value === frequency)!.labelKey,
          )}
          frequencyIsMonthly={frequency === 'monthly'}
          hasIncome={income.cents > 0}
          homeValueCents={homeValueCents}
          runningCosts={
            <RunningCosts
              r={r}
              inputs={inputs}
              homeValueCents={homeValueCents}
            />
          }
        />
        {r.ready ? (
          <>
            {terms ? (
              <>
                {payoff(false)}
                {term(false)}
              </>
            ) : (
              <RentVsBuySection
                r={r}
                inputs={inputs}
                homeValueCents={homeValueCents}
                rateBps={effectiveRate}
                amortizationMonths={amortizationMonths}
              />
            )}
            {terms ? (
              <RefinanceSection
                terms={terms}
                remainingMonths={
                  r.baseline.paysOff ? r.baseline.months : amortizationMonths
                }
                termMonths={termMonths}
                fixedRate={fixedRate}
              />
            ) : null}
          </>
        ) : null}
      </View>
    </CalcScreen>
  );
}

// Extras saved before they were tied to calendar months: by month number
// from then, plus the two removed every-month / once-a-year boxes. Moved
// onto months counted from now, once.
function useLegacyExtras(first: string, months: number) {
  const form = useCalcForm();
  const values = form?.values;
  useEffect(() => {
    if (!form || !values) return;
    const lumpsText = values['@lumps'] ?? '';
    const recurringText = values['@recurring'] ?? '';
    const monthly = parseMoneyToCents(values.extraMonthly ?? '');
    const yearly = parseMoneyToCents(values.extraYearly ?? '');
    const stale =
      (lumpsText && lumpsText !== '{}') ||
      (recurringText && recurringText !== '{}') ||
      monthly > 0 ||
      yearly > 0;
    if (!stale) return;
    const recurring: Record<number, number> = parseMap(recurringText);
    if (monthly > 0 && recurring[1] == null) recurring[1] = monthly;
    const lumps: Record<number, number> = parseMap(lumpsText);
    if (yearly > 0)
      for (let m = 12; m <= months; m += 12)
        lumps[m] = (lumps[m] ?? recurringAt(recurring, m)) + yearly;
    const cal = extrasToCalendar({ lumps, recurring }, first, {
      lumps: parseMap(values['@extraLumps'] ?? '{}'),
      recurring: parseMap(values['@extraRecurring'] ?? '{}'),
    });
    form.set('@extraLumps', JSON.stringify(cal.lumps));
    form.set('@extraRecurring', JSON.stringify(cal.recurring));
    form.set('@lumps', '{}');
    form.set('@recurring', '{}');
    form.set('extraMonthly', '');
    form.set('extraYearly', '');
  }, [form, values, first, months]);
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  pinned: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pinnedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
