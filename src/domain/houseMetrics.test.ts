import { DEFAULT_ASSUMPTIONS, houseMetrics, markBest } from './houseMetrics';
import { emptyHouse } from '../db/repositories/housesRepo';
import type { House } from '../db/repositories/housesRepo';

function house(overrides: Partial<House>): House {
  return { id: 1, ...emptyHouse(), ...overrides };
}

describe('houseMetrics', () => {
  it('prices a listing by the square foot and by the month', () => {
    const metrics = houseMetrics(
      house({
        askingPriceCents: 90_000_000,
        floorAreaSqft: 1800,
        strataFeeCents: 35_000,
        propertyTaxAnnualCents: 360_000,
      }),
      DEFAULT_ASSUMPTIONS,
      2026,
    );
    expect(metrics.pricePerSqftCents).toBe(50_000); // $500/sqft
    expect(metrics.downPaymentCents).toBe(18_000_000);
    expect(metrics.mortgageCents).toBe(72_000_000);
    expect(metrics.insurancePremiumCents).toBe(0);
    expect(metrics.taxMonthlyCents).toBe(30_000);
    // Payment plus strata, tax and the utilities assumption.
    expect(metrics.carryingMonthlyCents).toBe(
      (metrics.paymentMonthlyCents ?? 0) + 35_000 + 30_000 + 25_000,
    );
  });

  it('uses the legal minimum down payment when none is assumed', () => {
    const metrics = houseMetrics(
      house({ askingPriceCents: 70_000_000 }),
      { ...DEFAULT_ASSUMPTIONS, downPaymentPercent: null },
      2026,
    );
    expect(metrics.downPaymentCents).toBe(4_500_000);
    // Under 20% down the premium is financed, so the mortgage exceeds the gap.
    expect(metrics.insurancePremiumCents).toBeGreaterThan(0);
    expect(metrics.mortgageCents).toBeGreaterThan(65_500_000);
  });

  it('says nothing rather than zero for a listing with no price yet', () => {
    const metrics = houseMetrics(house({ name: 'Just a drive-by' }), DEFAULT_ASSUMPTIONS, 2026);
    expect(metrics.priceCents).toBeNull();
    expect(metrics.carryingMonthlyCents).toBeNull();
  });

  it('reads asking against assessed, and age from the year built', () => {
    const metrics = houseMetrics(
      house({ askingPriceCents: 110_000_000, assessedValueCents: 100_000_000, yearBuilt: 1996 }),
      DEFAULT_ASSUMPTIONS,
      2026,
    );
    expect(metrics.askingOverAssessed).toBeCloseTo(1.1, 5);
    expect(metrics.ageYears).toBe(30);
  });
});

describe('markBest', () => {
  it('marks the lowest where lower is better', () => {
    expect(markBest('price', 'lowerIsBetter', [300, 200, 400]).bestIndex).toBe(1);
  });

  it('marks the highest where higher is better', () => {
    expect(markBest('sqft', 'higherIsBetter', [1200, 900, 1500]).bestIndex).toBe(2);
  });

  it('marks nobody on a tie', () => {
    expect(markBest('price', 'lowerIsBetter', [200, 200, 400]).bestIndex).toBeNull();
  });

  it('ignores houses that did not say', () => {
    expect(markBest('price', 'lowerIsBetter', [null, 250, null]).bestIndex).toBe(1);
  });

  it('marks nothing on a neutral row', () => {
    expect(markBest('community', 'neutral', [1, 2]).bestIndex).toBeNull();
  });
});
