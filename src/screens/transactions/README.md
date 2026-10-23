# Transactions

`AddTransactionScreen` is a page on the root stack (above the tabs), so it
covers the tab bar, gets a back button, and closes with a swipe right from
anywhere. Reached by `navigate('AddTransaction', { transactionId?, presetAccountId? })`
— a row tap pushes it with an id to edit; the Spend tab pushes it empty,
except from an open account page, where `focusedAccountId` (navigation/) reads
that account off the tab state and preselects it. An Income account preselects
the stream tag + inflow instead of the Account field — money never sits in one.

```
TransactionsScreen.tsx
┌───────────────────────────────┐
│ Toolbar (search, Select link)   │──→ inline (same file)
├───────────────────────────────┤
│ Filter row (category, month)    │──→ inline; DropdownField ×2 from
│                                  │    ../../components/ui/DropdownField.tsx
├───────────────────────────────┤
│ Date-grouped transaction list   │──→ inline; row tap pushes
│ (FlatList)                      │    AddTransaction (edit mode)
├───────────────────────────────┤
│ Delete-selected bar             │──→ inline (select mode only)
│  (visible in select mode)       │
└───────────────────────────────┘

AddTransactionScreen.tsx  (root stack route)
┌───────────────────────────────┐
│ Header: ‹ Back, title,          │──→ native stack header; the pill is set
│  "Mark to repeat" pill          │    via navigation.setOptions
├───────────────────────────────┤
│ Amount (pinned) + Spend/Income  │──→ inline; never scrolls, the pad below
│                                  │    is always editing it
│ "From/To <account> ▾" link      │──→ ../../components/ui/DropdownField.tsx (link)
├─────────── scrolls ───────────┤
│ Payee (SearchableDropdownField) │──→ ../../components/ui/SearchableDropdownField.tsx
│ Category (DropdownField,        │──→ ../../components/ui/DropdownField.tsx
│  hidden for tracking accounts)   │
│ Date (DateField)                │──→ ../../components/ui/DateField.tsx
│  ↳ all pickers unfold in place,  │──→ ../../components/ui/ExpandingField.tsx
│    pushing the form down         │    (ExpandingFieldGroup wraps the form)
│ Memo (card row, one line,       │──→ inline
│  Return closes it)               │
│ Items (unfolds in place; price   │──→ ../../components/ui/PurchaseItemsField.tsx
│  on the page pad, then name;     │    (scan + pad wiring inline)
│  empty amount follows the sum;   │
│  hidden for scheduled)           │
│ Repeat fields (when scheduled)  │──→ ../../components/ui/RepeatField.tsx
│ Delete button (editing only)    │──→ inline
├──────── pinned, no scroll ──────┤
│ Number pad (amount, or the      │──→ ../../components/ui/NumberPad.tsx
│  picked item price; Save/Next)  │
└───────────────────────────────┘
```
