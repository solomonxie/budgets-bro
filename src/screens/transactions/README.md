# Transactions

`AddTransactionModal` is a global modal (opened via `useAppStore`), not routed from `TransactionsScreen` directly.

```
TransactionsScreen.tsx
┌───────────────────────────────┐
│ Toolbar (search, Select link)   │──→ inline (same file)
├───────────────────────────────┤
│ Filter row (category, month)    │──→ inline; DropdownField ×2 from
│                                  │    ../../components/ui/DropdownField.tsx
├───────────────────────────────┤
│ Date-grouped transaction list   │──→ inline; row tap opens
│ (FlatList)                      │    AddTransactionModal (edit mode)
├───────────────────────────────┤
│ Delete-selected bar             │──→ inline (select mode only)
│  (visible in select mode)       │
└───────────────────────────────┘

AddTransactionModal.tsx  (global sheet, not routed)
┌───────────────────────────────┐
│ Header (Cancel)                 │──→ inline
├───────────────────────────────┤
│ Amount input (big number pad)   │──→ inline
│ Direction segmented (Spend/Inc) │──→ inline
├───────────────────────────────┤
│ Payee (SearchableDropdownField) │──→ ../../components/ui/SearchableDropdownField.tsx
│ Category (DropdownField,        │──→ ../../components/ui/DropdownField.tsx
│  hidden for tracking accounts)   │
├───────────────────────────────┤
│ Date (DateField)                │──→ ../../components/ui/DateField.tsx
│ Account (DropdownField)         │──→ ../../components/ui/DropdownField.tsx
├───────────────────────────────┤
│ Memo input                      │──→ inline
├───────────────────────────────┤
│ Save button                     │──→ inline
│ Delete button (editing only)    │──→ inline
└───────────────────────────────┘
```
