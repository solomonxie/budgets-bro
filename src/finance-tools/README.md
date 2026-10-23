# Finance tools — math

Pure functions. No DB, no React, no formatting — cents in, cents out, rates in
basis points. Every file has a colocated `.test.ts`; screens live in
`../screens/finance-tools/`.

```
amortization.ts     level-payment schedule + payoff months  ← the primitive
payoff.ts           extra payments, biweekly, before/after comparison
canadianMortgage.ts semi-annual compounding, insurance, transfer tax, GDS/TDS
mortgagePlan.ts     the Mortgage page: one plan → costs, closing, schedule
                    with lump sums, renewal shocks, qualifying, max price
refinance.ts        break-even of a rate switch
rentVsBuy.ts        renter vs buyer net worth by year
affordability.ts    max house price + DTI            ┐ circular in price/rate,
investment.ts       future value + 4 solvers         ┘ both use solve.ts
taxSavings.ts       progressive brackets, deduction savings
debtHealth.ts       payment vs take-home, stress test, rate shocks, LTV
solve.ts            bisection root-finder
units.ts            万元 ↔ cents
accountLink.ts      which figure a real account can supply a calculator field
```

Reference figures each module is tested against come from the calculators the
user supplied — calculator.net (mortgage, amortization, payoff, affordability,
investment). Where a result diverges from the
reference on purpose, the reason is in the file.

No tax rates are shipped for any country or year. `taxSavings.ts` computes on a
table the user enters — see its header.
