import { transactionTakesCategory } from './accountKind';
import type { AccountType } from './types';

// The line under a payee in every transaction list: what this row *is*, when
// the payee alone doesn't say. Pure, so the two lists that draw it (history,
// and an account's register) can't drift apart on what an income row or an
// uncategorized one reads as.

export interface TransactionLabelRow {
  categoryIcon: string | null;
  categoryName: string | null;
  amountCents: number;
  accountType: AccountType;
  transferAccountId: number | null;
}

export type TransactionSubLabel =
  | { kind: 'category'; icon: string | null; name: string }
  // Money in, from outside the budget. It carries no category by design, so
  // without this the row shows a payee and nothing else.
  | { kind: 'income' }
  | { kind: 'uncategorized' };

export function transactionSubLabel(
  row: TransactionLabelRow,
): TransactionSubLabel | null {
  if (row.categoryName)
    return { kind: 'category', icon: row.categoryIcon, name: row.categoryName };
  // A transfer leg and a savings withdrawal take no category and are not
  // income either — they are money moving, not arriving (see accountKind).
  if (!transactionTakesCategory(row.accountType, row.transferAccountId != null))
    return null;
  if (row.amountCents > 0) return { kind: 'income' };
  return row.amountCents < 0 ? { kind: 'uncategorized' } : null;
}
