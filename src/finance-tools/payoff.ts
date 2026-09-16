import { addMonths, monthlyRateFromBps } from './amortization';
import type { AmortizationPaymentRow } from './amortization';

// Extra money thrown at a loan on top of the scheduled payment. Each stream
// has its own start date because "an extra $200 from next January" and "an
// extra $200 from today" are different loans by the end.
export interface ExtraPayments {
  monthlyCents?: number;
  monthlyStartDateIso?: string;
  yearlyCents?: number;
  // The yearly payment repeats in this date's month, every year from it on.
  yearlyStartDateIso?: string;
  oneTimeCents?: number;
  oneTimeDateIso?: string;
}

function monthOf(dateIso: string): number {
  return Number(dateIso.slice(5, 7));
}

// Same loop as buildAmortizationSchedule, but the payment varies per period.
// Kept separate rather than bolted onto that one: the plain schedule backs a
// real account's projection and shouldn't grow a scheduling concept it never
// uses.
export function buildScheduleWithExtras(
  balanceCents: number,
  annualRateBps: number,
  basePaymentCents: number,
  startDateIso: string,
  extras: ExtraPayments = {},
  maxPeriods = 600,
): AmortizationPaymentRow[] {
  const r = monthlyRateFromBps(annualRateBps);
  const rows: AmortizationPaymentRow[] = [];
  let balance = balanceCents;
  let oneTimeApplied = false;

  for (let period = 1; balance > 0 && period <= maxPeriods; period += 1) {
    const date = addMonths(startDateIso, period);
    let payment = basePaymentCents;

    if (extras.monthlyCents && date >= (extras.monthlyStartDateIso ?? startDateIso)) {
      payment += extras.monthlyCents;
    }
    if (extras.yearlyCents && extras.yearlyStartDateIso && date >= extras.yearlyStartDateIso && monthOf(date) === monthOf(extras.yearlyStartDateIso)) {
      payment += extras.yearlyCents;
    }
    if (extras.oneTimeCents && !oneTimeApplied && date >= (extras.oneTimeDateIso ?? startDateIso)) {
      payment += extras.oneTimeCents;
      oneTimeApplied = true;
    }

    const interestCents = Math.round(balance * r);
    if (payment <= interestCents) break;
    const principalCents = Math.min(payment - interestCents, balance);
    balance -= principalCents;
    rows.push({
      period,
      date,
      paymentCents: principalCents + interestCents,
      principalCents,
      interestCents,
      balanceCents: balance,
    });
  }
  return rows;
}

// Half the monthly payment every two weeks is 26 half-payments a year — 13
// monthly payments, not 12. Expressed as the equivalent monthly figure so the
// comparison runs through the same monthly schedule as everything else.
export function biweeklyEquivalentMonthlyCents(monthlyPaymentCents: number): number {
  return Math.round((monthlyPaymentCents * 13) / 12);
}

export interface PayoffComparison {
  monthsSaved: number;
  interestSavedCents: number;
  baselineInterestCents: number;
  acceleratedInterestCents: number;
  percentLessInterest: number;
  percentFaster: number;
}

function totalInterest(rows: AmortizationPaymentRow[]): number {
  return rows.reduce((sum, row) => sum + row.interestCents, 0);
}

export function comparePayoff(baseline: AmortizationPaymentRow[], accelerated: AmortizationPaymentRow[]): PayoffComparison {
  const baselineInterestCents = totalInterest(baseline);
  const acceleratedInterestCents = totalInterest(accelerated);
  const interestSavedCents = baselineInterestCents - acceleratedInterestCents;
  const monthsSaved = baseline.length - accelerated.length;
  return {
    monthsSaved,
    interestSavedCents,
    baselineInterestCents,
    acceleratedInterestCents,
    percentLessInterest: baselineInterestCents === 0 ? 0 : (interestSavedCents / baselineInterestCents) * 100,
    percentFaster: baseline.length === 0 ? 0 : (monthsSaved / baseline.length) * 100,
  };
}
