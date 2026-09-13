# Accounts

`AccountModal` is a global modal (opened via `useAppStore`), not routed from `AccountsScreen` directly — it lives here because it edits accounts.

```
AccountsScreen.tsx
┌───────────────────────────────┐
│ Net worth card                │──→ inline (same file)
│ (value, assets/debts, ✎ link) │
├───────────────────────────────┤
│ Include-in-net-worth picker   │──→ inline, Modal
│ (checkbox list)                │
├───────────────────────────────┤
│ Kind groups (Cash/Credit/…)    │──→ inline; row tap → AccountDetailScreen
│  └ account rows                │
├───────────────────────────────┤
│ + Add Account                  │──→ openAddAccount() → AccountModal (below)
│ Closed Accounts →               │──→ ClosedAccountsScreen.tsx
└───────────────────────────────┘

AccountDetailScreen.tsx
┌───────────────────────────────┐
│ Balance summary card           │──→ inline (same file)
├───────────────────────────────┤
│ LoanDetailsCard (loan types)    │──→ ./LoanDetailsCard.tsx
│ HouseValueCard (mortgage only)  │──→ ./HouseValueCard.tsx
├───────────────────────────────┤
│ Scheduled (expandable)         │──→ inline
├───────────────────────────────┤
│ Transaction list (FlatList)    │──→ inline
└───────────────────────────────┘

ValueHistoryChart.tsx — shared scrollable month-gridded chart (same look/drag as
InsightsScreen's category-trend chart: 12 months visible, scroll for more,
Jan/Feb.. + year labels). Two callers:
- TrackingValueDetails.tsx (tracking AND savings/cash accounts — same component,
  mode="stacked": deposited band + gain band, ../../domain/investmentGrowth.ts
  splits the value-history log against the account's own transactions, no new
  DB table) — savings/cash keep their normal ledger balance, this is chart-only.
- HouseValueDetails.tsx (mortgage, mode="single": just the logged value, no
  deposit split — a house has no "deposits").

ClosedAccountsScreen.tsx
┌───────────────────────────────┐
│ empty state, or                │──→ inline
│ closed account rows            │──→ tap → openEditAccount() → AccountModal
└───────────────────────────────┘

AccountModal.tsx  (global sheet, not routed)
┌───────────────────────────────┐
│ Header (Cancel / title / Save) │──→ inline
├───────────────────────────────┤
│ Name, Type, Opening balance,   │──→ inline (TextField/DropdownField from
│ Latest balance (editing only)  │    ../../components/ui/)
├───────────────────────────────┤
│ Interest rate history / field  │──→ inline; row tap opens RateChangeModal
├───────────────────────────────┤
│ Loan terms (loan-like only):   │──→ inline
│  term, principal, house price, │
│  origination date              │
├───────────────────────────────┤
│ Tools (loan-like, editing      │──→ row opens a nested pageSheet Modal
│  only) — Amortization Schedule │    wrapping ../../components/ui/
│                                 │    AmortizationCalculator.tsx (prefilled
│                                 │    from the form's own term/principal/
│                                 │    rate fields, payment pinned via
│                                 │    `fixedPaymentCents`) — same shared
│                                 │    component screens/calculators/
│                                 │    CalculatorsHomeScreen.tsx uses for its
│                                 │    ad-hoc "what if" case
├───────────────────────────────┤
│ Close / Reopen account         │──→ inline
└───────────────────────────────┘
```
