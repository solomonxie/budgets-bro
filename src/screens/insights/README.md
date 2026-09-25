# Insights

```
InsightsScreen.tsx
┌───────────────────────────────┐
│ MonthNav                       │──→ ../../components/ui/MonthNav.tsx
├───────────────────────────────┤
│ Spending breakdown card         │──→ inline (stacked bar, same file)
├───────────────────────────────┤
│ Top categories legend card      │──→ inline; row tap → Transactions filtered
├───────────────────────────────┤
│ Category trends card            │──→ inline; hand-drawn Svg chart
│ (stacked area chart + legend)    │    (react-native-svg, not a local component)
├───────────────────────────────┤
│ UTILITIES list (Baby Steps,     │──→ inline; row tap navigates to:
│  Mortgage / Loan / Investment /  │    BabyStepsScreen.tsx (below)
│  Tax Insights, AI Insights)      │    ../finance-tools/MortgageInsightsScreen.tsx
│                                  │    ../finance-tools/LoanInsightsScreen.tsx
│                                  │    ../finance-tools/InvestmentInsightsScreen.tsx
│                                  │    ../tax/TaxInsightsScreen.tsx
│                                  │    ../ai/AiAnalysisScreen.tsx
└───────────────────────────────┘

BabyStepsScreen.tsx
┌───────────────────────────────┐
│ Step 1–7, each a card:           │──→ inline, local Step() helper;
│  title · ProgressBar · amount    │    ProgressBar from
│  · Ramsey brief · account or     │    ../../components/ui/ProgressBar.tsx
│  category picker link            │    pickers open a BottomSheet
├───────────────────────────────┤
│ Step 3.5 (down payment)          │──→ renters only — hidden once the
│                                  │    board has a mortgage account
├───────────────────────────────┤
│ Step 7 (no fixed target)         │──→ inline, local StatStep()
├───────────────────────────────┤
│ Steps 3.5 / 5 / 7 with nothing   │──→ inline, local ManualStep():
│  linked yet                      │    a "Mark Done" pill instead
├───────────────────────────────┤
│ Your Goals (custom, inline edit) │──→ useCustomGoals + customGoalsRepo
└───────────────────────────────┘

PayeeTrendScreen.tsx
┌───────────────────────────────┐
│ Top payee card                   │──→ usePayeeTrend (12-month window)
│  name · total · share · bars     │    → domain/payeeTrend.summarizePayees
│                                  │    chart: components/ui/MonthlyBarChart.tsx
├───────────────────────────────┤
│ Everyone else, ranked by spend   │──→ row tap expands that payee's whole
│                                  │    history in place, scrolled sideways
├───────────────────────────────┤
│ Unnamed-spending footnote        │──→ spending with no payee, never ranked
└───────────────────────────────┘
```

TrackedPricesScreen.tsx is the same layout, per item instead of per
payee: most-bought item in the top card with its price trend already open,
everything else ranked below and expanding in place. Both cards and rows
share the one set of styles, so a change to one page's shape belongs in
both.
