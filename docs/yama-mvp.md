# YAMA MVP — Design Doc

## Problem
Existing YNAB-style budgeting apps are subscription-based, cloud-backend-dependent, and require trusting a third party with financial data. There's no free, privacy-first alternative that does zero-based/envelope budgeting well, includes basic financial calculators, and offers AI-assisted analysis without routing data through a vendor-run server.

## Goals
- Free iOS app, lean YNAB-style envelope budgeting (accounts, categories, budgets, transactions, transfers).
- One-time import of a user's existing YNAB data, so switching costs nothing.
- Two native, on-device reports (spending breakdown, income vs. spending trend) — no AI or network call required for either.
- Self-contained financial calculators module (mortgage, loan/interest, amortization).
- AI analysis using the user's own API key, called directly from device to provider.
- SQLite as the single on-device source of truth; iCloud and S3 as optional backup targets.
- Zero backend servers operated by YAMA — client-only app, for both cost and privacy.

## Non-goals (MVP cut lines)
- Multi-device real-time sync (backups are point-in-time export/restore, not live sync)
- Bank-linking / Plaid / automatic transaction import (a one-time YNAB data import is in scope — see below — but it's manual and user-initiated, not a live bank sync)
- Multi-user, family, or shared budgets
- Android (iOS-only initially)
- Push notifications, reminders (recurring-transaction *templates* are in scope post-MVP — see Recurring Transactions below — but posting them happens lazily on app open, not via a push/background job)
- CSV import (possible post-MVP; manual entry only for MVP)
- Multi-currency (single currency assumed)
- Advanced reporting/BI beyond the two native reports described below (spending breakdown, income vs spending)
- AI taking actions on data (analysis/insights only, read-only against the AI provider)
- Category goals/targets (funding targets, "needed by" dates) — real YNAB feature, deferred post-MVP: meaningful added complexity (goal types, progress math) that isn't required for basic envelope budgeting
- Receipt photo attachment on transactions — deferred post-MVP (needs local image storage/size management)
- Transaction flags (arbitrary color tags) — deferred post-MVP, cosmetic-only
- Payee-based transfer detection/autocomplete beyond a simple picker — deferred post-MVP

## Core domain model
Envelope/zero-based budgeting, YNAB-style. Transfers are linked transaction pairs, not a separate ledger.

**Tables (SQLite):**
- `accounts` (id, name, type: checking|savings|credit_card|cash|loan|tracking, on_budget, currency, opening_balance_cents, archived_at, created_at) — `type` also drives which group an account is listed under (Cash / Credit / Loan / Tracking)
- `category_groups` (id, name, sort_order)
- `categories` (id, group_id, name, icon nullable, sort_order, archived_at) — `icon` is a single emoji, shown next to the name in lists (matches the visual identity pattern real YNAB uses; optional, defaults to none)
- `budget_entries` (id, category_id, month `YYYY-MM`, assigned_cents) — one row per category per month
- `payees` (id, name)
- `transactions` (id, account_id, category_id nullable, payee_id nullable, memo, amount_cents signed, date, cleared, is_interest, transfer_account_id nullable, import_id nullable unique, created_at, updated_at) — `import_id` is the dedupe key for YNAB data import (below); `is_interest` flags interest income on savings-type accounts so it can be broken out separately in reports/AI analysis instead of blending into generic income

**Derived (computed, not stored):**
- Category balance(month) = cumulative assigned(≤ month) + cumulative activity(≤ month). Because this is a running cumulative sum rather than a per-month reset, an unspent balance automatically carries forward to next month in the same category — this rollover is the core mechanic of envelope budgeting and isn't a separate feature to build. The same mechanism lets a user assign money to a *future* month (there's nothing that restricts `budget_entries.month` to the current or past) — assigning ahead just pre-funds that month's cumulative balance.
- Unassigned Cash = sum(uncategorized, non-transfer transaction amounts on on-budget accounts, all time) − sum(assigned, all time). Deliberately *not* "sum of positive inflows" — an uncategorized transaction can be negative too (a balance correction that finds less money than expected must reduce Unassigned Cash, not be ignored).
- Account balance = opening_balance + sum(transactions.amount_cents)

Balances are computed, not stored, to avoid drift bugs.

**Correcting a balance**: no reconciliation UI/terminology — if an account's real-world balance drifts from what YAMA computes, the user enters the actual balance and YAMA creates one uncategorized adjustment transaction for the difference (payee "Balance Adjustment"). It flows through the same Unassigned Cash math as any other uncategorized transaction, positive or negative — no special-cased reconciliation logic needed. Reachable from the Edit Account sheet — a "Latest Balance" field right under Opening Balance; changing it and saving posts the adjustment.

## Loan/mortgage payments today (shipped)
A loan/mortgage-*typed* account (`accounts.type IN ('loan','mortgage')`) owns exactly one auto-generated, auto-renamed budget category: "Payment: `<account name>`" (`categories.linked_account_id`, group "Loan Payments"). Categorizing *any* transaction under that specific category posts a second, mirrored transaction into the linked account for the same amount (opposite sign), paired via `transfer_account_id` — so a $800 outflow categorized "Payment: Dachang House debt" both spends from the budget *and* reduces that loan account's balance by $800, automatically.

This is a *category*-based link, not a payee-based one, and it only fires for that one specific auto-generated category — a transaction categorized under some other category (e.g. an imported "Mortgage" category that isn't the linked one) does **not** touch the loan account's balance. It also only exists for accounts *typed* loan/mortgage in this app — an account whose type was guessed wrong by the YNAB importer (e.g. a mortgage debt account imported as `loan` because its name contained "debt", not "mortgage") still gets the mechanism (both types behave identically here), but an account that's a plain `tracking` type doesn't.

## Loan/mortgage accounts v2 (designed, not yet built)
Today, a mortgage is two unrelated accounts if the user wants to track both the debt and the home's value (one `loan`/`mortgage`-typed, one `tracking`-typed) — no shared identity, no combined equity number. Redesign: **one account is the whole mortgage** — its debt side and its value side.

- **Debt side** — unchanged mechanics (balance = opening + transactions, reduced by linked-category payments), but the single static `interest_rate_bps` column becomes a history: new table `account_rate_history` (id, account_id, rate_bps, effective_date) — a mortgage's rate isn't fixed for its life (renewals, refinances, variable-rate resets). The latest entry is "current rate"; the full series lets a retrospective "interest paid to date" figure use the *actual* rate that applied at each point instead of extrapolating today's rate backward.
- **Value side** — new table `account_value_entries` (id, account_id, value_cents, as_of_date, note nullable, created_at) — a manually-entered log of the home's market value over time (user's own estimate; no external valuation API). Latest entry = "current value". This table is generic, not mortgage-specific — see Tracking/investment accounts below, which reuses it.
- **Equity** = latest value entry − debt balance. Shown on the account page instead of two separate Net Worth rows.
- **Payoff projection** — extends `finance-tools/amortization.ts` (already computes projected payoff from balance + rate + term) to take the rate *history* (so past-interest figures are accurate) plus an optional extra/early-payment input (lump sum or recurring add-on) to recompute a faster payoff date. Still a pure function, still no DB/React dependency.
- **Account page** becomes the "intelligence" surface: current debt, current value, equity, rate history list, payoff projection card (adjustable extra-payment input), value history log/chart — all local, no network.
- **Migration**: existing split accounts (debt + tracking) aren't auto-merged — a "Merge into one mortgage account" action folds a tracking account's value into a mortgage account's new value log and archives the tracking account, but the tool itself isn't built yet.

## Tracking/investment accounts (designed, not yet built)
Non-cash accounts (RRSP/TFSA-style investments, or any `tracking` account) get the same `account_value_entries` log as the mortgage's value side. Logging a new snapshot supports two entry modes, since users track this two different ways:
1. **Exact gain since last track** — user types the period's $ gain/loss directly; new value = old value + entered gain.
2. **Latest total balance** — user types the current total; gain since last track = new value − old value, computed automatically.

Both modes store the same row shape (`value_cents` absolute, `gain_cents` delta, `as_of_date`, `mode`) — the UI difference is only which field the user fills in. Account "balance" for a tracking account becomes the latest `account_value_entries.value_cents` instead of opening_balance + transactions (transactions still exist for any real cash movement in/out, e.g. a contribution, but growth/decline is tracked separately from cash flow).

## Recurring/scheduled transactions (designed, not yet built)
New table `scheduled_transactions` (id, account_id, category_id nullable, payee_id nullable, memo, amount_cents, frequency, interval_n, next_date, end_date nullable, auto_post boolean, is_interest, created_at) mirroring a real transaction's shape. Two posting modes, chosen per schedule:
- **Manual approve** — an "Upcoming" list (Budget or History screen) shows what's due; tapping one posts it as a real transaction with today's date, prefilled from the template.
- **Auto-post** — posted automatically once `next_date` arrives, checked lazily when the app opens/foregrounds (no push notifications or OS background jobs — out of scope per Non-goals above).

Scope cut for v1: no YNAB-style "Age of Money"/next-month-funding-plan integration — schedules are a posting convenience, not a forecasting engine.

## Core UI
Reference: real YNAB's screenshots. YAMA reuses the interaction patterns that carry the core budgeting workflow; the goal-tracking and cosmetic extras noted above stay out for MVP.

**Budget screen**
- "Unassigned Cash" banner at the top — money not yet assigned to any category, tappable, large and color-coded (green when positive, red when negative). (Deliberately not "Ready to Assign" — that's YNAB's own term for this figure.)
- Category groups, collapsible (tap the group header to expand/collapse)
- Each category row: icon (optional emoji) + name, a status badge showing the available amount — colored green when fully funded, yellow/amber when partially funded, red when overspent — plus a thin progress bar (spent vs. assigned) and a one-line status caption ("Funded" / "Spent $X of $Y")
- Month selector (prev/next or a dropdown) in the nav bar
- Floating "+ Transaction" button, always reachable, for quick entry from any tab

**Transaction entry/edit sheet** (modal, opened by the floating button or tapping a transaction)
- Large amount field with a numeric keypad
- Inflow/Outflow toggle (sets the sign)
- Payee picker (recent/autocomplete, create-new inline)
- Category picker
- Account picker
- Date picker (defaults to today)
- Memo (free text)
- "Interest income" toggle, shown on inflows — tags the transaction `is_interest` for reports/AI to break out later
- Cleared/uncleared toggle
- Save / Cancel

**Transactions (Spending) list**
- Grouped by date, most recent first
- Each row: payee, category tag (icon + name), amount (colored for outflow), a small cleared-status indicator, account name
- Search and a multi-select mode for bulk edit/delete

**Accounts screen**
- Grouped by account kind (Cash / Credit / Loan / Tracking), each group showing a subtotal
- Each row: an icon, the account name, and its balance (colored red when negative)
- Groups collapsible; "+" to add an account

**Insights screen** (native, on-device — distinct from the AI analysis feature below; needs no API key and sends nothing off-device; last tab, after FinMan)
- Month picker; spending breakdown for the selected month: total spent, a stacked bar by category, and a "Top categories" list with amounts
- Category trends: a multi-line chart (react-native-svg) of the top categories' monthly spend over the last 6 months

## YNAB Data Import
One-time, manual, user-initiated — not a sync, not bank-linking. Lets someone switch from YNAB without re-entering history.

**Format**: YNAB's "Export Budget" zip — a Register CSV (Account, Flag, Date, Payee, Category Group/Category, Memo, Outflow, Inflow, Cleared) and a Plan CSV (Month, Category Group/Category, Assigned, Activity, Available). A lone Register CSV also works (Plan/budgeted-amounts import is then skipped).

**Idempotency (the hard requirement)**: importing the same export twice — or a later, updated export — must not create duplicate transactions.
- Every imported transaction gets an `import_id` of (account, date, payee) plus an occurrence counter for genuine same-day/same-payee duplicates — row *position* isn't used, since it shifts across re-exports. YNAB already combines same-day/same-payee activity on export, so this triple is the natural key.
- `transactions.import_id` is `UNIQUE`; the importer upserts on conflict, so re-importing refreshes a row's amount/category/memo instead of leaving it stale.
- Accounts, payees, and categories are matched by name and only created if missing — importing twice reuses the same rows rather than creating "Groceries" and "Groceries (2)". An account created (not matched) during import gets its type guessed from its name; fix it after if wrong.
- Manually-entered transactions never collide with imports: they simply have no `import_id`.

**Flow**: pick the exported .zip (Tools tab → "Import from YNAB") → parses and imports inside a single DB transaction → result counts shown (inserted / updated / accounts+categories created).

## Financial tools module
Self-contained pure-function module, no DB/React dependency (`src/finance-tools/`):
- Mortgage/loan payment calculator
- Amortization schedule generator
- Simple/compound interest calculator
- Extra-payment payoff acceleration calculator

## AI analysis feature
**What it analyzes:** spending-by-category trends, budget variance (assigned vs actual), simple forward projections, natural-language Q&A over the user's own data.

**Flow:**
1. User enters an API key (Anthropic/OpenAI) in Settings → stored via `expo-secure-store` (iOS Keychain).
2. User taps "Analyze" → app builds a payload from local SQLite (aggregated category totals by default; raw transactions only in opt-in "detailed mode").
3. App calls the provider's REST API directly from the device — no YAMA server in the path.
4. Response renders in-app; nothing is persisted or transmitted to YAMA infrastructure (there is none).

**Privacy tradeoff:** invoking analysis sends financial data to a third-party AI provider chosen by the user. Default mode sends aggregated totals only; detailed mode (explicit opt-in) sends raw payee/memo/amount data. Because the user supplies their own key, usage/cost is auditable in that provider's dashboard — but data still leaves the device to that provider. This must be surfaced in the UI, not just documented here.

## Storage/backup architecture
- **SQLite** = source of truth. Library: `expo-sqlite` (works under Expo managed workflow + EAS builds, no custom native linking). `op-sqlite`/SQLCipher deferred until at-rest encryption is required.
- **iCloud backup**: export of the SQLite file into the app's iCloud container (Expo config plugin + entitlement, buildable via EAS).
- **S3 backup**: user provisions their own bucket + scoped IAM credentials. No backend to presign requests, so the app signs S3 REST calls client-side with `aws4fetch`, keeping the app backend-less.
- **Backup format**: primary = raw SQLite file copy; secondary/optional = JSON export for portability.
- **Restore**: pick a backup source → download → validate schema-version tag → full replace of local DB (destructive-and-confirmed, no merge/dedupe for MVP).

## Tech stack
| Concern | Choice | Reasoning |
|---|---|---|
| Framework | Expo (managed, TypeScript) | EAS cloud builds substitute for local Xcode.app |
| Navigation | React Navigation (native-stack + bottom-tabs) | Explicit nav tree simpler than file-based routing for a small app |
| Local DB | expo-sqlite | No custom native linking under EAS; adequate for single-user scale |
| State management | Zustand | Most state is SQLite queries + light UI state; Redux/React Query is overkill |
| Data layer | Repository functions (`src/db/repositories`) | Isolates SQL, testable independent of UI |
| Styling | RN `StyleSheet` + design-tokens file | Avoids Tailwind/NativeWind weight for MVP |
| Secure storage | expo-secure-store | Keychain-backed, for AI API key + S3 credentials |
| AI calls | Direct `fetch` to provider REST endpoints | Avoids heavy SDKs, keeps payload (aggregate/detailed) under app's control |
| S3 signing | aws4fetch | Lightweight SigV4 signer, keeps backup backend-less |
| Testing | Jest (`jest-expo`) | Unit tests for calculators & budget math only |
| Build/submit | EAS Build + EAS Submit | Required — no full Xcode.app locally |
| Lint/format | ESLint + Prettier | Baseline consistency for solo maintainer |
| Charts (Insights) | `react-native-svg` for the line chart; stacked bar still hand-rolled `View`/flex | Line chart needs real point geometry; the bar doesn't |

## Testing strategy
- Unit tests for `finance-tools/*` and `domain/budgetMath.ts` (rollover, to-be-budgeted, overspend) — these need correctness guarantees.
- DB repository layer stays thin (CRUD SQL); business logic lives in pure functions, testable without a DB.
- No E2E (Detox/Maestro) for MVP — manual QA via TestFlight before submission.
- GitHub Actions CI: `npm test` + `npm run lint` on push.

## Risks / open questions
- expo-sqlite has no built-in migration framework — needs a small homegrown versioned migration runner.
- iCloud container entitlement under Expo config plugins + EAS build needs a spike to confirm it doesn't force a bare-workflow eject.
- aws4fetch relies on WebCrypto — needs verification/polyfill under Hermes, spike in the backup milestone.
- Cutting bank-linking, CSV import, and multi-currency may feel too lean for some users — explicitly deferred to post-MVP roadmap.
- App Store privacy label must disclose that transaction data can be sent to a user-chosen AI provider and to user-chosen iCloud/S3 backup targets.
