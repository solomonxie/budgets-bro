import type { AccountWithBalance } from '../../../db/repositories/accountsRepo';
import { paymentPlan } from '../../../finance-tools/canadianMortgage';
import type { Compounding } from '../../../finance-tools/canadianMortgage';

export interface HeldMortgage {
  entry: AccountWithBalance;
  rateBps: number | null;
  homeValueCents: number | null;
}

export interface HeldTerms {
  owed: number;
  rateBps: number;
  payment: number;
  paymentFromLedger: boolean;
}

// What a real mortgage pays each month: the usual payment on the ledger when
// there is one (accelerated or rounded up), else what its original terms
// work out to.
export function heldTerms(
  entry: AccountWithBalance,
  rateBps: number,
  compounding: Compounding,
  usualPaymentCents: number | null,
): HeldTerms {
  const { account } = entry;
  const owed = Math.max(0, -entry.balanceCents);
  const contract =
    account.originalPrincipalCents != null && account.termMonths != null
      ? paymentPlan(
          account.originalPrincipalCents,
          rateBps,
          account.termMonths,
          'monthly',
          compounding,
        ).paymentCents
      : paymentPlan(owed, rateBps, 300, 'monthly', compounding).paymentCents;
  const fromLedger = usualPaymentCents != null && usualPaymentCents > 0;
  return {
    owed,
    rateBps,
    payment: fromLedger ? usualPaymentCents : contract,
    paymentFromLedger: fromLedger && usualPaymentCents !== contract,
  };
}
