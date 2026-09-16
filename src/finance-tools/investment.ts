import { bisect } from './solve';

export type CompoundFrequency =
  | 'annually'
  | 'semiannually'
  | 'quarterly'
  | 'monthly'
  | 'semimonthly'
  | 'biweekly'
  | 'weekly'
  | 'daily'
  | 'continuously';

export type ContributionTiming = 'beginningOfMonth' | 'endOfMonth' | 'beginningOfYear' | 'endOfYear';

const PERIODS_PER_YEAR: Record<Exclude<CompoundFrequency, 'continuously'>, number> = {
  annually: 1,
  semiannually: 2,
  quarterly: 4,
  monthly: 12,
  semimonthly: 24,
  biweekly: 26,
  weekly: 52,
  daily: 365,
};

export interface InvestmentInput {
  startingCents: number;
  years: number;
  annualReturnBps: number;
  compound: CompoundFrequency;
  contributionCents: number;
  timing: ContributionTiming;
}

// Compounding frequency and contribution cadence are independent inputs —
// quarterly compounding with monthly deposits is an ordinary thing to ask.
// Collapsing the stated nominal rate to one effective annual rate first lets
// the contribution schedule drive the loop without the two fighting.
export function effectiveAnnualRate(annualReturnBps: number, compound: CompoundFrequency): number {
  const nominal = annualReturnBps / 10000;
  if (compound === 'continuously') return Math.exp(nominal) - 1;
  const n = PERIODS_PER_YEAR[compound];
  return Math.pow(1 + nominal / n, n) - 1;
}

function contributionsPerYear(timing: ContributionTiming): number {
  return timing === 'beginningOfMonth' || timing === 'endOfMonth' ? 12 : 1;
}

function atBeginning(timing: ContributionTiming): boolean {
  return timing === 'beginningOfMonth' || timing === 'beginningOfYear';
}

export interface InvestmentResult {
  endBalanceCents: number;
  startingCents: number;
  totalContributionsCents: number;
  totalInterestCents: number;
}

export interface InvestmentYearRow {
  year: number;
  startBalanceCents: number;
  contributionCents: number;
  interestCents: number;
  endBalanceCents: number;
}

// Steps one contribution period at a time in floating point, rounding only at
// the edges — rounding every period would drift visibly over 30 years.
function simulate(input: InvestmentInput): { rows: InvestmentYearRow[]; endBalance: number; totalContributions: number } {
  const perYear = contributionsPerYear(input.timing);
  const ear = effectiveAnnualRate(input.annualReturnBps, input.compound);
  const periodRate = Math.pow(1 + ear, 1 / perYear) - 1;
  const beginning = atBeginning(input.timing);

  const rows: InvestmentYearRow[] = [];
  let balance = input.startingCents;
  let totalContributions = 0;
  const wholeYears = Math.max(0, Math.floor(input.years));
  const totalPeriods = Math.max(0, Math.round(input.years * perYear));

  let period = 0;
  for (let year = 1; period < totalPeriods; year += 1) {
    const startBalance = balance;
    let yearContribution = 0;
    const periodsThisYear = Math.min(perYear, totalPeriods - period);
    for (let i = 0; i < periodsThisYear; i += 1) {
      if (beginning) {
        balance += input.contributionCents;
        yearContribution += input.contributionCents;
      }
      balance *= 1 + periodRate;
      if (!beginning) {
        balance += input.contributionCents;
        yearContribution += input.contributionCents;
      }
      period += 1;
    }
    totalContributions += yearContribution;
    // Interest is the residual of the *rounded* columns, not a separately
    // rounded figure — otherwise a row can miss adding up by a cent, which is
    // the first thing anyone checks in a table like this.
    const startBalanceCents = Math.round(startBalance);
    const contributionCents = Math.round(yearContribution);
    const endBalanceCents = Math.round(balance);
    rows.push({
      year,
      startBalanceCents,
      contributionCents,
      interestCents: endBalanceCents - startBalanceCents - contributionCents,
      endBalanceCents,
    });
    if (year > wholeYears + 1) break; // guard against a pathological `years`
  }

  return { rows, endBalance: balance, totalContributions };
}

export function futureValueCents(input: InvestmentInput): InvestmentResult {
  const { endBalance, totalContributions } = simulate(input);
  const endBalanceCents = Math.round(endBalance);
  const totalContributionsCents = Math.round(totalContributions);
  return {
    endBalanceCents,
    startingCents: input.startingCents,
    totalContributionsCents,
    totalInterestCents: endBalanceCents - input.startingCents - totalContributionsCents,
  };
}

export function buildAccumulationSchedule(input: InvestmentInput): InvestmentYearRow[] {
  return simulate(input).rows;
}

// Growth factor on the starting sum, and on one unit of contribution — the two
// terms every solver needs. Keeping them separate makes the closed-form
// solvers exact instead of another bisection.
function growthFactors(input: InvestmentInput): { principal: number; perContribution: number } {
  const principal = futureValueCents({ ...input, startingCents: 1_000_000, contributionCents: 0 }).endBalanceCents / 1_000_000;
  const perContribution = futureValueCents({ ...input, startingCents: 0, contributionCents: 1_000_000 }).endBalanceCents / 1_000_000;
  return { principal, perContribution };
}

export function solveStartingCents(targetEndCents: number, input: InvestmentInput): number {
  const { principal, perContribution } = growthFactors(input);
  if (principal === 0) return 0;
  return Math.round((targetEndCents - input.contributionCents * perContribution) / principal);
}

export function solveContributionCents(targetEndCents: number, input: InvestmentInput): number {
  const { principal, perContribution } = growthFactors(input);
  if (perContribution === 0) return 0;
  return Math.round((targetEndCents - input.startingCents * principal) / perContribution);
}

export function solveAnnualReturnBps(targetEndCents: number, input: InvestmentInput): number {
  // Up to 100%/yr — past that the answer is "this plan doesn't work".
  return bisect((bps) => futureValueCents({ ...input, annualReturnBps: bps }).endBalanceCents - targetEndCents, 0, 10000, 0.01);
}

export function solveYears(targetEndCents: number, input: InvestmentInput): number {
  return bisect((years) => futureValueCents({ ...input, years }).endBalanceCents - targetEndCents, 0, 100, 0.001);
}
