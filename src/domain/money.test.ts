import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formats whole dollars without cents', () => {
    expect(formatMoney(180000)).toBe('$1,800');
  });

  it('formats cents when present', () => {
    expect(formatMoney(214532)).toBe('$2,145.32');
  });

  it('formats negative amounts', () => {
    expect(formatMoney(-4850)).toBe('-$48.50');
  });

  it('formats zero', () => {
    expect(formatMoney(0)).toBe('$0');
  });
});
