// Standalone module (no DB/React dependency) so calculators stay
// independently testable and reusable. Amortization is implemented
// (see amortization.ts); other calculators (simple/compound interest,
// extra-payment payoff) land here later.
export * from './amortization';
