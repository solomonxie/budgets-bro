# Budget

```
BudgetScreen.tsx
┌───────────────────────────────┐
│ MonthNav                       │──→ ../../components/ui/MonthNav.tsx
│ MonthPickerModal                │──→ ../../components/ui/MonthPickerModal.tsx
├───────────────────────────────┤
│ Summary card (spent, unassigned│──→ inline (same file)
│ this month, 12-mo avg compare)  │
├───────────────────────────────┤
│ Category groups (repeated):     │──→ inline
│  ┌────────────────────────┐    │
│  │ DisclosureChevron ▸/▾   │────┼──→ ../../components/ui/DisclosureChevron.tsx
│  │ group name, subtotal     │    │
│  │ RowMenuButton (⋯)        │────┼──→ ../../components/ui/RowMenuButton.tsx
│  ├────────────────────────┤    │
│  │ category rows:           │    │
│  │  StatusBadge             │────┼──→ ../../components/ui/StatusBadge.tsx
│  │  ProgressBar             │────┼──→ ../../components/ui/ProgressBar.tsx
│  └────────────────────────┘    │
├───────────────────────────────┤
│ + New Group button              │──→ inline
├───────────────────────────────┤
│ PromptModal (add/rename)        │──→ ../../components/ui/PromptModal.tsx
│ AssignedAmountModal (tap a cat.)│──→ ../../components/ui/AssignedAmountModal.tsx
└───────────────────────────────┘
```
