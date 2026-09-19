import { buildEquitySeries, owedAtMonth } from './equityHistory';

// $216,000 bought with 20% down: $43,200 of equity on day one and a
// $172,800 mortgage over 30 years at 3.2%.
const terms = {
  originalPrincipalCents: 17_280_000,
  originationDate: '2023-06-05',
  termMonths: 360,
  openingBalanceCents: -17_280_000,
  fallbackDate: '2023-06-05',
};
const RATE_BPS = 320;

describe('owedAtMonth', () => {
  it('owes the whole loan the month it was signed', () => {
    expect(
      owedAtMonth({
        month: '2023-06',
        terms,
        principalReadings: [],
        payments: [],
        annualRateBps: RATE_BPS,
        asOfDate: '2026-09-19',
      }),
    ).toBe(17_280_000);
  });

  it('follows the contract down through months with nothing logged', () => {
    const owed = owedAtMonth({
      month: '2025-06',
      terms,
      principalReadings: [],
      payments: [],
      annualRateBps: RATE_BPS,
      asOfDate: '2026-09-19',
    });
    expect(owed).toBeLessThan(17_280_000);
    expect(owed).toBeGreaterThan(16_000_000);
  });

  it('takes a logged statement over the schedule, then the payments since', () => {
    const readings = [{ valueCents: 16_700_000, effectiveDate: '2026-01-31' }];
    const payments = [{ date: '2026-03-05', amountCents: 74_400 }];
    expect(
      owedAtMonth({
        month: '2026-01',
        terms,
        principalReadings: readings,
        payments,
        annualRateBps: RATE_BPS,
        asOfDate: '2026-09-19',
      }),
    ).toBe(16_700_000);
    // A month on, that payment is mostly interest at 3.2% on $167,000, so
    // the debt falls by well under the $744 paid.
    const march = owedAtMonth({
      month: '2026-03',
      terms,
      principalReadings: readings,
      payments,
      annualRateBps: RATE_BPS,
      asOfDate: '2026-09-19',
    });
    expect(march).toBeLessThan(16_700_000);
    expect(march).toBeGreaterThan(16_700_000 - 74_400);
  });
});

describe('buildEquitySeries', () => {
  it('starts at the down payment and hands the debt over to equity', () => {
    const series = buildEquitySeries({
      months: ['2023-06', '2023-07', '2025-06'],
      valueReadings: [{ valueCents: 21_600_000, effectiveDate: '2023-06-05' }],
      principalReadings: [],
      payments: [],
      terms,
      originalHousePriceCents: 21_600_000,
      annualRateBps: RATE_BPS,
      asOfDate: '2026-09-19',
    });
    // Day one: the debt is the whole loan and the equity is the 20% down.
    expect(series[0]).toEqual({
      date: '2023-06-01',
      totalCents: 21_600_000,
      depositedCents: 17_280_000,
      gainCents: 4_320_000,
    });
    // Two years on, the bands have moved toward each other.
    expect(series[2].depositedCents).toBeLessThan(series[0].depositedCents);
    expect(series[2].gainCents).toBeGreaterThan(series[0].gainCents);
    // The two bands always sum to what the home is worth.
    for (const p of series) {
      expect(p.depositedCents + p.gainCents).toBe(p.totalCents);
    }
  });

  it('values the home at its purchase price until one is logged by hand', () => {
    const series = buildEquitySeries({
      months: ['2023-06', '2023-07'],
      valueReadings: [{ valueCents: 23_600_000, effectiveDate: '2023-07-10' }],
      principalReadings: [],
      payments: [],
      terms,
      originalHousePriceCents: 21_600_000,
      annualRateBps: RATE_BPS,
      asOfDate: '2026-09-19',
    });
    expect(series[0].totalCents).toBe(21_600_000);
    expect(series[1].totalCents).toBe(23_600_000);
  });
});
