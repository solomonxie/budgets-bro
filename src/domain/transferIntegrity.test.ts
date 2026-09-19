import {
  auditTransfers,
  counterpartAccountId,
  isSafeToAutoFix,
  matchPairs,
  summarize,
} from './transferIntegrity';
import type { TransferRow } from './transferIntegrity';

const CHEQUING = 1;
const SAVINGS = 2;
const MORTGAGE = 3;

let nextId = 1;
const row = (over: Partial<TransferRow>): TransferRow => ({
  id: nextId++,
  accountId: CHEQUING,
  transferAccountId: null,
  payeeId: 99,
  payeeLinkedAccountId: null,
  amountCents: -10_000,
  date: '2026-09-01',
  ...over,
});

beforeEach(() => {
  nextId = 1;
});

describe('counterpartAccountId', () => {
  it('prefers the explicit mark over the payee', () => {
    expect(
      counterpartAccountId(
        row({ transferAccountId: SAVINGS, payeeLinkedAccountId: MORTGAGE }),
      ),
    ).toBe(SAVINGS);
  });

  it('falls back to an account-linked payee', () => {
    expect(counterpartAccountId(row({ payeeLinkedAccountId: SAVINGS }))).toBe(
      SAVINGS,
    );
  });

  it('is nothing for a plain payee, or a row naming itself', () => {
    expect(counterpartAccountId(row({}))).toBeNull();
    expect(
      counterpartAccountId(row({ payeeLinkedAccountId: CHEQUING })),
    ).toBeNull();
  });
});

describe('auditTransfers', () => {
  it('passes a properly marked pair', () => {
    const rows = [
      row({ accountId: CHEQUING, transferAccountId: SAVINGS, amountCents: -10_000 }),
      row({ accountId: SAVINGS, transferAccountId: CHEQUING, amountCents: 10_000 }),
    ];
    expect(auditTransfers(rows)).toEqual([]);
  });

  it('flags a payee-linked pair where only the mirror got marked', () => {
    // What createTransaction + postLinkedAccountLeg used to leave behind.
    const rows = [
      row({ accountId: CHEQUING, payeeLinkedAccountId: MORTGAGE, amountCents: -80_000 }),
      row({ accountId: MORTGAGE, transferAccountId: CHEQUING, payeeLinkedAccountId: CHEQUING, amountCents: 80_000 }),
    ];
    const violations = auditTransfers(rows);
    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe('unmarked');
    expect(violations[0].row.accountId).toBe(CHEQUING);
    expect(violations.every(isSafeToAutoFix)).toBe(true);
  });

  it('flags a one-sided payment as a missing leg', () => {
    const rows = [
      row({ accountId: CHEQUING, payeeLinkedAccountId: MORTGAGE, amountCents: -80_000 }),
    ];
    const violations = auditTransfers(rows);
    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe('missingLeg');
    expect(isSafeToAutoFix(violations[0])).toBe(false);
  });

  it('flags a pair that does not cancel', () => {
    const rows = [
      row({ accountId: CHEQUING, transferAccountId: SAVINGS, amountCents: -10_000 }),
      row({ accountId: SAVINGS, transferAccountId: CHEQUING, amountCents: 9_000 }),
    ];
    const violations = auditTransfers(rows);
    expect(violations.map((v) => v.kind)).toEqual(['amountMismatch']);
  });

  it('flags two legs pointing the same way', () => {
    const rows = [
      row({ accountId: CHEQUING, transferAccountId: SAVINGS, amountCents: -10_000 }),
      row({ accountId: SAVINGS, transferAccountId: CHEQUING, amountCents: -10_000 }),
    ];
    expect(auditTransfers(rows).map((v) => v.kind)).toEqual(['amountMismatch']);
  });

  it('flags a row naming its own account', () => {
    // The old loan-form convention: account and payee both the mortgage.
    const rows = [
      row({ accountId: MORTGAGE, payeeLinkedAccountId: MORTGAGE, amountCents: 80_000 }),
    ];
    const violations = auditTransfers(rows);
    expect(violations.map((v) => v.kind)).toEqual(['selfNamed']);
  });

  it('flags both legs of a transfer that names nobody', () => {
    // Exactly what the YNAB importer leaves behind: marked on both sides,
    // amounts cancel, payee null.
    const rows = [
      row({ accountId: CHEQUING, transferAccountId: SAVINGS, payeeId: null, amountCents: -10_000 }),
      row({ accountId: SAVINGS, transferAccountId: CHEQUING, payeeId: null, amountCents: 10_000 }),
    ];
    const violations = auditTransfers(rows);
    expect(violations.map((v) => v.kind)).toEqual(['unnamedLeg', 'unnamedLeg']);
    expect(violations.every(isSafeToAutoFix)).toBe(true);
    expect(
      violations.map((v) => (v.kind === 'unnamedLeg' ? v.counterpartAccountId : null)),
    ).toEqual([SAVINGS, CHEQUING]);
  });

  it('leaves an ordinary spend alone', () => {
    expect(auditTransfers([row({ payeeLinkedAccountId: null })])).toEqual([]);
  });
});

describe('matchPairs', () => {
  it('pairs several same-day transfers between the same accounts by amount', () => {
    const rows = [
      row({ accountId: CHEQUING, transferAccountId: SAVINGS, amountCents: -10_000 }),
      row({ accountId: CHEQUING, transferAccountId: SAVINGS, amountCents: -25_000 }),
      row({ accountId: SAVINGS, transferAccountId: CHEQUING, amountCents: 25_000 }),
      row({ accountId: SAVINGS, transferAccountId: CHEQUING, amountCents: 10_000 }),
    ];
    const { pairs, unpaired } = matchPairs(rows);
    expect(unpaired).toEqual([]);
    expect(pairs).toHaveLength(2);
    for (const { a, b } of pairs) expect(a.amountCents).toBe(-b.amountCents);
  });

  it('keeps legs on different days apart', () => {
    const rows = [
      row({ accountId: CHEQUING, transferAccountId: SAVINGS, amountCents: -10_000, date: '2026-09-01' }),
      row({ accountId: SAVINGS, transferAccountId: CHEQUING, amountCents: 10_000, date: '2026-09-02' }),
    ];
    expect(matchPairs(rows).unpaired).toHaveLength(2);
  });
});

describe('summarize', () => {
  it('counts by kind', () => {
    const rows = [
      row({ accountId: CHEQUING, payeeLinkedAccountId: MORTGAGE, amountCents: -80_000 }),
      row({ accountId: MORTGAGE, payeeLinkedAccountId: MORTGAGE, amountCents: 80_000 }),
    ];
    expect(summarize(auditTransfers(rows))).toEqual({
      missingLeg: 1,
      amountMismatch: 0,
      unmarked: 0,
      selfNamed: 1,
      unnamedLeg: 0,
    });
  });
});
