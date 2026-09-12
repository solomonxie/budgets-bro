# Tax

```
TaxInsightsScreen.tsx
┌───────────────────────────────┐
│ Title + disclaimer card         │──→ inline (same file)
├───────────────────────────────┤
│ Ledger totals card              │──→ inline, local Row() helper
│ (YTD income, spending)          │
├───────────────────────────────┤
│ Additional info card            │──→ inline; TextField ×2 from
│ (extra income, deductions)      │    ../../components/ui/TextField.tsx
├───────────────────────────────┤
│ Estimated taxable income card   │──→ inline
├───────────────────────────────┤
│ Ask AI button                   │──→ inline (Alert stub)
└───────────────────────────────┘
```

Non-authoritative estimate — no filing-status/bracket logic yet, see the file's own comment.
