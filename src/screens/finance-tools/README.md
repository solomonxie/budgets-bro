# Finance tools

```
registry.ts                 every calculator: id, hub, title/subtitle keys, screen
FinanceToolList.tsx         the TOOLS rows on a hub, rendered from the registry
FinanceToolScreen.tsx       one route for all of them; falls back to StubScreen
                            while `Screen` is still null

MortgageInsightsScreen.tsx  ┐ hub = your real accounts for that domain,
LoanInsightsScreen.tsx      ├ then <FinanceToolList hub="…" />
InvestmentInsightsScreen.tsx┘
../tax/TaxInsightsScreen    the fourth hub — ledger-derived, tools appended
```

Reached from Insights' Utilities section, one row per hub. Adding a tool is one
entry in `registry.ts`; shipping it is swapping that entry's `Screen` off null.

Math lives in `src/finance-tools/` (pure, no DB/React, unit-tested) — same
split as the folder name pairing suggests.

Ad-hoc by design: fields start empty and a value can be *pulled* off an account
via `LinkableNumberField`, but an account's own payment-pinned projection still
lives only on the account (AccountModal's Tools section, and LoanDetailsCard) —
one home per control.
