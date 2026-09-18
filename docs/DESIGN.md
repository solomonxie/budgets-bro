# ByoBudget MVP — Design Doc

## Problem
Existing YNAB-style budgeting apps are subscription-based, cloud-backend-dependent, and require trusting a third party with financial data. There's no free, privacy-first alternative that does zero-based/envelope budgeting well, includes basic financial calculators, and offers AI-assisted analysis without routing data through a vendor-run server.

## Goals
- Free iOS app, lean YNAB-style envelope budgeting (accounts, categories, budgets, transactions, transfers).
- One-time import of a user's existing YNAB data, so switching costs nothing.
- Two native, on-device reports (spending breakdown, income vs. spending trend) — no AI or network call required for either.
- Self-contained financial calculators module (mortgage, loan/interest, amortization).
- AI analysis using the user's own API key, called directly from device to provider.
- SQLite as the single on-device source of truth; iCloud and S3 as optional backup targets.
- Zero backend servers operated by ByoBudget — client-only app, for both cost and privacy.

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

**Correcting a balance**: no reconciliation UI/terminology — if an account's real-world balance drifts from what ByoBudget computes, the user enters the actual balance and ByoBudget creates one uncategorized adjustment transaction for the difference (payee "Balance Adjustment"). It flows through the same Unassigned Cash math as any other uncategorized transaction, positive or negative — no special-cased reconciliation logic needed. Reachable from the Edit Account sheet — a "Current Balance" field right under Starting Balance; changing it and saving posts the adjustment. Both fields carry a hint saying which balance they mean.

## Loan/mortgage payments today (shipped)
A loan/mortgage-*typed* account (`accounts.type IN ('loan','mortgage')`) owns exactly one auto-generated, auto-renamed **payee** named after it (`payees.linked_account_id`) — not a category. Selecting that payee on *any* transaction, regardless of category, posts a second, mirrored transaction into the linked account for the same amount (opposite sign), paired via `transfer_account_id` — so an $800 outflow with payee "Dachang House debt" both spends from whatever category it's budgeted under *and* reduces that loan account's balance by $800, automatically. (An earlier version of this linked a category instead — payee turned out to be the right unit, since a debt payment isn't inherently one category, and category-linking collided with the auto-generated category taking the "one link per account" slot.)

This only exists for accounts *typed* loan/mortgage in this app — an account whose type was guessed wrong by the YNAB importer (e.g. a mortgage debt account imported as `loan` because its name contained "debt", not "mortgage") still gets the mechanism (both types behave identically here), but a plain `tracking`-typed account doesn't.

Also shipped: interest rate as a real history (`account_rate_history`: rate + effective date, add/edit/delete) instead of one static column — the account page's payoff projection reads the latest entry. A "Purchase Price" field on mortgage accounts, with a computed, read-only "Down Payment — $X (Y% down)" row once it and Mortgage Amount are both filled in. Field labels lead with what the user knows ("Purchase Price", "Mortgage Amount"/"Amount Borrowed") rather than lender wording ("Original Principal"), each with a one-line hint. Mortgage Amount and the starting balance are the same number for a loan added on day one, so a loan-like account labels the ledger seed "Balance When Tracking Started" and auto-fills it as the negated Mortgage Amount until hand-edited — the two stay separate fields (contract term vs. ledger seed) because a part-paid loan added later owes less than it borrowed.

The loan card on the account page reports only — rate, scheduled payment, projected payoff, remaining interest — with no extra-payment input: it shows the loan as it actually is, the scheduled payment against the balance real transactions add up to. What-if extra payments belong to the payoff/early-repayment calculators, which is also where the schedule table lives.

## Loan/mortgage accounts v2 (designed, not yet built)
Today, a mortgage is two unrelated accounts if the user wants to track both the debt and the home's value (one `loan`/`mortgage`-typed, one `tracking`-typed) — no shared identity, no combined equity number. Redesign: **one account is the whole mortgage** — its debt side and its value side.

- **Debt side** — unchanged (balance = opening + transactions, reduced by linked-payee payments; rate history already shipped, above).
- **Value side** — new table `account_value_entries` (id, account_id, value_cents, as_of_date, note nullable, created_at) — a manually-entered log of the home's market value over time (user's own estimate; no external valuation API). Latest entry = "current value". This table is generic, not mortgage-specific — see Tracking/investment accounts below, which reuses it.
- **Equity** = latest value entry − debt balance. Shown on the account page instead of two separate Net Worth rows.
- **Payoff projection** — extends `finance-tools/amortization.ts` (already reads the rate history for current rate) to also take an extra/early-payment input (lump sum or recurring add-on) to recompute a faster payoff date. Still a pure function, still no DB/React dependency. That input belongs to the calculators, not the account page (revised — see below).
- **Account page** becomes the "intelligence" surface: current debt, current value, equity, rate history list (shipped), payoff projection card, value history log/chart — all local, no network. Revised: the account page reports actuals only, no what-if inputs — the page answers "where does this loan stand", the calculators answer "what if I paid more".
- **Migration**: existing split accounts (debt + tracking) aren't auto-merged — a "Merge into one mortgage account" action folds a tracking account's value into a mortgage account's new value log and archives the tracking account, but the tool itself isn't built yet.

## Tracking/investment accounts (designed, not yet built)
Non-cash accounts (RRSP/TFSA-style investments, or any `tracking` account) get the same `account_value_entries` log as the mortgage's value side. Logging a new snapshot supports two entry modes, since users track this two different ways:
1. **Exact gain since last track** — user types the period's $ gain/loss directly; new value = old value + entered gain.
2. **Latest total balance** — user types the current total; gain since last track = new value − old value, computed automatically.

Both modes store the same row shape (`value_cents` absolute, `gain_cents` delta, `as_of_date`, `mode`) — the UI difference is only which field the user fills in. Account "balance" for a tracking account becomes the latest `account_value_entries.value_cents` instead of opening_balance + transactions (transactions still exist for any real cash movement in/out, e.g. a contribution, but growth/decline is tracked separately from cash flow).

## Income accounts (shipped)
An `income`-typed account is a saved filter/tag, not a place money sits — no transaction ever targets it directly (`transactions.account_id` never equals it), so it never carries a ledger balance and is excluded from Net Worth by kind, not by coincidence.

- `transactions.income_account_id` (nullable FK → accounts, app-enforced `type = 'income'`, same as `type` itself has no DB-level enum) tags any transaction as income received, independent of which real account (cash, savings, tracking/investment, etc.) the money actually landed in — covers salary, freelance, and non-cash comp like RSU vesting into a Tracking account.
- The tag is offered only for positive-amount, non-transfer entries — receiving value, not moving your own money between your own accounts.
- An Income account's "balance" (Accounts list row/subtotal, detail page) is `SUM(amount_cents) WHERE income_account_id = X` for the period (this year / this month), never a ledger balance.
- Replaces an earlier create-then-sweep model (a real entry on the Income account + a generated mirror transfer into a board-wide default cash account): that was two independently-editable rows that could desync on edit/delete since only creation kept them in sync. One real row now, tagged, not paired.
- Every new board seeds one default Cash, Savings, and Income account, since at least one Income account must exist to tag anything as income.
- Accounts list orders the Income group first (`ACCOUNT_KIND_ORDER`: Income · Cash · Savings · Tracking · Loan · Asset · Credit) — what comes in leads the page, and Loan sits ahead of Asset so a mortgage's debt reads near the cash it is paid from.

## Recurring/scheduled transactions (designed, not yet built)
New table `scheduled_transactions` (id, account_id, category_id nullable, payee_id nullable, memo, amount_cents, frequency, interval_n, next_date, end_date nullable, auto_post boolean, is_interest, created_at) mirroring a real transaction's shape. Two posting modes, chosen per schedule:
- **Manual approve** — an "Upcoming" list (Budget or History screen) shows what's due; tapping one posts it as a real transaction with today's date, prefilled from the template.
- **Auto-post** — posted automatically once `next_date` arrives, checked lazily when the app opens/foregrounds (no push notifications or OS background jobs — out of scope per Non-goals above).

Scope cut for v1: no YNAB-style "Age of Money"/next-month-funding-plan integration — schedules are a posting convenience, not a forecasting engine.

## Core UI
See [UIUX-DESIGN.md](UIUX-DESIGN.md) — screen-by-screen UI/UX spec plus the conventions it follows.

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
3. App calls the provider's REST API directly from the device — no ByoBudget server in the path.
4. Response renders in-app; nothing is persisted or transmitted to ByoBudget infrastructure (there is none).

**Privacy tradeoff:** invoking analysis sends financial data to a third-party AI provider chosen by the user. Default mode sends aggregated totals only; detailed mode (explicit opt-in) sends raw payee/memo/amount data. Because the user supplies their own key, usage/cost is auditable in that provider's dashboard — but data still leaves the device to that provider. This must be surfaced in the UI, not just documented here.

**Settings disclosure (light, shown right under each key field):**
- OpenAI: "Used by AI Analysis. Sent straight from this device to OpenAI when you run an analysis — never stored or seen by us. The key itself never leaves this device, including in backups."
- AWS S3: "Used only for backups you trigger. The key itself never leaves this device, including in backups — only your board's money data goes to S3, and only when you back up."

## Secrets vs. backups — never mixed
The AI API key and S3 credentials are provider credentials, not money data, and must never appear in any backup, on-device or off:
- **Storage boundary**: both live only in `expo-secure-store` (Keychain/Keystore), never in the SQLite DB (`app_settings` holds only theme/active-board, nothing secret) — so no backup or export path that reads the DB can ever touch them.
- **Keychain accessibility (iOS)**: written with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, which iOS excludes from iCloud/iTunes device backups and never migrates to a new device.
- **Auto Backup (Android)**: `android.allowBackup` is `false` — no OS-level backup path exists for this app at all, implicit or otherwise; money data only leaves the device via the explicit backup flows below.
- **App's own export/backup** (`exportBoardZip`, iCloud/S3 backup): dumps only board-scoped SQLite tables (accounts, categories, budget entries, payees, transactions) — never touches secureStore, so a restored backup can never carry a key.

## Storage/backup architecture
- **SQLite** = source of truth. Library: `expo-sqlite` (works under Expo managed workflow + EAS builds, no custom native linking). `op-sqlite`/SQLCipher deferred until at-rest encryption is required.
- **iCloud backup**: export of the SQLite file into the app's iCloud container (Expo config plugin + entitlement, buildable via EAS).
- **S3 backup**: user provisions their own bucket + scoped IAM credentials. No backend to presign requests, so the app signs S3 REST calls client-side with `aws4fetch`, keeping the app backend-less.
- **Backup format**: primary = raw SQLite file copy; secondary/optional = JSON export for portability.
- **Restore**: pick a backup source → download → validate schema-version tag → full replace of local DB (destructive-and-confirmed, no merge/dedupe for MVP).
- **S3 credential validation, on save, before the key is accepted** (fail closed — reject and explain, don't silently store an unusable/unsafe credential):
  1. **Reachable**: sign and send a lightweight request (e.g. `HEAD` the bucket) — confirms the endpoint/region/bucket name resolve at all.
  2. **Read/write**: write a small marker object (e.g. `.byobudget/write-test`) and read it back, then delete it — confirms the credential can actually do both, not just list.
  3. **Not public**: check the bucket's Public Access Block config / ACL — reject if the bucket is publicly readable or writable; this is a personal finance backup target, not a public one.
  4. **No anonymous access**: repeat the reachability check with no credentials — must fail. If an unauthenticated request succeeds, the bucket policy is too permissive regardless of what this app's own IAM user can do.
  - Any step failing shows a specific, actionable error (which check failed and why) instead of a generic "invalid credentials" — the user provisioned this bucket themselves and needs to know what to fix in AWS.

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
