// Money moving between two of your own accounts is one event and two rows —
// one per account, exact opposite amounts, each naming the other side. This
// checks that the ledger actually says that, and says precisely how it
// doesn't where it doesn't.
//
// Two mechanisms produce these pairs (see transactionsRepo): an explicit
// transfer (createTransfer, both rows marked with transfer_account_id), and
// an account-linked payee (createTransaction + postLinkedAccountLeg, which
// historically marked only the mirror). So a row can be half of a pair by
// its mark, by its payee, or by both — and the ones that are half of a pair
// by neither, while their partner thinks otherwise, are the bug.

export interface TransferRow {
  id: number;
  accountId: number;
  transferAccountId: number | null;
  // Null when the row names nobody at all — which is what a transfer leg
  // imported from YNAB looks like, and what reads as "(No payee)".
  payeeId: number | null;
  // The account this row's payee is named after, if its payee is an
  // account-linked one (payeesRepo.ensureAccountPayee). Null for a plain
  // payee.
  payeeLinkedAccountId: number | null;
  amountCents: number;
  date: string;
}

export type TransferViolation =
  // Half of a pair, and the other half is missing entirely: the money left
  // one account and arrived nowhere.
  | { kind: 'missingLeg'; row: TransferRow; counterpartAccountId: number }
  // Both rows exist but don't cancel — including both pointing the same way.
  | { kind: 'amountMismatch'; row: TransferRow; partner: TransferRow }
  // Paired and correct, but one side never got its transfer_account_id.
  | { kind: 'unmarked'; row: TransferRow; counterpartAccountId: number }
  // Names its own account, which says nothing (see migration 027).
  | { kind: 'selfNamed'; row: TransferRow }
  // Half of a pair and named nothing at all — reads as "(No payee)" in every
  // list. Migration 026 backfilled the ones that existed then; anything
  // imported since arrives this way again.
  | { kind: 'unnamedLeg'; row: TransferRow; counterpartAccountId: number };

// Which account this row is supposed to have a partner in. The mark wins
// over the payee: an explicit transfer says so outright, while the payee is
// a convention a plain payee could coincidentally share.
export function counterpartAccountId(row: TransferRow): number | null {
  if (row.transferAccountId != null && row.transferAccountId !== row.accountId)
    return row.transferAccountId;
  if (
    row.payeeLinkedAccountId != null &&
    row.payeeLinkedAccountId !== row.accountId
  )
    return row.payeeLinkedAccountId;
  return null;
}

export function isSelfNamed(row: TransferRow): boolean {
  return row.payeeLinkedAccountId === row.accountId;
}

interface Pair {
  a: TransferRow;
  b: TransferRow;
}

function bucketKey(row: TransferRow, counterpart: number): string {
  const [lo, hi] =
    row.accountId < counterpart
      ? [row.accountId, counterpart]
      : [counterpart, row.accountId];
  return `${lo}|${hi}|${row.date}`;
}

// Same two accounts, same day. Matched on the exact negation first so a day
// with several transfers between the same pair of accounts pairs them off
// correctly rather than by list order; whatever is left over on both sides
// is then paired anyway, which is what surfaces a broken amount instead of
// reporting two unrelated missing legs.
export function matchPairs(rows: TransferRow[]): {
  pairs: Pair[];
  unpaired: TransferRow[];
} {
  const buckets = new Map<string, TransferRow[]>();
  const unpaired: TransferRow[] = [];
  for (const row of rows) {
    const counterpart = counterpartAccountId(row);
    if (counterpart == null) continue;
    const key = bucketKey(row, counterpart);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const pairs: Pair[] = [];
  for (const list of buckets.values()) {
    const taken = new Set<number>();
    const sideOf = (row: TransferRow) => row.accountId;
    for (const a of list) {
      if (taken.has(a.id)) continue;
      const exact = list.find(
        (b) =>
          !taken.has(b.id) &&
          b.id !== a.id &&
          sideOf(b) !== sideOf(a) &&
          b.amountCents === -a.amountCents,
      );
      if (!exact) continue;
      taken.add(a.id);
      taken.add(exact.id);
      pairs.push({ a, b: exact });
    }
    const leftovers = list.filter((row) => !taken.has(row.id));
    for (const a of leftovers) {
      if (taken.has(a.id)) continue;
      const other = leftovers.find(
        (b) => !taken.has(b.id) && b.id !== a.id && sideOf(b) !== sideOf(a),
      );
      if (!other) {
        unpaired.push(a);
        continue;
      }
      taken.add(a.id);
      taken.add(other.id);
      pairs.push({ a, b: other });
    }
  }
  return { pairs, unpaired };
}

export function auditTransfers(rows: TransferRow[]): TransferViolation[] {
  const violations: TransferViolation[] = [];
  const { pairs, unpaired } = matchPairs(rows);

  for (const row of rows) {
    if (isSelfNamed(row)) violations.push({ kind: 'selfNamed', row });
    const counterpart = counterpartAccountId(row);
    if (row.payeeId == null && counterpart != null)
      violations.push({
        kind: 'unnamedLeg',
        row,
        counterpartAccountId: counterpart,
      });
  }

  for (const row of unpaired) {
    const counterpart = counterpartAccountId(row);
    if (counterpart != null)
      violations.push({
        kind: 'missingLeg',
        row,
        counterpartAccountId: counterpart,
      });
  }

  for (const { a, b } of pairs) {
    if (a.amountCents !== -b.amountCents) {
      violations.push({ kind: 'amountMismatch', row: a, partner: b });
      continue;
    }
    for (const [row, other] of [
      [a, b],
      [b, a],
    ] as const) {
      if (row.transferAccountId !== other.accountId)
        violations.push({
          kind: 'unmarked',
          row,
          counterpartAccountId: other.accountId,
        });
    }
  }

  return violations;
}

// Whether a violation can be repaired without moving money. `unmarked`,
// `selfNamed` and `unnamedLeg` only rewrite what a row is *called* and what
// it points at;
// `missingLeg` posts a transaction and changes an account's balance, and
// `amountMismatch` can't be resolved without knowing which side is right —
// both of those are the user's call, not a background fixup.
export function isSafeToAutoFix(violation: TransferViolation): boolean {
  return (
    violation.kind === 'unmarked' ||
    violation.kind === 'selfNamed' ||
    violation.kind === 'unnamedLeg'
  );
}

export interface AuditSummary {
  missingLeg: number;
  amountMismatch: number;
  unmarked: number;
  selfNamed: number;
  unnamedLeg: number;
}

export function summarize(violations: TransferViolation[]): AuditSummary {
  const summary: AuditSummary = {
    missingLeg: 0,
    amountMismatch: 0,
    unmarked: 0,
    selfNamed: 0,
    unnamedLeg: 0,
  };
  for (const violation of violations) summary[violation.kind] += 1;
  return summary;
}
