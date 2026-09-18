import { isLoanLikeType, netWorth, usesLoggedValue } from './accountKind';
import { remainingPrincipal } from '../finance-tools/remainingPrincipal';
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
}

export interface TrendAccount {
  id: number;
  type: AccountType;
  openingBalanceCents: number;
  originalPrincipalCents: number | null;
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

function latestOnOrBefore(readings: TrendReading[], month: string): TrendReading | null {
  let found: TrendReading | null = null;
  for (const r of readings) {
    if (r.effectiveDate.slice(0, 7) > month) continue;
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

  return months.map((month) => {
    const asOf = accounts.map((account) => {
      const accountReadings = readingsByAccount.get(account.id) ?? [];
      const ledgerCents =
        account.openingBalanceCents +
        (activityByAccount.get(account.id) ?? []).reduce((sum, a) => (a.month <= month ? sum + a.totalCents : sum), 0);

      const valueReading = latestOnOrBefore(
        accountReadings.filter((r) => r.kind === 'value'),
        month,
      );

      if (usesLoggedValue(account.type)) {
        return { type: account.type, balanceCents: valueReading?.valueCents ?? ledgerCents };
      }

      if (isLoanLikeType(account.type)) {
        const principalReading = latestOnOrBefore(
          accountReadings.filter((r) => r.kind === 'principal'),
          month,
        );
        const { owedCents } = remainingPrincipal({
          loggedPrincipal: principalReading
            ? { valueCents: principalReading.valueCents, effectiveDate: principalReading.effectiveDate }
            : null,
          originalPrincipalCents: account.originalPrincipalCents,
          originationDate: account.originationDate,
          openingBalanceCents: account.openingBalanceCents,
          fallbackDate: account.createdAt.slice(0, 10),
          annualRateBps: rateByAccountId.get(account.id) ?? null,
          payments: (paymentsByAccount.get(account.id) ?? []).filter((p) => p.date.slice(0, 7) <= month),
        });
        return {
          type: account.type,
          balanceCents: -owedCents,
          houseValueCents: valueReading?.valueCents,
        };
      }

      return { type: account.type, balanceCents: ledgerCents };
    });

    return { month, ...netWorth(asOf) };
  });
}
