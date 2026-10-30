import { estimateRefund, grossFromNet, incomeTax, rrspRoomEstimate } from './canadaIncomeTax';

describe('canadaIncomeTax', () => {
  it('taxes nothing under the basic personal amounts', () => {
    expect(incomeTax(12_000, 'ON', 2026)).toBe(0);
  });

  it('lands an Ontario $100k salary near its published tax', () => {
    // Roughly $22k combined on $100k in Ontario, before surtax.
    const tax = incomeTax(100_000, 'ON', 2026);
    expect(tax).toBeGreaterThan(19_000);
    expect(tax).toBeLessThan(23_000);
  });

  it('recovers gross pay from what was deposited', () => {
    const gross = grossFromNet(70_000, 'ON', 2026);
    expect(gross).toBeGreaterThan(90_000);
    expect(gross).toBeLessThan(105_000);
  });

  it('caps RRSP room at the dollar limit', () => {
    expect(rrspRoomEstimate(100_000, 2026)).toBe(18_000);
    expect(rrspRoomEstimate(500_000, 2026)).toBe(33_810);
  });

  it('refunds a deduction at the top rate and charges untaxed interest', () => {
    const r = estimateRefund({ year: 2026, province: 'ON', grossPay: 100_000, untaxedIncome: 1_000, deductions: 10_000, donations: 0 });
    expect(r.fromDeductions).toBeCloseTo(10_000 * (0.205 + 0.0915), -1);
    expect(r.fromUntaxedIncome).toBeCloseTo(-1_000 * (0.205 + 0.0915), -1);
    expect(r.taxableIncome).toBe(91_000);
  });

  it('credits donations, more past the first $200', () => {
    const r = estimateRefund({ year: 2026, province: 'ON', grossPay: 100_000, untaxedIncome: 0, deductions: 0, donations: 1_200 });
    expect(r.fromDonations).toBeCloseTo(200 * (0.14 + 0.0505) + 1_000 * (0.29 + 0.1316), 0);
  });
});
