import { remainingPrincipal } from './remainingPrincipal';

const loan = {
  loggedPrincipal: null,
  originalPrincipalCents: 30_000_000,
  originationDate: '2026-01-01',
  openingBalanceCents: -30_000_000,
  fallbackDate: '2026-01-01',
  annualRateBps: 600,
  termMonths: null,
  asOfDate: '2026-12-31',
  payments: [],
};

describe('remainingPrincipal', () => {
  it('falls back to the amount borrowed when nothing has been logged', () => {
    const result = remainingPrincipal(loan);
    expect(result.owedCents).toBe(30_000_000);
    expect(result.anchorWasLogged).toBe(false);
  });

  it('a payment takes off only its principal share, not the whole amount', () => {
    const result = remainingPrincipal({ ...loan, payments: [{ date: '2026-02-01', amountCents: 200_000 }] });
    // $1,500 of the $2,000 was that month's interest.
    expect(result.owedCents).toBe(29_950_000);
  });

  it('a mortgage older than the ledger falls back to its own schedule', () => {
    // Ten years in, with one lonely payment on file: the split walks a
    // decade of interest onto an untouched principal and comes out owing
    // more than was borrowed. The contract says otherwise.
    const result = remainingPrincipal({
      ...loan,
      termMonths: 360,
      asOfDate: '2036-01-01',
      payments: [{ date: '2036-01-01', amountCents: 200_000 }],
    });
    expect(result.owedCents).toBe(25_105_743);
    expect(result.cappedToSchedule).toBe(true);
  });

  it('with no term on file an unlogged loan still never grows', () => {
    const result = remainingPrincipal({
      ...loan,
      asOfDate: '2036-01-01',
      payments: [{ date: '2036-01-01', amountCents: 200_000 }],
    });
    expect(result.owedCents).toBe(30_000_000);
    expect(result.cappedToSchedule).toBe(true);
  });

  it('lets a drawn-on line of credit grow past what was first borrowed', () => {
    const result = remainingPrincipal({
      ...loan,
      asOfDate: '2026-12-31',
      payments: [{ date: '2026-06-01', amountCents: -5_000_000 }],
    });
    expect(result.owedCents).toBeGreaterThan(35_000_000);
    expect(result.cappedToSchedule).toBe(false);
  });

  it('a logged reading is never capped — the statement wins', () => {
    const result = remainingPrincipal({
      ...loan,
      termMonths: 360,
      asOfDate: '2036-01-01',
      loggedPrincipal: { valueCents: 29_000_000, effectiveDate: '2035-12-01' },
    });
    expect(result.owedCents).toBe(29_000_000);
    expect(result.cappedToSchedule).toBe(false);
  });

  it('a logged reading is ground truth and re-anchors what follows', () => {
    const result = remainingPrincipal({
      ...loan,
      loggedPrincipal: { valueCents: 25_000_000, effectiveDate: '2026-06-01' },
      payments: [
        { date: '2026-02-01', amountCents: 200_000 },
        { date: '2026-07-01', amountCents: 200_000 },
      ],
    });
    expect(result.anchorOwedCents).toBe(25_000_000);
    expect(result.anchorWasLogged).toBe(true);
    // Only the July payment counts; February is already inside the reading.
    expect(result.paymentsSinceAnchor).toBe(1);
    expect(result.owedCents).toBe(24_925_000);
  });

  it('ignores a payment dated on the reading itself', () => {
    const result = remainingPrincipal({
      ...loan,
      loggedPrincipal: { valueCents: 25_000_000, effectiveDate: '2026-06-01' },
      payments: [{ date: '2026-06-01', amountCents: 200_000 }],
    });
    expect(result.paymentsSinceAnchor).toBe(0);
    expect(result.owedCents).toBe(25_000_000);
  });

  it('with no rate on file every payment counts as principal', () => {
    const result = remainingPrincipal({
      ...loan,
      annualRateBps: null,
      payments: [{ date: '2026-02-01', amountCents: 200_000 }],
    });
    expect(result.splitInterest).toBe(false);
    expect(result.owedCents).toBe(29_800_000);
  });

  it('treats an interest-free loan as a full-principal one, honestly', () => {
    const result = remainingPrincipal({
      ...loan,
      annualRateBps: 0,
      payments: [{ date: '2026-02-01', amountCents: 200_000 }],
    });
    expect(result.splitInterest).toBe(false);
    expect(result.owedCents).toBe(29_800_000);
  });

  it('uses the opening balance when the loan has no terms at all', () => {
    const result = remainingPrincipal({
      ...loan,
      originalPrincipalCents: null,
      originationDate: null,
      openingBalanceCents: -12_000_000,
      payments: [],
    });
    expect(result.owedCents).toBe(12_000_000);
    expect(result.anchorDate).toBe('2026-01-01');
  });

  it('never reports a negative balance once the loan is paid off', () => {
    const result = remainingPrincipal({
      ...loan,
      loggedPrincipal: { valueCents: 100_000, effectiveDate: '2026-06-01' },
      payments: [{ date: '2026-07-01', amountCents: 500_000 }],
    });
    expect(result.owedCents).toBe(0);
  });
});
