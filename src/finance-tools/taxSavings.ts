// A progressive bracket table, supplied by the user — the app ships no rates
// for any country or year. Tax tables change annually and vary by
// province/state; a bundled "Canada 2025" would be wrong within months and
// wrong for everyone else immediately.
//
// `upToCents: null` is the open-ended top band. Rates are combined
// (federal + provincial/state) — modelling two jurisdictions separately would
// double the input work for the same answer.
export interface TaxBracket {
  upToCents: number | null;
  rateBps: number;
}

// Sorted ascending with the open-ended band last, so a table typed in any
// order still computes correctly.
function normalize(brackets: TaxBracket[]): TaxBracket[] {
  return [...brackets].sort((a, b) => {
    if (a.upToCents == null) return 1;
    if (b.upToCents == null) return -1;
    return a.upToCents - b.upToCents;
  });
}

export function taxOnIncomeCents(taxableCents: number, brackets: TaxBracket[]): number {
  if (taxableCents <= 0) return 0;
  let tax = 0;
  let floor = 0;
  for (const bracket of normalize(brackets)) {
    const ceiling = bracket.upToCents ?? Infinity;
    if (taxableCents <= floor) break;
    const bandCents = Math.min(taxableCents, ceiling) - floor;
    if (bandCents > 0) tax += (bandCents * bracket.rateBps) / 10000;
    floor = ceiling;
  }
  return Math.round(tax);
}

export function marginalRateBpsAt(taxableCents: number, brackets: TaxBracket[]): number {
  let floor = 0;
  for (const bracket of normalize(brackets)) {
    const ceiling = bracket.upToCents ?? Infinity;
    if (taxableCents > floor && taxableCents <= ceiling) return bracket.rateBps;
    floor = ceiling;
  }
  return normalize(brackets).at(-1)?.rateBps ?? 0;
}

// The real answer: tax before minus tax after. Correct when the deduction
// straddles a bracket boundary, which is exactly when the simple
// marginal-rate answer overstates the refund — and exactly when someone is
// deciding how much to contribute.
export function deductionSavingsCents(taxableCents: number, deductionCents: number, brackets: TaxBracket[]): number {
  const after = Math.max(0, taxableCents - Math.max(0, deductionCents));
  return taxOnIncomeCents(taxableCents, brackets) - taxOnIncomeCents(after, brackets);
}

// The one-field answer, for when someone knows their marginal rate and
// doesn't want to type a table.
export function flatRateSavingsCents(deductionCents: number, marginalRateBps: number): number {
  return Math.round((Math.max(0, deductionCents) * marginalRateBps) / 10000);
}
