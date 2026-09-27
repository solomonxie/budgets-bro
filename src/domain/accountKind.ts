import type { AccountKind, AccountType } from './types';

const KIND_BY_TYPE: Record<AccountType, AccountKind> = {
  cash: 'Cash',
  savings: 'Savings',
  credit_card: 'Credit',
  loan: 'Loan',
  mortgage: 'Loan',
  tracking: 'Tracking',
  asset: 'Asset',
  giving: 'Giving',
};

// Where money sits, then what is owed against it — Loan ahead of Asset, so a
// mortgage's debt reads near the cash it is paid from rather than buried
// under the things you own.
export const ACCOUNT_KIND_ORDER: AccountKind[] = ['Cash', 'Savings', 'Tracking', 'Loan', 'Asset', 'Credit', 'Giving'];

// Kinds whose balances are debts (stored as negative) — used to split Net
// Worth into Assets vs. Debts.
export const LIABILITY_KINDS: AccountKind[] = ['Credit', 'Loan'];

export function accountKind(type: AccountType): AccountKind {
  return KIND_BY_TYPE[type];
}

export interface NetWorth {
  assetsCents: number;
  debtsCents: number;
  netWorthCents: number;
}

// Cash/savings/tracking/asset accounts are assets; credit/loan balances are
// stored negative (debt) — Net Worth is the sum of everything either way, but
// Assets/Debts are broken out since lumping them into one number isn't
// meaningful on its own. A mortgage's `houseValueCents` (from
// accountValueHistoryRepo's latest entry) is folded in as its
// offsetting asset, so a mortgage nets to home equity, not just the debt.
export function netWorth(accounts: { type: AccountType; balanceCents: number; houseValueCents?: number }[]): NetWorth {
  let assetsCents = 0;
  let debtsCents = 0;
  for (const { type, balanceCents, houseValueCents } of accounts) {
    if (!countsTowardNetWorth(type)) continue;
    if (LIABILITY_KINDS.includes(accountKind(type))) {
      debtsCents += -balanceCents;
      if (type === 'mortgage' && houseValueCents != null) assetsCents += houseValueCents;
    } else {
      assetsCents += balanceCents;
    }
  }
  return { assetsCents, debtsCents, netWorthCents: assetsCents - debtsCents };
}

// Loan/mortgage accounts get an auto-generated budget category so payments
// toward them can be assigned money like any other category.
export function isLoanLikeType(type: AccountType): boolean {
  return type === 'loan' || type === 'mortgage';
}

// Tracking (investments) and Asset (depreciating property: cars, watches,
// computers…) accounts both skip the normal ledger balance in favor of a
// manually-logged value history — see accountsRepo.resolveBalanceCents.
// The only difference between them is the chart mode (see
// ValueHistoryChart's `mode`): Tracking splits deposited-vs-gain, Asset is
// a single plain value line since there's no "deposits" concept.
export function usesLoggedValue(type: AccountType): boolean {
  return type === 'tracking' || type === 'asset' || type === 'giving';
}

// Whose logged value is a floor rather than the whole answer: what the last
// statement said, plus everything paid in since. True of an investment and
// of money set aside to give — both grow by contribution as well as by
// whatever the valuation caught. An Asset is not one of these: a car is
// worth what it is worth.
export function toppedUpByContributions(type: AccountType): boolean {
  return type === 'tracking' || type === 'giving';
}

// Money set aside to give away is not yours to count. It sits in the
// accounts list like anything else and its own screen works like a tracking
// account's, but it is outside Net Worth entirely — neither an asset nor a
// debt — and Baby Step 7 reads it as giving (see BabyStepsScreen).
export function countsTowardNetWorth(type: AccountType): boolean {
  return type !== 'giving';
}

// Whose balance is the cash side of Unassigned Cash — must stay in step with
// CASH_ACCOUNT_TYPES in databases/queries/budgets.ts, which also drops
// archived accounts from that side.
export function holdsAssignableCash(type: AccountType): boolean {
  return type === 'cash';
}

// Where a category means something: only cash is assigned to categories, so
// only cash spends out of them — plus a credit card, whose purchases spend a
// category and fund its payment. Savings is off-budget like tracking/asset,
// and a loan's rows are mirrored payment legs categorised on the paying side.
//
// Doubles as the spend form's fallback account.
export function isSpendingAccountType(type: AccountType): boolean {
  return type === 'cash' || type === 'credit_card';
}

// Whether one transaction is the kind that carries a category — the account
// can spend (above) and it isn't money moving between your own accounts.
// Shared by the spend form and every list, so a row can't be shown a
// category the form would refuse to give it.
export function transactionTakesCategory(type: AccountType, isTransfer: boolean): boolean {
  return isSpendingAccountType(type) && !isTransfer;
}
