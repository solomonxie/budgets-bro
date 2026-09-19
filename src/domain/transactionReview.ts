import { transactionTakesCategory } from './accountKind';
import type { TransferViolation } from './transferIntegrity';
import type { TransactionWithLabels } from './types';

// Why a row is worth a second look. A list screen filters on the first two
// (the ones a row visibly shows as "(No payee)" / "Uncategorized"); the
// review page collects all of them, plus the ones only a second row can
// reveal — see domain/transferIntegrity, which owns the transfer* half.
export type ReviewReason =
  | 'missingPayee'
  | 'missingCategory'
  | 'duplicate'
  | 'zeroAmount'
  | 'transferMissingLeg'
  | 'transferAmountMismatch'
  | 'transferSelfNamed'
  | 'transferUnlinked'
  // Not a transaction's problem at all — a category that has spent more than
  // it was given this month. It rides in the same list because it is the
  // same question ("what in here is wrong?"), and its fix is assigning
  // money, not editing a row.
  | 'categoryOverspent';

// The transfer audit's vocabulary in this page's terms.
export const REASON_BY_VIOLATION: Record<
  TransferViolation['kind'],
  ReviewReason
> = {
  missingLeg: 'transferMissingLeg',
  amountMismatch: 'transferAmountMismatch',
  // A transfer leg with no payee is simply a row with no payee — the same
  // problem the plain check already reports, so it stays one type rather
  // than showing the row two badges that say the same thing. What is
  // different is that this one has a right answer nobody has to choose:
  // the account across from it (see the review page's quick fix).
  unnamedLeg: 'missingPayee',
  selfNamed: 'transferSelfNamed',
  unmarked: 'transferUnlinked',
};

// What a single tap can put right on its own. A missing payee or category
// isn't here: there is no correct answer to pick on the user's behalf, which
// is what the pickers on each card are for.
const QUICK_FIXABLE: ReviewReason[] = [
  'transferMissingLeg',
  'transferAmountMismatch',
  'transferSelfNamed',
  'transferUnlinked',
  'duplicate',
  'zeroAmount',
];

export function isQuickFixable(reason: ReviewReason): boolean {
  return QUICK_FIXABLE.includes(reason);
}

// Deletes the row rather than repairing it — worth saying out loud before a
// batch of them runs.
export function quickFixDeletes(reason: ReviewReason): boolean {
  return reason === 'duplicate' || reason === 'zeroAmount';
}

// The one a card's Fix button acts on when a row has several problems:
// pairing first (it is the one that moves money), then the labels, and only
// then the deletions — so a duplicate that is also an unlinked transfer gets
// linked, not deleted.
export function primaryQuickFix(reasons: ReviewReason[]): ReviewReason | null {
  return QUICK_FIXABLE.find((candidate) => reasons.includes(candidate)) ?? null;
}

// What a transaction list's Review filter can be set to. 'any' is every
// reason below, including the ones the row itself doesn't show.
export type ReviewFilter = 'missingPayee' | 'missingCategory' | 'any';

export function missingPayee(txn: TransactionWithLabels): boolean {
  return txn.payeeId == null;
}

// Same rule every list draws "Uncategorized" by (see accountKind): only an
// outflow from an account that spends can be missing one. A transfer leg or
// a savings withdrawal isn't uncategorized, it simply takes no category.
export function missingCategory(txn: TransactionWithLabels): boolean {
  return (
    txn.categoryId == null &&
    txn.amountCents < 0 &&
    transactionTakesCategory(txn.accountType, txn.transferAccountId != null)
  );
}

export function zeroAmount(txn: TransactionWithLabels): boolean {
  return txn.amountCents === 0;
}

// Same account, day, amount, payee *and* memo — the shape a double import or
// a double-tapped save leaves behind. The memo has to match exactly, empty
// included: two identical amounts at the same shop on the same day are
// routine, and the note is usually the only thing that says whether they
// were one event recorded twice or two things that really happened.
//
// Two genuine identical purchases with no note still match, which is why
// this only ever flags a row for review rather than touching it.
function duplicateKey(txn: TransactionWithLabels): string {
  return [
    txn.accountId,
    txn.date,
    txn.amountCents,
    txn.payeeId ?? '',
    txn.memo ?? '',
  ].join('|');
}

// Each set of rows that look like the same event, so a fix can act on the
// whole group — merging two halves into one total needs to know what the
// other half is, not just that this row has one.
export function duplicateGroups(
  transactions: TransactionWithLabels[],
): TransactionWithLabels[][] {
  const byKey = new Map<string, TransactionWithLabels[]>();
  for (const txn of transactions) {
    const key = duplicateKey(txn);
    const group = byKey.get(key);
    if (group) group.push(txn);
    else byKey.set(key, [txn]);
  }
  return [...byKey.values()].filter((group) => group.length > 1);
}

export function duplicateTransactionIds(
  transactions: TransactionWithLabels[],
): Set<number> {
  const duplicates = new Set<number>();
  for (const group of duplicateGroups(transactions)) {
    for (const txn of group) duplicates.add(txn.id);
  }
  return duplicates;
}

export function reviewReasons(
  txn: TransactionWithLabels,
  duplicates: Set<number>,
): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (missingPayee(txn)) reasons.push('missingPayee');
  if (missingCategory(txn)) reasons.push('missingCategory');
  if (duplicates.has(txn.id)) reasons.push('duplicate');
  if (zeroAmount(txn)) reasons.push('zeroAmount');
  return reasons;
}

export interface TransactionToReview {
  txn: TransactionWithLabels;
  reasons: ReviewReason[];
}

export function transactionsNeedingReview(
  transactions: TransactionWithLabels[],
): TransactionToReview[] {
  const duplicates = duplicateTransactionIds(transactions);
  return transactions
    .map((txn) => ({ txn, reasons: reviewReasons(txn, duplicates) }))
    .filter((item) => item.reasons.length > 0);
}

// The list screens' filter. `duplicates` comes from the same list being
// filtered, so "needs review" on an account page means duplicated within
// that account's rows — which is the only place a duplicate can be anyway.
export function matchesReviewFilter(
  txn: TransactionWithLabels,
  filter: ReviewFilter,
  duplicates: Set<number>,
): boolean {
  if (filter === 'missingPayee') return missingPayee(txn);
  if (filter === 'missingCategory') return missingCategory(txn);
  return reviewReasons(txn, duplicates).length > 0;
}
