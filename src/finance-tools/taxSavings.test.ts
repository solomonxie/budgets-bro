import { deductionSavingsCents, flatRateSavingsCents, marginalRateBpsAt, taxOnIncomeCents } from './taxSavings';
import type { TaxBracket } from './taxSavings';

// Test data only — the app ships no bracket tables. These are Canada's 2025
// federal bands, used here because they're a published progressive schedule
// with an open-ended top.
const FEDERAL_2025: TaxBracket[] = [
  { upToCents: 5_737_500, rateBps: 1450 },
  { upToCents: 11_475_000, rateBps: 2050 },
  { upToCents: 17_788_200, rateBps: 2600 },
  { upToCents: 25_341_400, rateBps: 2900 },
  { upToCents: null, rateBps: 3300 },
];

describe('taxOnIncomeCents', () => {
  it('taxes income inside the first band at that rate alone', () => {
    expect(taxOnIncomeCents(5_000_000, FEDERAL_2025)).toBe(Math.round(5_000_000 * 0.145));
  });

  it('stacks bands rather than applying one rate to everything', () => {
    // $100,000: 14.5% on the first $57,375, 20.5% on the rest.
    const expected = Math.round(5_737_500 * 0.145 + (10_000_000 - 5_737_500) * 0.205);
    expect(taxOnIncomeCents(10_000_000, FEDERAL_2025)).toBe(expected);
  });

  it('applies the open-ended top band above the last threshold', () => {
    const atThreshold = taxOnIncomeCents(25_341_400, FEDERAL_2025);
    expect(taxOnIncomeCents(35_341_400, FEDERAL_2025)).toBe(atThreshold + Math.round(10_000_000 * 0.33));
  });

  it('owes nothing on no income', () => {
    expect(taxOnIncomeCents(0, FEDERAL_2025)).toBe(0);
    expect(taxOnIncomeCents(-100, FEDERAL_2025)).toBe(0);
  });

  it('computes the same tax from a table typed in any order', () => {
    const shuffled = [FEDERAL_2025[4], FEDERAL_2025[1], FEDERAL_2025[3], FEDERAL_2025[0], FEDERAL_2025[2]];
    expect(taxOnIncomeCents(20_000_000, shuffled)).toBe(taxOnIncomeCents(20_000_000, FEDERAL_2025));
  });

  it('handles a single flat band', () => {
    expect(taxOnIncomeCents(10_000_000, [{ upToCents: null, rateBps: 2000 }])).toBe(2_000_000);
  });
});

describe('marginalRateBpsAt', () => {
  it('finds the band the income lands in', () => {
    expect(marginalRateBpsAt(5_000_000, FEDERAL_2025)).toBe(1450);
    expect(marginalRateBpsAt(10_000_000, FEDERAL_2025)).toBe(2050);
    expect(marginalRateBpsAt(30_000_000, FEDERAL_2025)).toBe(3300);
  });

  it('treats a threshold as the top of its own band', () => {
    expect(marginalRateBpsAt(5_737_500, FEDERAL_2025)).toBe(1450);
    expect(marginalRateBpsAt(5_737_501, FEDERAL_2025)).toBe(2050);
  });
});

describe('deductionSavingsCents', () => {
  it('equals the marginal rate when the deduction stays inside one band', () => {
    // $100,000 income, $10,000 deduction — all within the 20.5% band.
    expect(deductionSavingsCents(10_000_000, 1_000_000, FEDERAL_2025)).toBe(205_000);
  });

  it('is less than the marginal rate suggests when the deduction straddles a boundary', () => {
    // $60,000 income, $10,000 deduction: only $2,625 of it comes off at
    // 20.5%, the rest at 14.5%. This is the case the flat answer gets wrong.
    const real = deductionSavingsCents(6_000_000, 1_000_000, FEDERAL_2025);
    const flat = flatRateSavingsCents(1_000_000, marginalRateBpsAt(6_000_000, FEDERAL_2025));
    expect(real).toBe(160_750);
    expect(real).toBeLessThan(flat);
  });

  it('never saves more than the deduction itself', () => {
    expect(deductionSavingsCents(10_000_000, 50_000_000, FEDERAL_2025)).toBeLessThanOrEqual(50_000_000);
  });

  it('stops at zero taxable income rather than going negative', () => {
    const all = deductionSavingsCents(5_000_000, 9_000_000, FEDERAL_2025);
    expect(all).toBe(taxOnIncomeCents(5_000_000, FEDERAL_2025));
  });

  it('saves nothing on a zero or negative deduction', () => {
    expect(deductionSavingsCents(10_000_000, 0, FEDERAL_2025)).toBe(0);
    expect(deductionSavingsCents(10_000_000, -500, FEDERAL_2025)).toBe(0);
  });
});

describe('flatRateSavingsCents', () => {
  it('is the deduction times the rate', () => {
    expect(flatRateSavingsCents(1_000_000, 3200)).toBe(320_000);
  });

  it('saves nothing on a negative deduction', () => {
    expect(flatRateSavingsCents(-1_000_000, 3200)).toBe(0);
  });
});
