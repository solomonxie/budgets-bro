# Budget (extension)

Home page. Same numbers as the phone's `BudgetScreen`, laid out as a table.

```
╔══════════════════════════════════════════════════════════════════════════╗
║ Personal Budget ▾ │ ‹  September 2026  ›                     ✓ Synced   ║
║───────────────────│──────────────────────────────────────────────────────║
║                   │ ┌──────────────────────────────────────────────────┐ ║
║                   │ │ ⚠ $120.40 unassigned — give it a job             │ ║ ← red, only while ≠ 0
║                   │ └──────────────────────────────────────────────────┘ ║
║                   │ CATEGORY                ASSIGNED  ACTIVITY  AVAILABLE║
║                   │ ⌄ Everyday Expenses    $1,204.00  −$528.00   $700.10 ║
║                   │   🛒 Groceries           $400.00  −$316.00    $84.00 ║ ← green
║                   │   🍽 Dining out          $200.00  −$212.00   −$12.00 ║ ← red
║                   │   🚌 Transit             $100.00     $0.00   $100.00 ║
║                   │ › Bills                  $890.00  −$890.00     $0.00 ║ ← collapsed
║                   │ ⌄ Savings                  $0.00     $0.00     $0.00 ║
║                   │   No categories yet. Add them on your phone.         ║
╚══════════════════════════════════════════════════════════════════════════╝
```
Availability colours as the phone: green funded · amber partial · red
overspent. Collapse state per browser, not synced.

## Inline assign
```
before   🛒 Groceries           $400.00  −$316.00    $84.00
click Assigned ↓
editing  🛒 Groceries        ┌$400.00▌┐  −$316.00    $84.00
                             └────────┘
         ⊗ $80.00 more than you have unassigned                 ← red hint under the row, still saves
Enter ⇒ saved locally at once, Available + Unassigned update in the same frame
Tab   ⇒ saved, next category's Assigned opens
```
Accepts `400`, `$400.00`, `+50` / `-50` (relative to current), `=` math is
out. Bad input → cell outlined red, Enter does nothing.

## Activity
Click an Activity amount → Transactions filtered to that category + month.

## Rename
Double-click a category or group name → inline text field, Enter saves.
Add, delete, reorder: phone only in v1.

## Conflict
A name edited on both sides shows `⚠` after it; click → conflict card
under the row (`sync.md`).

## States
```
first load   (Setup › First download)
empty board  No categories yet. Set up your budget on your phone.
offline      same table, chip "Offline"
read-only    cells not clickable, tooltip "Sync stopped — see the status"
future month ‹ › go any month; one with no assignments shows $0.00 rows
```

## Copy
| Key | String |
|---|---|
| `budget.unassigned` | {amount} unassigned — give it a job |
| `budget.col.category` / `.assigned` / `.activity` / `.available` | Category / Assigned / Activity / Available |
| `budget.groupEmpty` | No categories yet. Add them on your phone. |
| `budget.boardEmpty` | No categories yet. Set up your budget on your phone. |
| `budget.exceeds` | {amount} more than you have unassigned |
