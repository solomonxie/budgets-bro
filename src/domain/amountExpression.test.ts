import {
  EMPTY_AMOUNT,
  amountCents,
  amountFromCents,
  formatAmountExpression,
  pressAmountKey,
} from './amountExpression';
import type { AmountScale } from './amountExpression';

function type(keys: string, scale: AmountScale = 1) {
  return [...keys].reduce(
    (expr, key) => pressAmountKey(expr, key, scale),
    EMPTY_AMOUNT,
  );
}

describe('amountExpression', () => {
  it('reads digits right-to-left as cents', () => {
    expect(amountCents(type('4444'))).toBe(4444);
    expect(formatAmountExpression(type('4444'))).toBe('$44.44');
    expect(formatAmountExpression(EMPTY_AMOUNT)).toBe('');
  });

  it('shows both sides while an operation is pending', () => {
    expect(formatAmountExpression(type('5500+3600'))).toBe('$55.00 + $36.00');
    expect(formatAmountExpression(type('5500+'))).toBe('$55.00 +');
    expect(amountCents(type('5500+3600'))).toBe(9100);
    expect(amountCents(type('5500+'))).toBe(5500);
  });

  it('multiplies and divides by the plain number typed', () => {
    expect(amountCents(type('5500×300'))).toBe(16500);
    expect(amountCents(type('1000÷400'))).toBe(250);
    expect(amountCents(type('1000÷300'))).toBe(333);
  });

  it('leaves the left side alone when dividing by nothing', () => {
    expect(amountCents(type('1000÷0'))).toBe(1000);
  });

  it('floors at zero — the toggle owns the sign, not the pad', () => {
    expect(amountCents(type('500−800'))).toBe(0);
  });

  it('chains one operation into the next', () => {
    expect(formatAmountExpression(type('100+200+'))).toBe('$3.00 +');
    expect(amountCents(type('100+200+300'))).toBe(600);
  });

  it('swaps the operator when two are typed in a row', () => {
    expect(formatAmountExpression(type('500+−'))).toBe('$5.00 −');
  });

  it('collapses to the result on =', () => {
    const result = type('5500+3600=');
    expect(formatAmountExpression(result)).toBe('$91.00');
    expect(result.operator).toBeNull();
    expect(pressAmountKey(type('500='), '=')).toEqual(type('500'));
  });

  it('backspaces the entry, then the operator, then the banked total', () => {
    expect(formatAmountExpression(type('5500+36⌫'))).toBe('$55.00 + $0.03');
    expect(formatAmountExpression(type('5500+⌫'))).toBe('$55.00');
    expect(formatAmountExpression(type('5500+3600=⌫'))).toBe('$9.10');
  });

  it('ignores an operator typed into an empty field', () => {
    expect(type('+')).toEqual(EMPTY_AMOUNT);
  });

  it('caps the entry at nine digits', () => {
    expect(formatAmountExpression(type('1234567890'))).toBe('$1,234,567.89');
  });

  it('loads an existing transaction as plain digits', () => {
    expect(formatAmountExpression(amountFromCents(-4250))).toBe('$42.50');
    expect(formatAmountExpression(amountFromCents(0))).toBe('');
  });

  it('clears everything on C', () => {
    expect(type('5500+3600C')).toEqual(EMPTY_AMOUNT);
  });
});

describe('whole units (scale 100)', () => {
  it('reads digits as whole units', () => {
    expect(amountCents(type('100', 100), 100)).toBe(10000);
    expect(formatAmountExpression(type('1234', 100), '', 100)).toBe('1,234');
  });

  it('multiplies and evaluates in units', () => {
    const expr = type('55×3=', 100);
    expect(amountCents(expr, 100)).toBe(16500);
    expect(expr.digits).toBe('165');
  });

  it('hands the banked side back as units on ⌫', () => {
    expect(type('120+⌫', 100).digits).toBe('120');
  });
});
