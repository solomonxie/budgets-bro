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
├─────────── scrolls ───────────┤
│ Payee (SearchableDropdownField) │──→ ../../components/ui/SearchableDropdownField.tsx
│ Category (DropdownField,        │──→ ../../components/ui/DropdownField.tsx
│  hidden for tracking accounts)   │
│ Date (DateField)                │──→ ../../components/ui/DateField.tsx
│ Account (DropdownField)         │──→ ../../components/ui/DropdownField.tsx
│  ↳ all four unfold in place,     │──→ ../../components/ui/ExpandingField.tsx
│    pushing the pad down          │    (ExpandingFieldGroup wraps the form)
│ Repeat fields (when scheduled)  │──→ ../../components/ui/RepeatField.tsx
│ Memo input                      │──→ inline
│ Number pad (0-9, C, ⌫)          │──→ ../../components/ui/NumberPad.tsx
│ Save button                     │──→ inline
│ Delete button (editing only)    │──→ inline
└───────────────────────────────┘
```
