export interface MoneyFormatOptions {
  symbol?: string;
  locale?: string;
}

// `symbol`/`locale` exist for the finance tools that model a loan in another
// currency (the Chinese 提前还贷 calculator renders ¥) — the ledger itself is
// still single-currency, so every other caller takes the defaults.
// Whole dollars, always — cents are kept in the data and rounded only here,
// on the way to the screen. Showing them only when they happened to be
// non-zero made one list read "$44,000" next to "$26,305.19", as if the two
// were measured differently.
export function formatMoney(cents: number, opts?: MoneyFormatOptions): string {
  const sign = cents < 0 ? '-' : '';
  const str = Math.round(Math.abs(cents) / 100).toLocaleString(
    opts?.locale ?? 'en-US',
    { maximumFractionDigits: 0 },
  );
  return sign + (opts?.symbol ?? '$') + str;
}

// Every cent, for the places a figure is data rather than something being
// read off a screen — the AI prompt's context block, where rounding would
// hand the model a different number than the ledger holds.
export function formatMoneyExact(cents: number, opts?: MoneyFormatOptions): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents) / 100;
  const hasCents = Math.round(abs * 100) % 100 !== 0;
  const str = abs.toLocaleString(opts?.locale ?? 'en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return sign + (opts?.symbol ?? '$') + str;
}

// Compact axis label — formatMoney's full "$1,234.56" is too wide for a
// narrow chart axis column.
export function formatMoneyCompact(
  cents: number,
  opts?: MoneyFormatOptions,
): string {
  const symbol = opts?.symbol ?? '$';
  const dollars = Math.abs(cents) / 100;
  // Keeps the sign. Dropping it made a chart axis read "$218k" at the floor
  // and "$72k" at the ceiling — a scale that runs downhill and says nothing
  // about which side of zero a point is on.
  const sign = cents < 0 ? '−' : '';
  if (dollars >= 1000)
    return `${sign}${symbol}${(dollars / 1000).toFixed(dollars >= 10000 ? 0 : 1)}k`;
  return `${sign}${symbol}${Math.round(dollars)}`;
}

// Rates are stored as basis points everywhere (6.50% -> 650).
export function formatPercent(rateBps: number): string {
  return `${(rateBps / 100).toFixed(2)}%`;
}

// Calculator fields hold raw text, so every one of them needs this on the way
// into the math. Grouping separators and a currency symbol are stripped
// because people paste figures in from statements.
export function parseMoneyToCents(text: string): number {
  const cleaned = text.replace(/[,\s$¥￥€£]/g, '');
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

// Money typed the way a card terminal takes it: digits fill in from the
// right, so "1234" is $12.34 and no decimal point is ever typed. The field
// keeps its formatted text as state, so each keystroke arrives as the old
// text plus one character — stripping to digits and re-placing the point
// round-trips exactly, and backspace walks back the same way.
export function moneyTextFromDigits(text: string): string {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (digits === '') return '';
  // Beyond 15 digits Number loses precision — and nobody is typing a
  // quadrillion into a budget.
  return (Number(digits.slice(0, 15)) / 100).toFixed(2);
}
