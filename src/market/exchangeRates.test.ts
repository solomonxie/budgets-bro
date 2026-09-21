import { crossRate, fiveYearsAgoISO } from './exchangeRates';

// One table quoted against the euro answers every pair on the page.
const RATES = { EUR: 1, USD: 1.08, CAD: 1.47, CNY: 7.8 };

describe('crossRate', () => {
  it('divides two quotes against the same base', () => {
    expect(crossRate(RATES, 'CAD', 'CNY')).toBeCloseTo(7.8 / 1.47, 10);
    expect(crossRate(RATES, 'EUR', 'USD')).toBeCloseTo(1.08, 10);
  });

  it('is 1 for a currency against itself', () => {
    expect(crossRate(RATES, 'CAD', 'CAD')).toBe(1);
  });

  it('inverts', () => {
    const there = crossRate(RATES, 'USD', 'CNY')!;
    const back = crossRate(RATES, 'CNY', 'USD')!;
    expect(there * back).toBeCloseTo(1, 10);
  });

  it('is null for a currency the table does not carry', () => {
    expect(crossRate(RATES, 'CAD', 'JPY')).toBeNull();
    expect(crossRate({}, 'CAD', 'USD')).toBeNull();
  });
});

describe('fiveYearsAgoISO', () => {
  it('steps back five calendar years', () => {
    expect(fiveYearsAgoISO('2026-09-20')).toBe('2021-09-20');
  });
});
