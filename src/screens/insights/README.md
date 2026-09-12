# Insights

```
InsightsScreen.tsx
┌───────────────────────────────┐
│ MonthNav                       │──→ ../../components/ui/MonthNav.tsx
│ MonthPickerModal                │──→ ../../components/ui/MonthPickerModal.tsx
├───────────────────────────────┤
│ Spending breakdown card         │──→ inline (stacked bar, same file)
├───────────────────────────────┤
│ Top categories legend card      │──→ inline; row tap → Transactions filtered
├───────────────────────────────┤
│ Category trends card            │──→ inline; hand-drawn Svg chart
│ (stacked area chart + legend)    │    (react-native-svg, not a local component)
├───────────────────────────────┤
│ Tools list (Baby Steps,         │──→ inline; row tap navigates to:
│  Tax Insights, Calculators,      │    BabyStepsScreen.tsx (below)
│  AI Analysis)                    │    ../tax/TaxInsightsScreen.tsx
│                                  │    ../calculators/CalculatorsHomeScreen.tsx
│                                  │    ../ai/AiAnalysisScreen.tsx
└───────────────────────────────┘

BabyStepsScreen.tsx
┌───────────────────────────────┐
│ Emergency fund account picker   │──→ inline; Chip × N from
│ (Chip row)                      │    ../../components/ui/Chip.tsx
├───────────────────────────────┤
│ Step 1, 2, 3 (auto, from ledger)│──→ inline, local Step() helper;
│  each: ProgressBar               │    ProgressBar from
│                                  │    ../../components/ui/ProgressBar.tsx
├───────────────────────────────┤
│ Step 4, 5 (manual checkbox)      │──→ inline, local ManualStep() helper
├───────────────────────────────┤
│ Step 6 (auto — mortgage payoff)  │──→ inline, Step()
├───────────────────────────────┤
│ Step 7 (manual checkbox)         │──→ inline, ManualStep()
└───────────────────────────────┘
```
