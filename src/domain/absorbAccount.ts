// Working out what "delete this account and absorb its history" actually
// moves, before any of it is written.
//
// An account being absorbed has two kinds of row on it: its own spending,
// and the mirror halves of transfers with other accounts. Those transfers
// are the problem — a credit card's payments are the other half of money
// leaving chequing, so if the spending simply moved to chequing while the
// payments stayed, chequing would show both and count the same money twice.
//
// Collapsing a transfer means dropping both halves: the one on the account
// going away, and the one on the account absorbing it. What is left is the
// spending, moved across, which is the same as having paid cash for it.
//
// Only transfers with the absorbing account can be collapsed. A transfer
// with some third account has no matching half to remove, so it stays and
// moves like any other row — and the caller is told, because the totals no
// longer cancel.

export interface AbsorbRow {
  id: number;
  accountId: number;
  transferAccountId: number | null;
  categoryId: number | null;
  amountCents: number;
}

export interface AbsorbPlan {
  moveIds: number[]; // rows that move to the absorbing account
  deleteIds: number[]; // both halves of the transfers between the two
  // What the absorbing account's balance changes by. Zero when every
  // transfer was with that account, which is the case worth having.
  balanceDeltaCents: number;
  // What Unassigned Cash changes by: nothing moves category activity here,
  // since the rows keep their categories and both accounts are on-budget.
  unassignedDeltaCents: number;
}

export function planAbsorb(rows: AbsorbRow[], fromAccountId: number, intoAccountId: number): AbsorbPlan {
  const moveIds: number[] = [];
  const deleteIds: number[] = [];
  let balanceDeltaCents = 0;

  for (const row of rows) {
    if (row.accountId === fromAccountId) {
      // A transfer with the absorbing account: this half goes, and its
      // matching half on the other side goes with it.
      if (row.transferAccountId === intoAccountId) {
        deleteIds.push(row.id);
        continue;
      }
      moveIds.push(row.id);
      balanceDeltaCents += row.amountCents;
      continue;
    }
    // The absorbing account's own half of a transfer with the account going
    // away — the other end of what was just dropped.
    if (row.accountId === intoAccountId && row.transferAccountId === fromAccountId) {
      deleteIds.push(row.id);
      balanceDeltaCents -= row.amountCents;
    }
  }

  return { moveIds, deleteIds, balanceDeltaCents, unassignedDeltaCents: 0 };
}
