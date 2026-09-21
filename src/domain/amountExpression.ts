// The amount field is a small calculator: digits are read right-to-left as
// cents ("4444" is $44.44), and an operator key banks what is typed so far
// as the left side. Only one operation is ever pending — pressing a second
// operator evaluates the first, the way a pocket calculator chains.
export type AmountOperator = '+' | '−' | '×' | '÷';
export type AmountKey = AmountOperator | '=' | 'C' | '⌫' | string;

export interface AmountExpression {
  leftCents: number | null;
  operator: AmountOperator | null;
  digits: string;
}

export const EMPTY_AMOUNT: AmountExpression = {
  leftCents: null,
  operator: null,
  digits: '',
};

const MAX_DIGITS = 9;
const MAX_CENTS = 10 ** MAX_DIGITS - 1;

const OPERATORS: AmountOperator[] = ['+', '−', '×', '÷'];

export function isAmountOperator(key: string): key is AmountOperator {
  return (OPERATORS as string[]).includes(key);
}

export function amountFromCents(cents: number): AmountExpression {
  const abs = Math.abs(cents);
  return { ...EMPTY_AMOUNT, digits: abs ? String(abs) : '' };
}

function digitsToCents(digits: string): number {
  return digits ? parseInt(digits, 10) : 0;
}

// × and ÷ read the right side as the plain number you typed, not as a sum of
// money: "$55.00 × $3.00" is 55 × 3 = $165.00, and "$10.00 ÷ $4.00" splits
// the bill four ways.
function apply(
  leftCents: number,
  operator: AmountOperator,
  rightCents: number,
): number {
  switch (operator) {
    case '+':
      return leftCents + rightCents;
    case '−':
      return leftCents - rightCents;
    case '×':
      return Math.round((leftCents * rightCents) / 100);
    case '÷':
      // Dividing by nothing leaves the left side alone rather than blowing
      // the field up to Infinity.
      return rightCents === 0
        ? leftCents
        : Math.round((leftCents * 100) / rightCents);
  }
}

// A magnitude, never a sign — which way the money moves is the Spending /
// Income toggle's job, so "$5 − $8" floors at zero instead of going negative.
function clamp(cents: number): number {
  return Math.min(Math.max(0, cents), MAX_CENTS);
}

export function amountCents(expr: AmountExpression): number {
  if (expr.leftCents == null || expr.operator == null)
    return digitsToCents(expr.digits);
  if (!expr.digits) return expr.leftCents;
  return clamp(
    apply(expr.leftCents, expr.operator, digitsToCents(expr.digits)),
  );
}

export function isEmptyAmount(expr: AmountExpression): boolean {
  return expr.leftCents == null && !expr.digits;
}

export function pressAmountKey(
  expr: AmountExpression,
  key: AmountKey,
): AmountExpression {
  if (key === 'C') return EMPTY_AMOUNT;

  if (key === '⌫') {
    if (expr.digits) return { ...expr, digits: expr.digits.slice(0, -1) };
    // Undoing the operator hands the banked left side back as editable
    // digits, so a second press keeps deleting where you left off.
    if (expr.operator != null)
      return {
        ...EMPTY_AMOUNT,
        digits: expr.leftCents ? String(expr.leftCents) : '',
      };
    return { ...EMPTY_AMOUNT, digits: '' };
  }

  if (key === '=') {
    if (expr.operator == null) return expr;
    return { ...EMPTY_AMOUNT, digits: String(amountCents(expr)) };
  }

  if (isAmountOperator(key)) {
    if (isEmptyAmount(expr)) return expr;
    // An operator typed straight after another just replaces it.
    if (!expr.digits && expr.leftCents != null)
      return { ...expr, operator: key };
    return { leftCents: amountCents(expr), operator: key, digits: '' };
  }

  if (!/^\d$/.test(key) || expr.digits.length >= MAX_DIGITS) return expr;
  return { ...expr, digits: (expr.digits + key).replace(/^0+(?=\d)/, '') };
}

function formatCents(cents: number, symbol: string): string {
  return `${symbol}${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// What the big number at the top of the page reads — the whole expression
// while one is being built ("$55.00 + $36.00"), empty when nothing is typed
// so the placeholder can show through. `symbol` is the ledger's dollar
// unless the caller is typing in some other money, or in none: the exchange
// page names the currency on the row instead, and passes ''.
export function formatAmountExpression(
  expr: AmountExpression,
  symbol = '$',
): string {
  const right = expr.digits ? formatCents(digitsToCents(expr.digits), symbol) : '';
  if (expr.leftCents == null || expr.operator == null) return right;
  return `${formatCents(expr.leftCents, symbol)} ${expr.operator} ${right}`.trimEnd();
}
