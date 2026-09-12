# Calculators

```
CalculatorsHomeScreen.tsx
┌───────────────────────────────┐
│ Loan input card                │──→ inline; TextField ×3 from
│ (amount, rate, term months)     │    ../../components/ui/TextField.tsx
├───────────────────────────────┤
│ Result card                    │──→ inline, local Row() helper
│ (monthly payment, total         │
│  interest, payoff date)         │
├───────────────────────────────┤
│ "More calculators soon" hint    │──→ inline
└───────────────────────────────┘
```

Ad-hoc version of `accounts/LoanDetailsCard.tsx`'s math (`../../finance-tools/amortization`), not tied to a real account.
