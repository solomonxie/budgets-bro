// Given transactions newest-first and the account's current (ending)
// balance, walks backward to attach each transaction's balance-after.
export function withRunningBalances<T extends { amountCents: number }>(
  transactionsNewestFirst: T[],
  endingBalanceCents: number,
): (T & { runningBalanceCents: number })[] {
  let running = endingBalanceCents;
  return transactionsNewestFirst.map((t) => {
    const row = { ...t, runningBalanceCents: running };
    running -= t.amountCents;
    return row;
  });
}

// "Correct Balance": the delta becomes a single uncategorized adjustment
// transaction — no separate reconciliation concept needed.
export function computeBalanceCorrectionCents(currentBalanceCents: number, actualBalanceCents: number): number {
  return actualBalanceCents - currentBalanceCents;
}
