# Housing

A house hunt has two halves, and only one of them needs the internet.

```
HousingInsightsScreen.tsx   (Insights → House Hunt)
┌───────────────────────────────┐
│ Houses card                    │──→ row tap → HouseDetailScreen
│  (status order, then rating)   │    long-press → pick for comparison
│  + Add a house / Compare N →   │──→ HouseCompareScreen
├───────────────────────────────┤
│ One card per community         │──→ ../../components/ui/SeriesLineChart.tsx
│  benchmark line + readings      │    long-press a reading to delete it
├───────────────────────────────┤
│ + Log a community benchmark     │──→ ./CommunityPriceModal.tsx
├───────────────────────────────┤
│ Two GuideSections               │
└───────────────────────────────┘
```

- **Houses** (`db/repositories/housesRepo.ts`, migration 033) — one wide,
  mostly-nullable row per listing. Name is the only thing required: a house
  gets added from the car park with three facts and fills in over the week.
- **Derived, never stored** (`domain/houseMetrics.ts`) — price per square
  foot, down payment, CMHC premium, payment, carrying cost, asking-versus-
  assessed, age. Every house uses the same assumptions (4.5%, 25 years, 20%
  down, $250/mo utilities) so the comparison is fair; the purchase calculator
  is one tap away for a real quote.
- **Benchmark prices** (`communityPricesRepo.ts`) — typed in, like a tracking
  account's value log. Real-estate boards publish them as documents, not as
  an API, and their terms don't allow republishing.
- **Comparison** — `markBest` marks the better cell only on rows where better
  is defined, and marks nobody on a tie.
