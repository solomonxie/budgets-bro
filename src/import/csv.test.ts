import { parseCsv, parseMoneyToCents, parseYnabDate, parseYnabMonth } from './csv';

describe('parseCsv', () => {
  it('parses quoted fields with commas and escaped quotes', () => {
    const csv = '"A","B"\n"1, comma","she said ""hi"""';
    expect(parseCsv(csv)).toEqual([{ A: '1, comma', B: 'she said "hi"' }]);
  });

  it('strips a leading BOM', () => {
    const csv = '﻿"A"\n"1"';
    expect(parseCsv(csv)).toEqual([{ A: '1' }]);
  });

  it('returns one record per row, keyed by header', () => {
    const csv = '"Account","Payee"\n"Checking","Coffee Shop"\n"Checking","Landlord"';
    expect(parseCsv(csv)).toEqual([
      { Account: 'Checking', Payee: 'Coffee Shop' },
      { Account: 'Checking', Payee: 'Landlord' },
    ]);
  });
});

describe('parseMoneyToCents', () => {
  it('parses a plain amount', () => {
    expect(parseMoneyToCents('$100.79')).toBe(10079);
  });

  it('parses a negative amount', () => {
    expect(parseMoneyToCents('-$33.22')).toBe(-3322);
  });

  it('strips thousands separators', () => {
    expect(parseMoneyToCents('$2,562.11')).toBe(256211);
  });

  it('treats empty/zero as zero', () => {
    expect(parseMoneyToCents('$0.00')).toBe(0);
    expect(parseMoneyToCents('')).toBe(0);
  });
});

describe('parseYnabDate', () => {
  it('converts MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(parseYnabDate('09/09/2026')).toBe('2026-09-09');
  });
});

describe('parseYnabMonth', () => {
  it('converts "Mon YYYY" to YYYY-MM', () => {
    expect(parseYnabMonth('Feb 2024')).toBe('2024-02');
    expect(parseYnabMonth('Jan 2023')).toBe('2023-01');
  });
});
