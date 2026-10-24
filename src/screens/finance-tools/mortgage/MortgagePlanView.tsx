import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '../../../components/ui/Card';
import { ResultRow } from '../../../components/ui/ResultRow';
import {
  DropdownField,
  DropdownOption,
} from '../../../components/ui/DropdownField';
import { AssumptionNote, CalcScreen } from '../CalcScreen';
import { useCalcField } from '../useCalcField';
import type { CalcField } from '../useCalcField';
import { useCalcChoice, useCalcForm } from '../calcForm';
import { ScheduleSection } from './ScheduleSection';
import { BalanceChart } from './BalanceChart';
import { useHeldHistory } from './useHeldHistory';
import { addExtrasToScheduled, extrasAsPayments } from './scheduleExtras';
import { SliderField, steps } from './SliderField';
import type { Extras } from './ScheduleSection';
import {
  NO_TRANSFER_TAX_PROVINCES,
  TRANSFER_TAX_AS_OF,
  paymentPlan,
  periodicRate,
} from '../../../finance-tools/canadianMortgage';
import type {
  Compounding,
  PaymentFrequency,
} from '../../../finance-tools/canadianMortgage';
import {
  breakPenaltyCents,
  extraMonthlyToPayOffBy,
  extrasFromCalendar,
  maxAmortizationMonths,
  monthIndex,
  nextRenewalMonth,
  pastRowsFromPayments,
  triggerRateBps,
  extrasToCalendar,
  monthAt,
  monthlySchedule,
  mortgagePlan,
  recurringAt,
} from '../../../finance-tools/mortgagePlan';
import type { CalendarExtras } from '../../../finance-tools/mortgagePlan';
import { parseMoneyToCents } from '../../../domain/money';
import type { Prepayments } from '../../../finance-tools/mortgagePlan';
import { compareRentVsBuy } from '../../../finance-tools/rentVsBuy';
import { compareRefinance } from '../../../finance-tools/refinance';
import {
  currentMonth,
  formatMonthLabel,
  nextMonth,
} from '../../../domain/month';
import type { AccountWithBalance } from '../../../db/repositories/accountsRepo';
import { formatMoney, formatPercent } from '../../../domain/money';
import { useT } from '../../../i18n';
import { useAppStore } from '../../../state/useAppStore';
import type { TranslationKey } from '../../../i18n';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';

type DownUnit = 'percent' | 'amount';

const PROVINCES = [
  'BC',
  'AB',
  'SK',
  'MB',
  'ON',
  'QC',
  'NB',
  'NS',
  'PE',
  'NL',
] as const;

const FREQUENCIES: { value: PaymentFrequency; labelKey: TranslationKey }[] = [
  { value: 'monthly', labelKey: 'frequency.monthly' },
  { value: 'semiMonthly', labelKey: 'frequency.semiMonthly' },
  { value: 'biweekly', labelKey: 'frequency.biweekly' },
  { value: 'acceleratedBiweekly', labelKey: 'frequency.acceleratedBiweekly' },
  { value: 'weekly', labelKey: 'frequency.weekly' },
  { value: 'acceleratedWeekly', labelKey: 'frequency.acceleratedWeekly' },
];

const DEFAULT_OTHER_CLOSING_CENTS = 250_000;

const RATE_STOPS = steps(0.5, 10, 0.05);
const DOWN_STOPS = steps(5, 50, 1);
const INCOME_STOPS = [
  ...steps(0, 300_000, 5_000),
  ...steps(325_000, 1_000_000, 25_000),
];
const AMORTIZATION_YEARS = [15, 20, 25, 30];
const TERM_YEARS = [1, 2, 3, 4, 5, 7, 10];

export interface HeldMortgage {
  entry: AccountWithBalance;
  rateBps: number | null;
  homeValueCents: number | null;
}

// The functions shared with the US-style tools compound monthly; this is the
// nominal rate that gives the same monthly interest as the Canadian one.
function monthlyEquivalentBps(
  rateBps: number,
  compounding: Compounding,
): number {
  return Math.round(periodicRate(rateBps, 12, compounding) * 12 * 10000);
}

function yearsMonths(t: ReturnType<typeof useT>, months: number): string {
  return t('canadaPurchase.yearsMonths', {
    years: Math.floor(months / 12),
    months: months % 12,
  });
}

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
  const payoffBy = useCalcField('', 'payoffBy');
  const price = useCalcField('', 'price');
  const down = useCalcField('', 'down');
  const [downUnit, setDownUnit] = useCalcChoice<DownUnit>(
    'downUnit',
    'percent',
  );
  // The slider works in percent; an amount typed earlier (or "use the
  // minimum") is shown as the percent it comes to.
  const downPercentNumber =
    downUnit === 'percent'
      ? down.number
      : price.cents > 0
        ? Number(((down.cents / price.cents) * 100).toFixed(1))
        : 0;
  const downPercent: CalcField = {
    ...down,
    text: downUnit === 'percent' ? down.text : String(downPercentNumber),
    number: downPercentNumber,
    set: (text) => {
      setDownUnit('percent');
      down.set(text);
    },
  };
  const rate = useCalcField('', 'rate');
  const years = useCalcField('25', 'years');
  const termYears = useCalcField('5', 'termYears');
  const [frequency, setFrequency] = useCalcChoice<PaymentFrequency>(
    'frequency',
    'monthly',
  );
  const [compounding, setCompounding] = useCalcChoice<Compounding>(
    'compounding',
    'semiAnnual',
  );
  const [province, setProvince] = useCalcChoice<string>('province', 'BC');
  const [firstTime, setFirstTime] = useCalcChoice<'0' | '1'>(
    'firstTimeBuyer',
    '0',
  );
  const [toronto, setToronto] = useCalcChoice<'0' | '1'>('toronto', '0');

  const propertyTaxRate = useCalcField('', 'propertyTaxRate');
  const condoFees = useCalcField('', 'condoFees');
  const heat = useCalcField('', 'heat');
  const otherExpenses = useCalcField('', 'otherExpenses');
  const rentalIncome = useCalcField('', 'rentalIncome');
  const otherClosing = useCalcField('', 'otherClosing');
  const income = useCalcField('', 'income');
  const otherDebts = useCalcField('', 'otherDebts');

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
  const setExtras = (next: Extras) => {
    const cal = extrasToCalendar(next, firstUpcoming, calendarExtras);
    setLumpsJson(JSON.stringify(cal.lumps));
    setRecurringJson(JSON.stringify(cal.recurring));
  };
  useLegacyExtras(firstUpcoming, years.int * 12 || 300);

  const rent = useCalcField('', 'rent');
  const rentGrowth = useCalcField('3', 'rentGrowth');
  const appreciation = useCalcField('3', 'appreciation');
  const investReturn = useCalcField('5', 'investReturn');
  const horizon = useCalcField('10', 'horizon');

  const newRate = useCalcField('', 'newRate');
  const refiCosts = useCalcField('', 'refiCosts');

  // A held mortgage fills itself from the account: what's owed, the rate on
  // file, the payment its original terms set, and what the home is worth.
  const heldFigures = useMemo(() => {
    if (!held) return null;
    const { account, balanceCents } = held.entry;
    const owed = Math.max(0, -balanceCents);
    const rateBps = held.rateBps ?? rate.bps;
    const payment =
      account.originalPrincipalCents != null && account.termMonths != null
        ? paymentPlan(
            account.originalPrincipalCents,
            rateBps,
            account.termMonths,
            'monthly',
            compounding,
          ).paymentCents
        : paymentPlan(owed, rateBps, 300, 'monthly', compounding).paymentCents;
    // What is actually paid, when the ledger shows it, beats what the
    // original terms work out to (an accelerated or rounded-up payment).
    const usual = history?.usualPaymentCents ?? null;
    const actual = usual != null && usual > 0 ? usual : payment;
    const rows = monthlySchedule(owed, rateBps, compounding, actual);
    const paidOff = rows.length > 0 && rows[rows.length - 1].balanceCents === 0;
    return {
      owed,
      rateBps,
      payment: actual,
      contractPayment: payment,
      paymentFromLedger: actual !== payment,
      remainingMonths: paidOff ? rows.length : 300,
      homeValueCents: held.homeValueCents,
    };
  }, [held, rate.bps, compounding, history]);

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

  const homeValueCents = heldFigures?.homeValueCents ?? price.cents;
  const prepayments: Prepayments = {
    monthlyCents: 0,
    yearlyCents: 0,
    ...extras,
  };
  const amortizationMonths = heldFigures
    ? heldFigures.remainingMonths
    : Math.round(years.number * 12);
  const termMonths = renewalMonth
    ? Math.max(1, monthIndex(currentMonth(), renewalMonth) - 1)
    : Math.max(1, Math.round(termYears.number * 12));
  const effectiveRate = heldFigures ? heldFigures.rateBps : rate.bps;

  const r = mortgagePlan({
    priceCents: homeValueCents,
    down:
      downUnit === 'amount'
        ? { unit: 'amount', cents: down.cents }
        : { unit: 'percent', percent: down.number },
    rateBps: effectiveRate,
    amortizationMonths,
    termMonths,
    frequency: heldFigures ? 'monthly' : frequency,
    compounding,
    province,
    firstTimeBuyer: firstTime === '1',
    toronto: toronto === '1',
    propertyTaxBps: propertyTaxRate.bps,
    condoFeesCents: condoFees.cents,
    heatCents: heat.cents,
    otherMonthlyCents: otherExpenses.cents,
    rentalIncomeCents: rentalIncome.cents,
    otherClosingCents: otherClosing.filled
      ? otherClosing.cents
      : DEFAULT_OTHER_CLOSING_CENTS,
    annualIncomeCents: income.cents,
    otherDebtsMonthlyCents: otherDebts.cents,
    prepayments,
    existing: heldFigures
      ? {
          balanceCents: heldFigures.owed,
          monthlyPaymentCents: heldFigures.payment,
        }
      : undefined,
  });

  const hasPrepayments =
    r.withPrepayments.months !== r.baseline.months ||
    r.withPrepayments.interestCents !== r.baseline.interestCents;

  // Months already paid on a held mortgage, from the payments on record,
  // so the schedule starts where the ledger does rather than at today.
  const pastRows = useMemo(() => {
    if (!heldFigures || !history?.firstPaidMonth) return [];
    const rates = history.rates;
    return pastRowsFromPayments({
      owedCents: heldFigures.owed,
      paidByMonth: history.paidByMonth,
      fromMonth: history.firstPaidMonth,
      toMonth: currentMonth(),
      rateBpsAt: (month) =>
        rates.filter((r) => r.effectiveDate.slice(0, 7) <= month).pop()
          ?.rateBps ??
        rates[0]?.rateBps ??
        heldFigures.rateBps,
      compounding,
    });
  }, [heldFigures, compounding, history]);

  const pinned = r.ready ? (
    <View style={styles.pinned}>
      <Text style={styles.pinnedText} numberOfLines={1}>
        {t('mortgagePlan.pinnedMonthly', {
          amount: formatMoney(r.monthlyTotalCents),
        })}
        {heldFigures
          ? `  ·  ${t('mortgagePlan.timeLeft', {
              time: yearsMonths(t, r.withPrepayments.months),
            })}`
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
  const freqLabel = t(FREQUENCIES.find((f) => f.value === frequency)!.labelKey);

  const rentVsBuy = useMemo(() => {
    if (heldFigures || rent.cents <= 0 || !r.ready) return null;
    const closingCosts = r.closing.totalCents - r.downCents;
    return compareRentVsBuy({
      years: Math.max(1, horizon.int),
      monthlyRentCents: rent.cents,
      annualRentGrowthBps: rentGrowth.bps,
      priceCents: homeValueCents,
      downPaymentCents: r.downCents,
      annualRateBps: monthlyEquivalentBps(effectiveRate, compounding),
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
      sellingCostBps: 500,
      annualInvestmentReturnBps: investReturn.bps,
    });
  }, [
    heldFigures,
    rent.cents,
    r.ready,
    r.closing.totalCents,
    r.downCents,
    horizon.int,
    rentGrowth.bps,
    homeValueCents,
    effectiveRate,
    compounding,
    amortizationMonths,
    propertyTaxRate.bps,
    otherExpenses.cents,
    condoFees.cents,
    heat.cents,
    appreciation.bps,
    investReturn.bps,
  ]);

  const fixedRate = compounding === 'semiAnnual';
  const refinance = useMemo(() => {
    if (!heldFigures || newRate.bps <= 0) return null;
    const penalty = breakPenaltyCents({
      balanceCents: heldFigures.owed,
      rateBps: heldFigures.rateBps,
      comparisonRateBps: newRate.bps,
      monthsLeftInTerm: termMonths,
      fixed: fixedRate,
    });
    return {
      penalty,
      ...compareRefinance({
        balanceCents: heldFigures.owed,
        currentRateBps: heldFigures.rateBps,
        currentRemainingMonths: heldFigures.remainingMonths,
        newRateBps: newRate.bps,
        newTermMonths: heldFigures.remainingMonths,
        closingCostsCents: refiCosts.cents + penalty.penaltyCents,
        rollCostsIntoLoan: false,
      }),
    };
  }, [heldFigures, newRate.bps, refiCosts.cents, termMonths, fixedRate]);

  const insuranceNote: TranslationKey | null =
    r.insurance.status === 'priceTooHigh'
      ? 'canadaPurchase.noteOverCeiling'
      : r.insurance.status === 'downTooSmall'
        ? 'canadaPurchase.noteBelowMinimum'
        : null;

  // Inputs start folded once a saved plan is opened; the results are what
  // you came back for. Each box folds on its own title.
  const [foldedAtOpen] = useState(r.ready);
  const loanSummary = [
    down.filled
      ? t('mortgagePlan.foldDownPercent', { percent: downPercent.number })
      : null,
    rate.filled ? formatPercent(rate.bps) : null,
    years.int > 0 ? t('mortgagePlan.foldYears', { years: years.int }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const otherMonthlyCents = r.monthlyTotalCents - r.monthlyPaymentCents;

  const insured = r.insurance.status === 'insured';
  const amortizationCap = maxAmortizationMonths(insured, firstTime === '1');
  const overAmortization =
    !heldFigures && r.ready && Math.round(years.number * 12) > amortizationCap;
  const belowMinimumDown =
    !heldFigures && price.cents > 0 && r.downCents < r.minimumDownCents;
  const overQualifying =
    !heldFigures &&
    r.qualifying.maxPriceCents != null &&
    price.cents > r.qualifying.maxPriceCents;
  const trigger =
    heldFigures && !fixedRate
      ? triggerRateBps(heldFigures.owed, heldFigures.payment)
      : null;
  const payoffTarget =
    payoffBy.int > 0 ? monthIndex(firstUpcoming, `${payoffBy.int}-12`) : 0;
  const payoffExtra =
    r.ready && payoffTarget > 0
      ? extraMonthlyToPayOffBy(
          r.insurance.totalMortgageCents,
          effectiveRate,
          compounding,
          r.monthlyPaymentCents,
          payoffTarget,
        )
      : null;

  return (
    <CalcScreen header={pinned} footer={footer}>
      {top}
      <View style={styles.body}>
        {heldFigures ? (
          <Card title={held!.entry.account.name}>
            <ResultRow
              label={t('financeTools.balance')}
              value={formatMoney(heldFigures.owed)}
              big
            />
            <ResultRow
              label={t('financeTools.rate')}
              value={formatPercent(heldFigures.rateBps)}
            />
            <ResultRow
              label={t('mortgagePlan.monthlyPayment')}
              value={formatMoney(heldFigures.payment)}
              hint={t(
                heldFigures.paymentFromLedger
                  ? 'mortgagePlan.paymentFromLedger'
                  : 'mortgagePlan.paymentFromTerms',
              )}
            />
            {renewalMonth ? (
              <ResultRow
                label={t('mortgagePlan.renews')}
                value={formatMonthLabel(renewalMonth)}
                hint={t('mortgagePlan.renewsHint')}
              />
            ) : null}
            {trigger != null ? (
              <ResultRow
                label={t('mortgagePlan.triggerRate')}
                value={formatPercent(trigger)}
                tone={heldFigures.rateBps >= trigger ? 'negative' : 'muted'}
                hint={t(
                  heldFigures.rateBps >= trigger
                    ? 'mortgagePlan.triggerHit'
                    : 'mortgagePlan.triggerHint',
                )}
              />
            ) : null}
            {heldFigures.homeValueCents != null ? (
              <ResultRow
                label={t('financeTools.equity')}
                value={formatMoney(
                  heldFigures.homeValueCents - heldFigures.owed,
                )}
                tone={
                  heldFigures.homeValueCents >= heldFigures.owed
                    ? 'positive'
                    : 'negative'
                }
              />
            ) : (
              <SliderField
                label={t('mortgagePlan.homeValue')}
                field={price}
                kind="money"
                around={10_000}
                empty={800_000}
              />
            )}
            {held!.rateBps == null ? (
              <SliderField
                label={t('calculators.interestRateLabel')}
                field={rate}
                kind="percent"
                stops={RATE_STOPS}
                empty={4.5}
              />
            ) : null}
            {renewalMonth ? (
              <YearChoice
                label={t('mortgagePlan.termLengthYears')}
                field={termYears}
                years={TERM_YEARS}
                hint={t('mortgagePlan.termLengthHint')}
              />
            ) : (
              <SliderField
                label={t('mortgagePlan.termLeftYears')}
                field={termYears}
                kind="number"
                stops={steps(0, 10, 0.5)}
                unit={t('mortgagePlan.yearsUnit')}
                hint={t('mortgagePlan.termLeftHint')}
              />
            )}
            <Chips
              options={[
                { value: 'semiAnnual', label: t('canadaPurchase.rateFixed') },
                { value: 'monthly', label: t('canadaPurchase.rateVariable') },
              ]}
              value={compounding}
              onChange={(v) => setCompounding(v as Compounding)}
            />
            <AssumptionNote text={t('mortgagePlan.heldNote')} />
          </Card>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>
                {t('financeTools.homePrice')}
              </Text>
              <View style={styles.heroRow}>
                <Text style={styles.heroSymbol}>$</Text>
                <TextInput
                  style={styles.heroInput}
                  value={withThousands(price.text)}
                  onChangeText={(text) => price.set(withThousands(text))}
                  keyboardType="number-pad"
                  keyboardAppearance="dark"
                  placeholder="800,000"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <SliderField
                label=""
                field={price}
                kind="money"
                around={10_000}
                empty={800_000}
              />
              {overQualifying ? (
                <Text style={styles.warn}>
                  {t('mortgagePlan.overQualifying', {
                    amount: formatMoney(r.qualifying.maxPriceCents!),
                  })}
                </Text>
              ) : null}
            </View>

            <Section
              title={t('mortgagePlan.loanHeading')}
              summary={loanSummary}
              defaultOpen={!foldedAtOpen}
            >
              <SliderField
                label={t('financeTools.downPayment')}
                field={downPercent}
                kind="percent"
                stops={DOWN_STOPS}
                empty={20}
                display={
                  down.filled && price.cents > 0
                    ? `${downPercent.text}% · ${formatMoney(r.downCents)}`
                    : undefined
                }
              />
              {price.cents > 0 ? (
                <Text style={[styles.hint, belowMinimumDown && styles.warn]}>
                  <Text
                    style={styles.link}
                    onPress={() => {
                      setDownUnit('amount');
                      down.set(
                        withThousands(
                          String(Math.round(r.minimumDownCents / 100)),
                        ),
                      );
                    }}
                  >
                    {t('canadaPurchase.useMinimum', {
                      amount: formatMoney(r.minimumDownCents),
                    })}
                  </Text>
                </Text>
              ) : null}
              <SliderField
                label={t('calculators.interestRateLabel')}
                field={rate}
                kind="percent"
                stops={RATE_STOPS}
                empty={4.5}
              />
              <YearChoice
                label={t('calcAmortization.title')}
                field={years}
                years={AMORTIZATION_YEARS}
              />
              <YearChoice
                label={t('mortgagePlan.termShort')}
                field={termYears}
                years={TERM_YEARS}
              />
              {overAmortization ? (
                <Text style={styles.warn}>
                  {t(
                    insured
                      ? 'mortgagePlan.amortizationInsured'
                      : 'mortgagePlan.amortizationMax',
                    { years: amortizationCap / 12 },
                  )}
                </Text>
              ) : null}
              <Chips
                options={[
                  {
                    value: 'semiAnnual',
                    label: t('canadaPurchase.rateFixed'),
                  },
                  {
                    value: 'monthly',
                    label: t('canadaPurchase.rateVariable'),
                  },
                ]}
                value={compounding}
                onChange={(v) => setCompounding(v as Compounding)}
              />
              <DropdownField
                compact
                label={t('canadaPurchase.paymentFrequency')}
                valueLabel={freqLabel}
              >
                {(close) => (
                  <>
                    {FREQUENCIES.map((f) => (
                      <DropdownOption
                        key={f.value}
                        label={t(f.labelKey)}
                        selected={frequency === f.value}
                        onPress={() => {
                          setFrequency(f.value);
                          close();
                        }}
                      />
                    ))}
                  </>
                )}
              </DropdownField>
              <DropdownField
                compact
                label={t('canadaPurchase.province')}
                valueLabel={t(`province.${province}` as TranslationKey)}
              >
                {(close) => (
                  <>
                    {PROVINCES.map((p) => (
                      <DropdownOption
                        key={p}
                        label={t(`province.${p}` as TranslationKey)}
                        selected={province === p}
                        onPress={() => {
                          setProvince(p);
                          close();
                        }}
                      />
                    ))}
                  </>
                )}
              </DropdownField>
              <View style={styles.toggles}>
                <Toggle
                  label={t('canadaPurchase.firstTimeBuyer')}
                  on={firstTime === '1'}
                  onPress={() => setFirstTime(firstTime === '1' ? '0' : '1')}
                />
                {province === 'ON' ? (
                  <Toggle
                    label={t('canadaPurchase.toronto')}
                    on={toronto === '1'}
                    onPress={() => setToronto(toronto === '1' ? '0' : '1')}
                  />
                ) : null}
              </View>
            </Section>
          </>
        )}

        <Section
          title={t('canadaPurchase.monthlyCostsHeading')}
          summary={
            r.ready
              ? t('common.perMonth', {
                  amount: formatMoney(otherMonthlyCents),
                })
              : ''
          }
          defaultOpen={!foldedAtOpen}
        >
          <SliderField
            label={t('canadaPurchase.propertyTaxRate')}
            field={propertyTaxRate}
            kind="percent"
            stops={steps(0, 2, 0.05)}
            empty={0.7}
            hint={
              r.propertyTaxMonthlyCents > 0
                ? t('canadaPurchase.propertyTaxHintPrice', {
                    amount: formatMoney(r.propertyTaxMonthlyCents),
                  })
                : t('canadaPurchase.propertyTaxHint')
            }
          />
          <SliderField
            label={t('mortgagePlan.condoShort')}
            field={condoFees}
            kind="money"
            stops={steps(0, 1500, 25)}
          />
          <SliderField
            label={t('mortgagePlan.heatShort')}
            field={heat}
            kind="money"
            stops={steps(0, 400, 10)}
            empty={100}
          />
          <Text style={styles.hint}>{t('mortgagePlan.condoHeatHint')}</Text>
          <SliderField
            label={t('mortgagePlan.otherShort')}
            field={otherExpenses}
            kind="money"
            stops={steps(0, 2000, 25)}
            empty={
              homeValueCents > 0
                ? Math.round((homeValueCents * 0.01) / 12 / 100)
                : 0
            }
          />
          <SliderField
            label={t('mortgagePlan.rentalShort')}
            field={rentalIncome}
            kind="money"
            stops={steps(0, 5000, 50)}
          />
          <Text style={styles.hint}>{t('mortgagePlan.otherRentalHint')}</Text>
        </Section>

        <Section
          title={t('mortgagePlan.youHeading')}
          summary={income.cents > 0 ? formatMoney(income.cents) : ''}
          defaultOpen={!foldedAtOpen}
        >
          <SliderField
            label={t('mortgagePlan.incomeShort')}
            field={income}
            kind="money"
            stops={INCOME_STOPS}
            empty={150_000}
          />
          <SliderField
            label={t('mortgagePlan.debtsShort')}
            field={otherDebts}
            kind="money"
            stops={steps(0, 5000, 50)}
          />
          <Text style={styles.hint}>{t('mortgagePlan.youHint')}</Text>
        </Section>

        {/* The answers, live. */}
        <Card style={styles.summary}>
          {!r.ready ? (
            <Text style={styles.hint}>{t('financeTools.enterInputs')}</Text>
          ) : (
            <>
              <ResultRow
                label={t('canadaPurchase.totalMonthlyCost')}
                value={formatMoney(r.monthlyTotalCents)}
                big
              />
              {heldFigures ? (
                <>
                  <ResultRow
                    label={t('mortgagePlan.paidOffIn')}
                    value={yearsMonths(t, r.withPrepayments.months)}
                    tone={hasPrepayments ? 'positive' : 'default'}
                  />
                  <ResultRow
                    label={t('mortgagePlan.interestLeft')}
                    value={formatMoney(r.withPrepayments.interestCents)}
                    tone="negative"
                  />
                </>
              ) : (
                <>
                  <ResultRow
                    label={t('canadaPurchase.paymentEach', {
                      frequency: freqLabel,
                    })}
                    value={formatMoney(r.payment.paymentCents)}
                  />
                  {frequency !== 'monthly' ? (
                    <ResultRow
                      label={t('canadaPurchase.paymentPerMonthEquivalent')}
                      value={formatMoney(r.monthlyPaymentCents)}
                      tone="muted"
                    />
                  ) : null}
                  <ResultRow
                    label={t('canadaPurchase.mortgageAmount')}
                    value={formatMoney(r.insurance.totalMortgageCents)}
                  />
                  {r.insurance.status === 'insured' ? (
                    <ResultRow
                      label={t('canadaPurchase.insurancePremium', {
                        rate: (r.insurance.premiumRateBps / 100).toFixed(2),
                      })}
                      value={formatMoney(r.insurance.premiumCents)}
                      tone="negative"
                      hint={t('canadaPurchase.premiumFinancedHint')}
                    />
                  ) : null}
                  <ResultRow
                    label={t('canadaPurchase.loanToValue')}
                    value={`${(r.insurance.ltvBps / 100).toFixed(1)}%`}
                    tone="muted"
                  />
                  <ResultRow
                    label={t('canadaPurchase.payoffIn')}
                    value={yearsMonths(t, r.withPrepayments.months)}
                  />
                  <ResultRow
                    label={t('canadaPurchase.totalInterest')}
                    value={formatMoney(r.withPrepayments.interestCents)}
                    tone="negative"
                  />
                  <View style={styles.divider} />
                  <ResultRow
                    label={t('canadaPurchase.cashToClose')}
                    value={formatMoney(r.closing.totalCents)}
                    big
                  />
                  <ResultRow
                    label={t('mortgagePlan.incomeNeeded')}
                    value={formatMoney(
                      r.qualifying.required.requiredAnnualCents,
                    )}
                    hint={t('mortgagePlan.incomeNeededHint', {
                      rate: formatPercent(r.qualifying.stressRateBps),
                    })}
                  />
                  {r.qualifying.maxPriceCents != null ? (
                    <ResultRow
                      label={t('mortgagePlan.maxPrice')}
                      value={formatMoney(r.qualifying.maxPriceCents)}
                      tone={
                        r.qualifying.maxPriceCents >= homeValueCents
                          ? 'positive'
                          : 'negative'
                      }
                    />
                  ) : income.cents > 0 ? (
                    <ResultRow
                      label={t('mortgagePlan.maxPrice')}
                      value="—"
                      tone="negative"
                    />
                  ) : null}
                </>
              )}
              {insuranceNote ? (
                <AssumptionNote text={t(insuranceNote)} />
              ) : null}
            </>
          )}
        </Card>

        {r.ready ? (
          <>
            <Section
              title={t('mortgagePlan.scheduleHeading')}
              summary={t('mortgagePlan.timeLeft', {
                time: yearsMonths(t, r.withPrepayments.months),
              })}
            >
              <BalanceChart
                startCents={
                  pastRows.length > 0
                    ? pastRows[0].balanceCents + pastRows[0].principalCents
                    : r.insurance.totalMortgageCents
                }
                baseline={[...pastRows, ...r.baselineSchedule]}
                planned={hasPrepayments ? [...pastRows, ...r.schedule] : null}
                firstYear={Number(
                  monthAt(firstUpcoming, 1 - pastRows.length).slice(0, 4),
                )}
                todayYears={pastRows.length / 12}
              />
              <SliderField
                label={t('mortgagePlan.payoffBy')}
                field={payoffBy}
                kind="number"
                stops={steps(
                  Number(firstUpcoming.slice(0, 4)) + 1,
                  Number(firstUpcoming.slice(0, 4)) +
                    Math.max(2, Math.ceil(r.withPrepayments.months / 12)),
                  1,
                )}
                empty={
                  Number(firstUpcoming.slice(0, 4)) +
                  Math.ceil(r.withPrepayments.months / 12) -
                  5
                }
              />
              {payoffBy.int > 0 ? (
                payoffExtra != null ? (
                  <Text style={styles.hint}>
                    {t('mortgagePlan.payoffNeeds', {
                      amount: formatMoney(payoffExtra),
                      year: payoffBy.int,
                    })}{' '}
                    <Text
                      style={styles.link}
                      onPress={() =>
                        setExtras({
                          lumps: extras.lumps,
                          recurring: { 1: payoffExtra },
                        })
                      }
                    >
                      {t('mortgagePlan.payoffPlanIt')}
                    </Text>
                  </Text>
                ) : (
                  <Text style={styles.hint}>
                    {t('mortgagePlan.payoffAlready', { year: payoffBy.int })}
                  </Text>
                )
              ) : null}
              <Text style={styles.hint}>{t('mortgagePlan.scheduleHint')}</Text>
              {hasPrepayments && held ? (
                <Pressable style={styles.actionLink} onPress={scheduleExtras}>
                  <Text style={styles.link}>
                    {t('mortgagePlan.scheduleExtras')}
                  </Text>
                </Pressable>
              ) : null}
              {hasPrepayments ? (
                <>
                  <ResultRow
                    label={t('financeTools.timeSaved')}
                    value={yearsMonths(
                      t,
                      r.baseline.months - r.withPrepayments.months,
                    )}
                    tone="positive"
                  />
                  <ResultRow
                    label={t('financeTools.interestSaved')}
                    value={formatMoney(
                      r.baseline.interestCents -
                        r.withPrepayments.interestCents,
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
                onChangeExtras={setExtras}
              />
            </Section>

            <Section
              title={
                renewalMonth
                  ? t('mortgagePlan.renewsHeading', {
                      month: formatMonthLabel(renewalMonth),
                    })
                  : t('mortgagePlan.termHeading', {
                      years: termYears.number || 1,
                    })
              }
              summary={formatMoney(r.term.balanceCents)}
            >
              <ResultRow
                label={t('canadaPurchase.termInterest')}
                value={formatMoney(r.term.interestCents)}
                tone="negative"
              />
              <ResultRow
                label={t('canadaPurchase.termPrincipal')}
                value={formatMoney(r.term.principalCents)}
              />
              <ResultRow
                label={t('canadaPurchase.termBalance')}
                value={formatMoney(r.term.balanceCents)}
                big
              />
              {r.term.balanceCents > 0 ? (
                <>
                  <Text style={styles.subheading}>
                    {t('mortgagePlan.renewalHeading')}
                  </Text>
                  {r.renewal.map((row) => (
                    <ResultRow
                      key={row.shockBps}
                      label={
                        row.shockBps === 0
                          ? t('mortgagePlan.renewalSame', {
                              rate: formatPercent(row.rateBps),
                            })
                          : t('mortgagePlan.renewalUp', {
                              shock: row.shockBps / 100,
                              rate: formatPercent(row.rateBps),
                            })
                      }
                      value={`${formatMoney(row.monthlyPaymentCents)}${row.changeCents !== 0 ? `  ${row.changeCents > 0 ? '+' : '−'}${formatMoney(Math.abs(row.changeCents))}` : ''}`}
                      tone={row.changeCents > 0 ? 'negative' : 'default'}
                      hint={
                        row.incomePercent != null
                          ? t('mortgagePlan.ofIncome', {
                              percent: row.incomePercent.toFixed(0),
                            })
                          : undefined
                      }
                    />
                  ))}
                </>
              ) : null}
            </Section>

            {!heldFigures ? (
              <>
                <Section
                  title={t('canadaPurchase.cashToCloseHeading')}
                  summary={formatMoney(r.closing.totalCents)}
                >
                  <ResultRow
                    label={t('financeTools.downPayment')}
                    value={formatMoney(r.downCents)}
                  />
                  {NO_TRANSFER_TAX_PROVINCES.includes(province) ? (
                    <ResultRow
                      label={t('canadaPurchase.transferTax')}
                      value={t('canadaPurchase.noTransferTax')}
                      tone="muted"
                    />
                  ) : (
                    <ResultRow
                      label={t('canadaPurchase.transferTax')}
                      value={formatMoney(r.closing.provincialTax.netCents)}
                      hint={
                        r.closing.provincialTax.rebateCents > 0
                          ? t('canadaPurchase.rebateApplied', {
                              amount: formatMoney(
                                r.closing.provincialTax.rebateCents,
                              ),
                            })
                          : undefined
                      }
                    />
                  )}
                  {r.closing.municipalTax.taxCents > 0 ? (
                    <ResultRow
                      label={t('canadaPurchase.municipalTax')}
                      value={formatMoney(r.closing.municipalTax.netCents)}
                    />
                  ) : null}
                  {r.closing.premiumTaxCents > 0 ? (
                    <ResultRow
                      label={t('canadaPurchase.premiumTax')}
                      value={formatMoney(r.closing.premiumTaxCents)}
                      hint={t('canadaPurchase.premiumTaxHint')}
                    />
                  ) : null}
                  <SliderField
                    label={t('canadaPurchase.otherClosingCosts')}
                    field={otherClosing}
                    kind="money"
                    stops={steps(0, 20_000, 250)}
                    empty={DEFAULT_OTHER_CLOSING_CENTS / 100}
                  />
                  <AssumptionNote
                    text={t('canadaPurchase.taxesAsOf', {
                      date: TRANSFER_TAX_AS_OF,
                    })}
                  />
                </Section>

                <Section
                  title={t('mortgagePlan.qualifyHeading')}
                  summary={formatMoney(
                    r.qualifying.required.requiredAnnualCents,
                  )}
                >
                  <ResultRow
                    label={t('mortgagePlan.stressRate')}
                    value={formatPercent(r.qualifying.stressRateBps)}
                  />
                  <ResultRow
                    label={t('mortgagePlan.stressPayment')}
                    value={formatMoney(r.qualifying.stressPaymentCents)}
                  />
                  <ResultRow
                    label={t('requiredIncome.gdsCosts')}
                    value={formatMoney(r.qualifying.required.gdsMonthlyCents)}
                  />
                  <ResultRow
                    label={t('requiredIncome.tdsCosts')}
                    value={formatMoney(r.qualifying.required.tdsMonthlyCents)}
                  />
                  <ResultRow
                    label={t('requiredIncome.requiredAnnual')}
                    value={formatMoney(
                      r.qualifying.required.requiredAnnualCents,
                    )}
                    big
                    hint={t(
                      r.qualifying.required.boundBy === 'gds'
                        ? 'mortgagePlan.boundGds'
                        : 'mortgagePlan.boundTds',
                    )}
                  />
                  {r.qualifying.gdsPercent != null ? (
                    <>
                      <ResultRow
                        label={t('mortgagePlan.gdsRatio')}
                        value={`${r.qualifying.gdsPercent.toFixed(1)}%`}
                        tone={
                          r.qualifying.gdsPercent <= 39
                            ? 'positive'
                            : 'negative'
                        }
                      />
                      <ResultRow
                        label={t('mortgagePlan.tdsRatio')}
                        value={`${r.qualifying.tdsPercent!.toFixed(1)}%`}
                        tone={
                          r.qualifying.tdsPercent! <= 44
                            ? 'positive'
                            : 'negative'
                        }
                      />
                    </>
                  ) : null}
                  <AssumptionNote text={t('mortgagePlan.qualifyNote')} />
                </Section>

                <Section
                  title={t('mortgagePlan.rentHeading')}
                  summary={
                    rentVsBuy
                      ? rentVsBuy.breakEvenYear != null
                        ? t('mortgagePlan.rentBreakEven', {
                            year: rentVsBuy.breakEvenYear,
                          })
                        : t('mortgagePlan.rentNever', { years: horizon.int })
                      : ''
                  }
                >
                  <SliderField
                    label={t('mortgagePlan.rentShort')}
                    field={rent}
                    kind="money"
                    stops={steps(0, 8000, 50)}
                    empty={3000}
                  />
                  <SliderField
                    label={t('mortgagePlan.horizonShort')}
                    field={horizon}
                    kind="number"
                    stops={steps(1, 30, 1)}
                    unit={t('mortgagePlan.yearsUnit')}
                  />
                  <SliderField
                    label={t('mortgagePlan.rentGrowthShort')}
                    field={rentGrowth}
                    kind="percent"
                    stops={steps(0, 10, 0.5)}
                  />
                  <SliderField
                    label={t('mortgagePlan.appreciationShort')}
                    field={appreciation}
                    kind="percent"
                    stops={steps(-5, 10, 0.5)}
                  />
                  <SliderField
                    label={t('mortgagePlan.returnShort')}
                    field={investReturn}
                    kind="percent"
                    stops={steps(0, 12, 0.5)}
                  />
                  {rentVsBuy ? (
                    <>
                      <ResultRow
                        label={t('mortgagePlan.rentWhenPaysOff')}
                        value={
                          rentVsBuy.breakEvenYear != null
                            ? t('mortgagePlan.yearN', {
                                year: rentVsBuy.breakEvenYear,
                              })
                            : t('mortgagePlan.rentNotIn', {
                                years: horizon.int,
                              })
                        }
                        big
                      />
                      {(() => {
                        const last = rentVsBuy.rows[rentVsBuy.rows.length - 1];
                        if (!last) return null;
                        const buyWins = last.advantageCents >= 0;
                        return (
                          <>
                            <Text style={styles.subheading}>
                              {t('mortgagePlan.rentHaveAfter', {
                                years: last.year,
                              })}
                            </Text>
                            <ResultRow
                              label={t('mortgagePlan.rentIfBuy')}
                              value={formatMoney(
                                last.buyerEquityCents +
                                  last.buyerPortfolioCents,
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
                                buyWins
                                  ? 'mortgagePlan.rentBetterBuy'
                                  : 'mortgagePlan.rentBetterRent',
                                {
                                  amount: formatMoney(
                                    Math.abs(last.advantageCents),
                                  ),
                                },
                              )}
                              tone="positive"
                            />
                          </>
                        );
                      })()}
                      <AssumptionNote text={t('mortgagePlan.rentNote')} />
                    </>
                  ) : null}
                </Section>
              </>
            ) : (
              <Section
                title={t('mortgagePlan.refinanceHeading')}
                summary={
                  refinance && refinance.monthlySavingCents > 0
                    ? t('mortgagePlan.perMonthLess', {
                        amount: formatMoney(refinance.monthlySavingCents),
                      })
                    : ''
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
                  stops={steps(0, 10_000, 250)}
                  empty={3000}
                />
                <Text style={styles.hint}>
                  {t('mortgagePlan.switchCostsHint')}
                </Text>
                {refinance ? (
                  <>
                    <ResultRow
                      label={t('mortgagePlan.breakPenalty')}
                      value={formatMoney(refinance.penalty.penaltyCents)}
                      tone="negative"
                      hint={
                        fixedRate
                          ? t('mortgagePlan.breakPenaltyFixed', {
                              three: formatMoney(
                                refinance.penalty.threeMonthsCents,
                              ),
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
                      tone={
                        refinance.monthlySavingCents > 0
                          ? 'positive'
                          : 'negative'
                      }
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
            )}
          </>
        ) : null}
      </View>
    </CalcScreen>
  );
}

// A result card that opens on tap; its headline figure shows while closed.
function Section({
  title,
  summary,
  children,
  defaultOpen,
}: {
  title: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHead} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSummary} numberOfLines={1}>
          {summary}
        </Text>
        <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.toggles}>
      {options.map((o) => (
        <Toggle
          key={o.value}
          label={o.label}
          on={value === o.value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}

function YearChoice({
  label,
  field,
  years,
  hint,
}: {
  label: string;
  field: CalcField;
  years: number[];
  hint?: string;
}) {
  const t = useT();
  return (
    <View style={styles.choice}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.toggles}>
        {years.map((y) => (
          <Toggle
            key={y}
            label={t('mortgagePlan.foldYears', { years: y })}
            on={field.number === y}
            onPress={() => field.set(String(y))}
          />
        ))}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function Toggle({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.toggle, on && styles.toggleOn]} onPress={onPress}>
      <Text style={[styles.toggleText, on && styles.toggleTextOn]}>
        {label}
      </Text>
    </Pressable>
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

function parseMap<K extends string | number>(json: string): Record<K, number> {
  try {
    return JSON.parse(json);
  } catch {
    return {} as Record<K, number>;
  }
}

// "800000" → "800,000" as it is typed; the field parses separators back out.
function withThousands(text: string): string {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
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
  warn: { fontSize: 12, color: colors.negative },
  actionLink: { alignSelf: 'flex-start', paddingTop: spacing.xs },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.xs,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heroSymbol: { fontSize: 32, fontWeight: '700', color: colors.textMuted },
  heroInput: {
    flex: 1,
    fontSize: 34,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  pair: { flexDirection: 'row', gap: spacing.sm },
  pairItem: { flex: 1 },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  choice: { gap: spacing.xs },
  choiceLabel: { fontSize: 14, color: colors.textMuted },
  link: { color: colors.accent, fontWeight: '700' },
  subheading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  summary: { borderColor: colors.accent },
  toggles: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  toggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  toggleOn: { borderColor: colors.accent, backgroundColor: colors.tint },
  toggleText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  toggleTextOn: { color: colors.accent },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  sectionSummary: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chevron: { fontSize: 20, color: colors.textMuted },
  chevronOpen: { transform: [{ rotate: '90deg' }], color: colors.accent },
  sectionBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});
