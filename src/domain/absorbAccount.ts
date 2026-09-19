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
//
// Both totals the caller cares about are worked out here rather than guessed
// at by the confirm dialog: what the absorbing account's balance does, and
// what Unassigned Cash does. The second is not always zero — see
// `unassignedDeltaCents`.

export interface AbsorbRow {
  id: number;
  accountId: number;
  transferAccountId: number | null;
  categoryId: number | null;
  amountCents: number;
}

// The two accounts as Unassigned Cash sees them (see
// databases/queries/budgets.ts): `countsAsCash` is its balance feeding the
// cash side, `onBudget` is its categorised rows feeding category activity.
export interface AbsorbAccountInfo {
  id: number;
  countsAsCash: boolean;
  onBudget: boolean;
  // Not a transaction row, so it leaves with the account rather than moving.
  openingBalanceCents: number;
}

export interface AbsorbPlan {
  moveIds: number[]; // rows that move to the absorbing account
  deleteIds: number[]; // both halves of the transfers between the two
  // What the absorbing account's balance changes by. Zero when every
  // transfer was with that account, which is the case worth having.
  balanceDeltaCents: number;
  // What Unassigned Cash changes by. Zero for the case worth having — a card
  // paid off entirely from the absorbing account, where the spending landing
  // on cash is cancelled by the payments that leave with it. Non-zero when
  // the card still owes something or was opened with a balance: absorbing
  // says that spending was paid in cash, and cash it was never paid with
  // goes down to match.
  unassignedDeltaCents: number;
}

export function planAbsorb(rows: AbsorbRow[], from: AbsorbAccountInfo, into: AbsorbAccountInfo): AbsorbPlan {
  const moveIds: number[] = [];
  const deleteIds: number[] = [];
  let balanceDeltaCents = 0;
  let cashDeltaCents = 0;
  let activityDeltaCents = 0;

  // Moving a row only shows in a total when the two sides count differently:
  // off a card and onto cash is new money out of the cash side.
  const moved = (row: AbsorbRow) => {
    if (from.countsAsCash !== into.countsAsCash) {
      cashDeltaCents += into.countsAsCash ? row.amountCents : -row.amountCents;
    }
    if (row.categoryId != null && from.onBudget !== into.onBudget) {
      activityDeltaCents += into.onBudget ? row.amountCents : -row.amountCents;
    }
  };
  const dropped = (row: AbsorbRow, account: AbsorbAccountInfo) => {
    if (account.countsAsCash) cashDeltaCents -= row.amountCents;
    if (row.categoryId != null && account.onBudget) activityDeltaCents -= row.amountCents;
  };

  for (const row of rows) {
    if (row.accountId === from.id) {
      // A transfer with the absorbing account: this half goes, and its
      // matching half on the other side goes with it.
      if (row.transferAccountId === into.id) {
        deleteIds.push(row.id);
        dropped(row, from);
        continue;
      }
      moveIds.push(row.id);
      balanceDeltaCents += row.amountCents;
      moved(row);
      continue;
    }
    // The absorbing account's own half of a transfer with the account going
    // away — the other end of what was just dropped.
    if (row.accountId === into.id && row.transferAccountId === from.id) {
      deleteIds.push(row.id);
      balanceDeltaCents -= row.amountCents;
      dropped(row, into);
    }
  }

  if (from.countsAsCash) cashDeltaCents -= from.openingBalanceCents;

  return { moveIds, deleteIds, balanceDeltaCents, unassignedDeltaCents: cashDeltaCents - activityDeltaCents };
}
