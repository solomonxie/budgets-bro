# Finance tools — math

Pure functions. No DB, no React, no formatting — cents in, cents out, rates in
basis points. Every file has a colocated `.test.ts`; screens live in
`../screens/finance-tools/`.

```
amortization.ts     level-payment schedule + payoff months  ← the primitive
equalPrincipal.ts   等额本金 declining-payment schedule
payoff.ts           extra payments, biweekly, before/after comparison
chinaPrepayment.ts  提前还贷 — depends on both schedules above
affordability.ts    max house price + DTI            ┐ circular in price/rate,
investment.ts       future value + 4 solvers         ┘ both use solve.ts
taxSavings.ts       progressive brackets, deduction savings
solve.ts            bisection root-finder
units.ts            万元 ↔ cents
accountLink.ts      which figure a real account can supply a calculator field
```

Reference figures each module is tested against come from the calculators the
user supplied — calculator.net (mortgage, amortization, payoff, affordability,
investment) and fangdailixi.com (提前还贷). Where a result diverges from the
reference on purpose, the reason is in the file.

No tax rates are shipped for any country or year. `taxSavings.ts` computes on a
table the user enters — see its header.
