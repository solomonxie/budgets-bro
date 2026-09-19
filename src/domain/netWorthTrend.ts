import {
  isLoanLikeType,
  netWorth,
  toppedUpByContributions,
  usesLoggedValue,
} from './accountKind';
import { owedAtMonth } from './equityHistory';
import type { AccountType, AccountValueKind } from './types';

// Net worth for a month you are no longer standing in. Every account's
// balance has to be rebuilt as it was then, and each kind of account answers
// "what were you worth in March" differently:
//
// - a ledger account: its opening balance plus every transaction up to then;
// - tracking/asset: the last value logged on or before then, not the newest;
// - loan/mortgage: the remaining principal derived from the readings and
//   payments that existed then (see finance-tools/remainingPrincipal);
// - a mortgage's home: likewise its last value reading, as the offsetting
//   asset.
//
// Then the same netWorth() the Accounts page uses for today, so the last
// point of the line always equals the number printed above it.

export interface NetWorthTrendPoint {
  month: string; // 'YYYY-MM'
  assetsCents: number;
  debtsCents: number;
  netWorthCents: number;
  // What each account put into this month's total. A net worth is a sum of
  // a dozen derivations — a logged value here, a remaining principal there —
  // and when the answer looks wrong, the only useful next question is which
  // account is wrong. Carried on every point so the UI can answer it.
  contributions: AccountContribution[];
}

export interface AccountContribution {
  accountId: number;
  type: AccountType;
  // Signed as the account holds it: negative for a debt.
  balanceCents: number;
  // A mortgage's home, counted as the asset offsetting its debt.
  houseValueCents: number | null;
  // Why this figure and not another — which of the fallbacks answered.
  source:
    | 'reading'
    | 'purchasePrice'
    | 'oldestReading'
    | 'ledger'
    | 'derived';
}

export interface TrendAccount {
  id: number;
  type: AccountType;
  openingBalanceCents: number;
  originalPrincipalCents: number | null;
  // The contract's length, which is what says a mortgage from 2006 was
  // mostly paid off by 2024 even when none of those payments are on file.
  termMonths: number | null;
  // What the home cost. It is the house's value on the day it was bought, so
  // it stands in for every month before the first value was logged by hand —
  // otherwise a mortgage carries its debt through those months with no house
  // against it, and the line reads as a hole nobody was ever in.
  originalHousePriceCents: number | null;
  originationDate: string | null;
  createdAt: string;
}

export interface TrendReading {
  accountId: number;
  kind: AccountValueKind;
  valueCents: number;
  effectiveDate: string; // 'YYYY-MM-DD'
}

export interface TrendActivity {
  accountId: number;
  month: string; // 'YYYY-MM'
  totalCents: number;
}

export interface TrendPayment {
  accountId: number;
  date: string;
  amountCents: number;
}

// The month an account's own record begins: when the loan was taken out, the
// first value ever logged for it, or its first transaction — whichever came
// first.
//
// Before that month the account is not "worth zero", it is *absent*, and the
// difference shows. A mortgage counted from the start of the chart carries
// its full debt in months before the house was bought, with no house against
// it; a cash account contributes nothing until its first transaction, since
// opening balances are always zero here. The result was a plateau nobody
// lived through and a cliff on the month the real data started.
//
// Null means there is no evidence of a start at all — nothing logged, nothing
// posted, no origination — in which case the account is counted throughout:
// an unexplained balance is better shown than silently dropped.
function startMonthOf(
  account: TrendAccount,
  readings: TrendReading[],
  activity: TrendActivity[],
): string | null {
  // A valuation is not a beginning for an Asset. A house or a car existed
  // before anyone wrote down what it was worth, so the day you first typed a
  // figure in says nothing about when you acquired it — gating on that put a
  // mortgage on the chart with no house against it until the month you got
  // round to valuing it. An investment is the other way about: a Tracking
  // account starts when it is first evidenced, because that is when the
  // money went in.
  const startsWhenValued = account.type !== 'asset';
  const candidates = [
    account.originationDate?.slice(0, 7),
    ...(startsWhenValued
      ? readings.map((r) => r.effectiveDate.slice(0, 7))
      : []),
    ...activity.map((a) => a.month),
  ].filter((m): m is string => m != null);
  if (candidates.length === 0) return null;
  return candidates.reduce((earliest, m) => (m < earliest ? m : earliest));
}

function earliest(readings: TrendReading[]): TrendReading | null {
  let found: TrendReading | null = null;
  for (const r of readings) {
    if (!found || r.effectiveDate < found.effectiveDate) found = r;
  }
  return found;
}

// `asOfDate` bounds the month we are standing in: a reading dated later this
// month hasn't happened yet, and counting it made the chart's last point
// disagree with the Net Worth printed directly above it.
function latestOnOrBefore(
  readings: TrendReading[],
  month: string,
  asOfDate: string,
): TrendReading | null {
  let found: TrendReading | null = null;
  for (const r of readings) {
    if (r.effectiveDate.slice(0, 7) > month) continue;
    if (r.effectiveDate > asOfDate) continue;
    if (!found || r.effectiveDate > found.effectiveDate) found = r;
  }
  return found;
}

export function netWorthTrend({
  months,
  accounts,
  activity,
  readings,
  payments,
  rateByAccountId,
  asOfDate,
}: {
  months: string[];
  accounts: TrendAccount[];
  activity: TrendActivity[];
  readings: TrendReading[];
  payments: TrendPayment[];
  // Today's rate, applied to every month — a loan's rate history could be
  // walked too, but the error from a past reprice is small next to the
  // readings themselves, and it never affects the latest point.
  rateByAccountId: Map<number, number>;
  // Today, so the month we are standing in stops where the present does.
  asOfDate: string;
}): NetWorthTrendPoint[] {
  const activityByAccount = new Map<number, TrendActivity[]>();
  for (const a of activity) {
    const list = activityByAccount.get(a.accountId) ?? [];
    list.push(a);
    activityByAccount.set(a.accountId, list);
  }
  const readingsByAccount = new Map<number, TrendReading[]>();
  for (const r of readings) {
    const list = readingsByAccount.get(r.accountId) ?? [];
    list.push(r);
    readingsByAccount.set(r.accountId, list);
  }
  const paymentsByAccount = new Map<number, TrendPayment[]>();
  for (const p of payments) {
    const list = paymentsByAccount.get(p.accountId) ?? [];
    list.push(p);
    paymentsByAccount.set(p.accountId, list);
  }

  const startMonths = new Map<number, string | null>();
  for (const account of accounts) {
    startMonths.set(
      account.id,
      startMonthOf(
        account,
        readingsByAccount.get(account.id) ?? [],
        activityByAccount.get(account.id) ?? [],
      ),
    );
  }

  return months.map((month) => {
    const present = accounts.filter((account) => {
      const start = startMonths.get(account.id) ?? null;
      return start == null || month >= start;
    });
    const asOf = present.map((account) => {
      const accountReadings = readingsByAccount.get(account.id) ?? [];
      const ledgerCents =
        account.openingBalanceCents +
        (activityByAccount.get(account.id) ?? []).reduce(
          (sum, a) => (a.month <= month ? sum + a.totalCents : sum),
          0,
        );

      const valueReading = latestOnOrBefore(
        accountReadings.filter((r) => r.kind === 'value'),
        month,
        asOfDate,
      );

      if (usesLoggedValue(account.type)) {
        // A Tracking (or Giving) account is worth its last valuation plus
        // whatever was
        // paid in after it: the statement says what it was worth that day,
        // and a contribution since is money that is really in there. With
        // nothing ever logged, the contributions alone — never zero for an
        // account that has been funded.
        //
        // Contributions are counted by whole months after the valuation's
        // own month, since that is the grain the ledger arrives in here. A
        // deposit made later in the same month as the reading is taken to
        // be inside it, which is how a month-end statement reads.
        //
        // An Asset is a different thing: a car or a watch existed before
        // anyone wrote down what it was worth, so the oldest valuation is
        // carried back over the months it predates and nothing is added on
        // top of a valuation.
        if (toppedUpByContributions(account.type)) {
          const paidInSince = valueReading
            ? (activityByAccount.get(account.id) ?? []).reduce(
                (sum, a) =>
                  a.month > valueReading.effectiveDate.slice(0, 7) &&
                  a.month <= month
                    ? sum + a.totalCents
                    : sum,
                0,
              )
            : 0;
          return {
            accountId: account.id,
            type: account.type,
            balanceCents: valueReading
              ? valueReading.valueCents + paidInSince
              : ledgerCents,
            houseValueCents: null,
            source: valueReading ? ('reading' as const) : ('ledger' as const),
          };
        }
        const oldestCents = earliest(
          accountReadings.filter((r) => r.kind === 'value'),
        )?.valueCents;
        return {
          accountId: account.id,
          type: account.type,
          balanceCents: valueReading?.valueCents ?? oldestCents ?? ledgerCents,
          houseValueCents: null,
          source: valueReading
            ? ('reading' as const)
            : oldestCents != null
              ? ('oldestReading' as const)
              : ('ledger' as const),
        };
      }

      if (isLoanLikeType(account.type)) {
        // One rule for what a loan owes in a month, shared with the
        // mortgage's own chart and the accounts list — see
        // domain/equityHistory.
        const owedCents = owedAtMonth({
          month,
          terms: {
            originalPrincipalCents: account.originalPrincipalCents,
            originationDate: account.originationDate,
            termMonths: account.termMonths,
            openingBalanceCents: account.openingBalanceCents,
            fallbackDate: account.createdAt.slice(0, 10),
          },
          principalReadings: accountReadings.filter(
            (r) => r.kind === 'principal',
          ),
          payments: paymentsByAccount.get(account.id) ?? [],
          annualRateBps: rateByAccountId.get(account.id) ?? null,
          asOfDate,
        });
        // A house exists from the day it was bought, whether or not anyone
        // wrote down what it was worth. With no reading for this month yet,
        // fall back to the purchase price, and failing that to the oldest
        // valuation on record, carried backwards — the alternative is a
        // mortgage standing alone as a few hundred thousand of debt against
        // nothing, which is what put the early months of this line under the
        // floor.
        const houseCents =
          valueReading?.valueCents ??
          account.originalHousePriceCents ??
          earliest(accountReadings.filter((r) => r.kind === 'value'))
            ?.valueCents ??
          null;
        return {
          accountId: account.id,
          type: account.type,
          balanceCents: -owedCents,
          houseValueCents: houseCents,
          source: valueReading
            ? ('reading' as const)
            : account.originalHousePriceCents != null
              ? ('purchasePrice' as const)
              : houseCents != null
                ? ('oldestReading' as const)
                : ('derived' as const),
        };
      }

      return {
        accountId: account.id,
        type: account.type,
        balanceCents: ledgerCents,
        houseValueCents: null,
        source: 'ledger' as const,
      };
    });

    return {
      month,
      ...netWorth(
        asOf.map((c) => ({
          type: c.type,
          balanceCents: c.balanceCents,
          houseValueCents: c.houseValueCents ?? undefined,
        })),
      ),
      contributions: asOf,
    };
  });
}
