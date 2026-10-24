# Housing

A house hunt has two halves, and only one of them needs the internet.

```
HomesScreen.tsx             (Insights → Homes)
┌───────────────────────────────┐
│ + Add a home                   │──→ HouseDetailScreen (new)
│ Homes card: sort chips,        │──→ row tap → HouseDetailScreen
│  ○ tick to compare, badges     │    ticks → pinned "Compare N" bar
│  (fixed/mo, vs benchmark,      │    → HouseCompareScreen
│  price drop, score, subjects)  │
│  Archived (sold / ruled out) ›  │
├───────────────────────────────┤
│ What matters to you (weights)  │──→ ../../domain/houseScore.ts
├───────────────────────────────┤
│ One card per community         │──→ ../../components/ui/SeriesLineChart.tsx
│ + Log a community benchmark     │──→ ./CommunityPriceModal.tsx
└───────────────────────────────┘

HouseDetailScreen.tsx  saves as you type (no Save); name, total price,
                       status chips, stars; "what sets it apart"; then
                       folded sections: running costs, getting around,
                       building, condition checklist, offer, listing
                       (paste a link → address), price history, verdict
useHomes.ts            houses + price history + benchmark + score, shared
                       by all three screens so they agree
```

- **Houses** (`db/repositories/housesRepo.ts`, migration 033) — one wide,
  mostly-nullable row per listing. Name is the only thing required: a house
  gets added from the car park with three facts and fills in over the week.
- **Derived, never stored** (`domain/houseMetrics.ts`) — price per square
  foot, fixed monthly costs (strata, tax, upkeep), asking vs assessed and vs
  benchmark, age, price change, days on market, checklist concerns. No
  mortgage math here: that's the Mortgage page, one tap away.
- **Differentiators** (migration 045) — upkeep, distances (metres) to bus,
  train, school and groceries, a viewing checklist, offer price, deposit,
  subject-removal and completion dates. `house_prices` logs each asking
  price change.
- **Score** (`domain/houseScore.ts`) — each criterion 0–1 across the homes
  still in the running, weighted 0–3; a house that doesn't say is left out
  of that criterion.
- **Benchmark prices** (`communityPricesRepo.ts`) — typed in, like a tracking
  account's value log. Real-estate boards publish them as documents, not as
  an API, and their terms don't allow republishing.
- **Comparison** — `markBest` marks the better cell only on rows where better
  is defined, and marks nobody on a tie.
