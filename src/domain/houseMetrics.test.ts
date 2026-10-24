import {
  formatDistance,
  houseMetrics,
  markBest,
  parseDistance,
} from './houseMetrics';
import { emptyHouse } from '../db/repositories/housesRepo';
import type { House } from '../db/repositories/housesRepo';

function house(overrides: Partial<House>): House {
  return { id: 1, ...emptyHouse(), ...overrides };
}

describe('houseMetrics', () => {
  const today = '2026-10-22';

  it('prices by the square foot and adds up the fixed monthly costs', () => {
    const m = houseMetrics(
      house({
        askingPriceCents: 90_000_000,
        floorAreaSqft: 1800,
        strataFeeCents: 35_000,
        propertyTaxAnnualCents: 360_000,
        maintenanceMonthlyCents: 20_000,
      }),
      { todayIso: today },
    );
    expect(m.pricePerSqftCents).toBe(50_000);
    expect(m.fixedMonthlyCents).toBe(35_000 + 30_000 + 20_000);
  });

  it('says nothing rather than zero for a listing with no price or costs', () => {
    const m = houseMetrics(house({ name: 'Just a drive-by' }), {
      todayIso: today,
    });
    expect(m.priceCents).toBeNull();
    expect(m.fixedMonthlyCents).toBeNull();
  });

  it('reads asking against assessed and the benchmark, and age', () => {
    const m = houseMetrics(
      house({
        askingPriceCents: 110_000_000,
        assessedValueCents: 100_000_000,
        yearBuilt: 1996,
      }),
      { todayIso: today, benchmarkCents: 100_000_000 },
    );
    expect(m.askingOverAssessed).toBeCloseTo(1.1, 5);
    expect(m.overBenchmark).toBeCloseTo(1.1, 5);
    expect(m.ageYears).toBe(30);
  });

  it('reads a price drop and days on market from the history', () => {
    const m = houseMetrics(house({ askingPriceCents: 95_000_000 }), {
      todayIso: today,
      prices: [
        { id: 1, houseId: 1, date: '2026-09-22', priceCents: 100_000_000 },
        { id: 2, houseId: 1, date: '2026-10-10', priceCents: 95_000_000 },
      ],
    });
    expect(m.priceChangeCents).toBe(-5_000_000);
    expect(m.priceChangeRatio).toBeCloseTo(-0.05, 5);
    expect(m.daysOnMarket).toBe(30);
  });
});

describe('distances', () => {
  it('reads and writes metres', () => {
    expect(parseDistance('400')).toBe(400);
    expect(parseDistance('1.2 km')).toBe(1200);
    expect(parseDistance('')).toBeNull();
    expect(formatDistance(400)).toBe('400 m');
    expect(formatDistance(1250)).toBe('1.3 km');
  });
});

describe('markBest', () => {
  it('marks the lowest where lower is better', () => {
    expect(markBest('price', 'lowerIsBetter', [300, 200, 400]).bestIndex).toBe(
      1,
    );
  });

  it('marks the highest where higher is better', () => {
    expect(
      markBest('sqft', 'higherIsBetter', [1200, 900, 1500]).bestIndex,
    ).toBe(2);
  });

  it('marks nobody on a tie', () => {
    expect(
      markBest('price', 'lowerIsBetter', [200, 200, 400]).bestIndex,
    ).toBeNull();
  });

  it('ignores houses that did not say', () => {
    expect(
      markBest('price', 'lowerIsBetter', [null, 250, null]).bestIndex,
    ).toBe(1);
  });

  it('marks nothing on a neutral row', () => {
    expect(markBest('community', 'neutral', [1, 2]).bestIndex).toBeNull();
  });
});
