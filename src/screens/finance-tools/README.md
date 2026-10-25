# Finance tools

```
registry.ts                 every calculator: id, hub, title/subtitle keys, screen
FinanceToolList.tsx         the TOOLS rows on a hub, rendered from the registry
FinanceToolScreen.tsx       one route for all of them; falls back to StubScreen
                            if a `Screen` is ever null again

MortgageInsightsScreen.tsx  the Mortgage page: every mortgage question on one
                            page (see below), not a hub
../tax/TaxInsightsScreen    the one remaining hub — ledger-derived, tools appended
```

Loan, investment and tax tools are reached from an account's Calculators
section (and tax from Tax Insights). Adding a tool is one entry in
`registry.ts` plus its screen.

## Mortgage page

```
MortgageInsightsScreen.tsx  simulation tabs: each real mortgage (from the
                            account, can't be deleted; ⋯ → duplicate as a
                            simulation) + any number of what-ifs, each its
                            own saved calc form; tap the open tab for ⋯
mortgage/profiles.ts        the simulation list and which tab is open
mortgage/MortgagePlanView   pinned monthly-cost bar; runs the plan (memoized
                            on its inputs) and lays out the sections below
mortgage/planInputs         the saved fields the plan is computed from
mortgage/PurchaseInputs     price + loan terms (fold to one line once filled;
                            rate ±chips; inline warnings)
mortgage/HeldCard           a real mortgage: balance, rate, payment, renewal,
                            trigger rate, equity
mortgage/heldTerms          a real mortgage's owed / rate / payment, shared
                            with "duplicate as simulation"
mortgage/*Section, SummaryCard
                            new purchase: price, the loan (closing costs,
                            then schedule, term and qualifying links),
                            summary (running costs fold
                            under the monthly total), rent or buy.
                            Real mortgage: income, summary,
                            schedule, term + renewal, refinance with break
                            penalty; each section owns its what-if fields
mortgage/parts              Section (fold), Chips, YearChoice, Toggle
mortgage/ScheduleSection    by calendar year, past months greyed, next
                            payment marked; planned-extras list; tap a month
                            to pay extra once or every month from there
mortgage/BalanceChart       balance over time, scheduled vs with extras (svg)
mortgage/SliderField        a held thumb locks page scroll and back-swipe
mortgage/useHeldHistory     a real mortgage's rate changes, usual payment
                            (median of 6 months) and paying account — 3
                            small queries, only on its tab
mortgage/scheduleExtras     planned extras → scheduled payments to approve
```

Math: `src/finance-tools/mortgagePlan.ts` on top of `canadianMortgage.ts`.
Extras are saved on calendar months (`YYYY-MM`) so they don't drift. A real
mortgage uses the payment actually made when the ledger has one, its rate
history for past months, and renews at last rate change + term length.

Math lives in `src/finance-tools/` (pure, no DB/React, unit-tested) — same
split as the folder name pairing suggests.

## The calculators

```
payoff         PayoffScreen            loan
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
