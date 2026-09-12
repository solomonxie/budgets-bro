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
│ Close / Reopen account         │──→ inline
└───────────────────────────────┘
```
