# Finance tools

```
registry.ts                 every calculator: id, hub, title/subtitle keys, screen
FinanceToolList.tsx         the TOOLS rows on a hub, rendered from the registry
FinanceToolScreen.tsx       one route for all of them; falls back to StubScreen
                            if a `Screen` is ever null again

MortgageInsightsScreen.tsx  ┐ hub = your real accounts for that domain,
LoanInsightsScreen.tsx      ├ then <FinanceToolList hub="…" />
InvestmentInsightsScreen.tsx┘
../tax/TaxInsightsScreen    the fourth hub — ledger-derived, tools appended
```

Reached from Insights' Utilities section, one row per hub. Adding a tool is one
entry in `registry.ts` plus its screen.

Math lives in `src/finance-tools/` (pure, no DB/React, unit-tested) — same
split as the folder name pairing suggests.

## The calculators

```
mortgage       MortgageScreen          hub: mortgage
payoff         PayoffScreen            mortgage + loan (one component, two entries)
affordability  AffordabilityScreen     mortgage
prepay (CN)    ChinaPrepaymentScreen   mortgage
refinance      RefinanceScreen         mortgage
rent vs buy    RentVsBuyScreen         mortgage
amortization   AmortizationScreen      loan
auto loan      AutoLoanScreen          loan
debt-to-income DebtToIncomeScreen      loan
investment     InvestmentScreen        invest
compound       CompoundInterestScreen  invest (same engine, no contributions)
tax savings    TaxSavingsScreen        tax
```

## Shared pieces

```
CalcScreen.tsx    <CalcScreen> frame (clears the tab bar), <ResultsCard>
                  (prompt instead of a screen of $0.00 before the inputs are
                  in), <AssumptionNote> for figures a tool invents
ScheduleCard.tsx  collapsible table — first 12 rows, then "Show all N"
useCalcField.ts   one field: raw text + its cents/bps/int readings, plus the
                  linked-account id LinkableNumberField needs
```

Ad-hoc by design: fields start empty and a value can be *pulled* off an account
via `LinkableNumberField`, but an account's own payment-pinned projection still
lives only on the account (AccountModal's Tools section, and LoanDetailsCard) —
one home per control.

No rates ship for any country or year — tax brackets are typed in, DTI ratios
are picked, and every invented figure (1.5%/yr upkeep, 3% closing) is stated
under the result it affects.
