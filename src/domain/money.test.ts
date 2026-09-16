import { formatMoney, formatMoneyCompact, formatPercent, parseMoneyToCents } from './money';

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

  it('honours a custom currency symbol, keeping the sign outside it', () => {
    expect(formatMoney(120000000, { symbol: '¥' })).toBe('¥1,200,000');
    expect(formatMoney(-4850, { symbol: '¥' })).toBe('-¥48.50');
  });
});

describe('formatMoneyCompact', () => {
  it('leaves values under $1k unabbreviated', () => {
    expect(formatMoneyCompact(99900)).toBe('$999');
  });

  it('keeps one decimal between $1k and $10k', () => {
    expect(formatMoneyCompact(123400)).toBe('$1.2k');
  });

  it('drops the decimal at $10k and above', () => {
    expect(formatMoneyCompact(1234500)).toBe('$12k');
  });
});

describe('formatPercent', () => {
  it('renders basis points as a two-decimal percentage', () => {
    expect(formatPercent(650)).toBe('6.50%');
    expect(formatPercent(0)).toBe('0.00%');
    expect(formatPercent(3.5 * 100)).toBe('3.50%');
  });
});

describe('parseMoneyToCents', () => {
  it('treats an empty field as zero', () => {
    expect(parseMoneyToCents('')).toBe(0);
  });

  it('strips grouping separators and currency symbols', () => {
    expect(parseMoneyToCents('1,234.5')).toBe(123450);
    expect(parseMoneyToCents('$1,234')).toBe(123400);
    expect(parseMoneyToCents('¥1 200 000')).toBe(120000000);
  });

  it('keeps a negative sign', () => {
    expect(parseMoneyToCents('-3')).toBe(-300);
  });

  it('returns zero rather than NaN for junk', () => {
    expect(parseMoneyToCents('abc')).toBe(0);
    expect(parseMoneyToCents('.')).toBe(0);
  });
});
