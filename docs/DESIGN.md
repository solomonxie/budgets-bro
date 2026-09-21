# Budgets Bro MVP — Design Doc

## Problem
Existing YNAB-style budgeting apps are subscription-based, cloud-backend-dependent, and require trusting a third party with financial data. There's no free, privacy-first alternative that does zero-based/envelope budgeting well, includes basic financial calculators, and offers AI-assisted analysis without routing data through a vendor-run server.

## Goals
- Free iOS app, lean YNAB-style envelope budgeting (accounts, categories, budgets, transactions, transfers).
- One-time import of a user's existing YNAB data, so switching costs nothing.
- Two native, on-device reports (spending breakdown, income vs. spending trend) — no AI or network call required for either.
- Self-contained financial calculators module (mortgage, loan/interest, amortization).
- AI analysis using the user's own API key, called directly from device to provider.
- Receipt capture: a photo shared in from Photos becomes transactions to review — on-device OCR, no photo-library permission ([`design/receipt-capture/DESIGN.md`](design/receipt-capture/DESIGN.md)).
- SQLite as the single on-device source of truth; iCloud and S3 as optional backup targets.
- Zero backend servers operated by Budgets Bro — client-only app, for both cost and privacy.
- Lightweight and blazing fast: small install, instant to open, no spinner for anything the phone can do itself. See Size and speed budget below.

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
- Receipt photo attachment on transactions — deferred post-MVP (needs local image storage/size management). Reading a receipt shared into the app is a separate thing and is designed in [`design/receipt-capture/DESIGN.md`](design/receipt-capture/DESIGN.md): the photo is parsed on-device and discarded, never stored.
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
- `transactions` (id, account_id, category_id nullable, payee_id nullable, memo, purchase_items nullable, amount_cents signed, date, cleared, is_interest, transfer_account_id nullable, import_id nullable unique, created_at, updated_at) — `import_id` is the dedupe key for YNAB data import (below); `is_interest` flags interest income on savings-type accounts so it can be broken out separately in reports/AI analysis instead of blending into generic income; `purchase_items` is a short `key=value, key=value` string naming what was bought (typed by hand, or filled from a shared receipt) — one column rather than a child table because it is only ever read whole, and it is what Insights' Purchase Insights page aggregates (see `src/domain/purchaseItems.ts`)

**Derived (computed, not stored):**
- Category balance(month) = cumulative assigned(≤ month) + cumulative activity(≤ month). Because this is a running cumulative sum rather than a per-month reset, an unspent balance automatically carries forward to next month in the same category — this rollover is the core mechanic of envelope budgeting and isn't a separate feature to build. The same mechanism lets a user assign money to a *future* month (there's nothing that restricts `budget_entries.month` to the current or past) — assigning ahead just pre-funds that month's cumulative balance.
- Unassigned Cash = sum(uncategorized, non-transfer transaction amounts on on-budget accounts, all time) − sum(assigned, all time). Deliberately *not* "sum of positive inflows" — an uncategorized transaction can be negative too (a balance correction that finds less money than expected must reduce Unassigned Cash, not be ignored). And deliberately *not* a function of the month on screen: it is a stock, not a flow. Cash and activity count as of today, assignments count across every month an entry exists for — **future months included** — so money you gave to next month is already spoken for, and the figure reads the same whichever month you are browsing. Scoping it to the viewed month answers a different question ("had this been assigned yet, as of September?") and shows the same dollars as free in one month and spent in another, which invites assigning them twice.
- Account balance = opening_balance + sum(transactions.amount_cents)

Balances are computed, not stored, to avoid drift bugs.

**Correcting a balance**: no reconciliation UI/terminology — if an account's real-world balance drifts from what Budgets Bro computes, the user enters the actual balance and Budgets Bro creates one uncategorized adjustment transaction for the difference (payee "Balance Adjustment"). It flows through the same Unassigned Cash math as any other uncategorized transaction, positive or negative — no special-cased reconciliation logic needed. Reachable from the Edit Account sheet — a "Current Balance" field right under Starting Balance; changing it and saving posts the adjustment. Both fields carry a hint saying which balance they mean.

## Loan/mortgage payments today (shipped)
A loan/mortgage-*typed* account (`accounts.type IN ('loan','mortgage')`) owns exactly one auto-generated, auto-renamed **payee** named after it (`payees.linked_account_id`) — not a category. Selecting that payee on *any* transaction, regardless of category, posts a second, mirrored transaction into the linked account for the same amount (opposite sign), paired via `transfer_account_id` — so an $800 outflow with payee "Dachang House debt" both spends from whatever category it's budgeted under *and* reduces that loan account's balance by $800, automatically. (An earlier version of this linked a category instead — payee turned out to be the right unit, since a debt payment isn't inherently one category, and category-linking collided with the auto-generated category taking the "one link per account" slot.)

This only exists for accounts *typed* loan/mortgage in this app — an account whose type was guessed wrong by the YNAB importer (e.g. a mortgage debt account imported as `loan` because its name contained "debt", not "mortgage") still gets the mechanism (both types behave identically here), but a plain `tracking`-typed account doesn't.

Also shipped: interest rate as a real history (`account_rate_history`: rate + effective date, add/edit/delete) instead of one static column — the account page's payoff projection reads the latest entry. A "Purchase Price" field on mortgage accounts, with a computed, read-only "Down Payment — $X (Y% down)" row once it and Mortgage Amount are both filled in. Field labels lead with what the user knows ("Purchase Price", "Mortgage Amount"/"Amount Borrowed") rather than lender wording ("Original Principal"), each with a one-line hint. Mortgage Amount and the starting balance are the same number for a loan added on day one, so a loan-like account labels the ledger seed "Balance When Tracking Started" and auto-fills it as the negated Mortgage Amount until hand-edited — the two stay separate fields (contract term vs. ledger seed) because a part-paid loan added later owes less than it borrowed.

The loan card on the account page reports only — rate, scheduled payment, projected payoff, remaining interest — with no extra-payment input: it shows the loan as it actually is. What-if extra payments belong to the payoff/early-repayment calculators, which is also where the schedule table lives.

### A loan's balance is remaining principal, derived (shipped)
A payment is one transaction for the full amount the bank statement shows — never split into principal and interest legs. Splitting is tedious to enter and wrong the moment a rate or date is corrected, so it happens at read time instead: `accounts.balance` for a loan/mortgage is **not** opening_balance + transactions, it is the remaining principal from `finance-tools/remainingPrincipal`.

- **Anchor**: the latest `'principal'` reading the user logged — a statement figure, ground truth. Falling back to the amount borrowed at origination, then to the opening balance.
- **Estimate between readings**: each payment posted after the anchor covers that period's interest first (`finance-tools/paymentSplit`, compounding across a skipped month), and only the remainder comes off the principal. So the number drifts toward the truth instead of plummeting by the full payment.
- **Logging a reading writes no transaction.** It is a reading, not a ledger correction — the "Current Balance" adjustment path (above) is deliberately not offered for loans. Reachable from the edit page ("Current Remaining Principal") and from the account page ("+ Update Remaining Principal"), both writing the same row.
- Migration 024 gives `account_value_history` a `kind`: `'value'` (a home's worth, a tracking account's total) or `'principal'` (what a loan owes). One table, one "latest effective_date wins" rule, one modal (`LoggedValueModal`).
- Nothing derived is stored, per the rule above — fix a rate or a payment date and every figure recomputes. Cost: the accounts list needs each loan's payments, so `listAccountsWithBalances` fans out to three board-wide queries (readings, rates, loan payments) rather than one per account.
- A loan account shows no per-row running balance: it would be a different number walking back from an unrelated total.
- A mortgage's edit page therefore asks for neither an opening nor a current balance — it asks for Current House Value and Current Remaining Principal, then the contract terms (term, purchase price, mortgage amount, computed down payment, purchase date, note).

## Loan/mortgage accounts v2 (designed, not yet built)
Today, a mortgage is two unrelated accounts if the user wants to track both the debt and the home's value (one `loan`/`mortgage`-typed, one `tracking`-typed) — no shared identity, no combined equity number. Redesign: **one account is the whole mortgage** — its debt side and its value side.

- **Debt side** — unchanged (balance = opening + transactions, reduced by linked-payee payments; rate history already shipped, above).
- **Value side** — new table `account_value_entries` (id, account_id, value_cents, as_of_date, note nullable, created_at) — a manually-entered log of the home's market value over time (user's own estimate; no external valuation API). Latest entry = "current value". This table is generic, not mortgage-specific — see Tracking/investment accounts below, which reuses it.
- **Equity** = latest value entry − debt balance. Shown on the account page instead of two separate Net Worth rows.
- **Payoff projection** — extends `finance-tools/amortization.ts` (already reads the rate history for current rate) to also take an extra/early-payment input (lump sum or recurring add-on) to recompute a faster payoff date. Still a pure function, still no DB/React dependency. That input belongs to the calculators, not the account page (revised — see below).
- **Account page** becomes the "intelligence" surface: current debt, current value, equity, rate history list (shipped), payoff projection card, value history log/chart — all local, no network. Revised: the account page reports actuals only, no what-if inputs — the page answers "where does this loan stand", the calculators answer "what if I paid more".
- **Migration**: existing split accounts (debt + tracking) aren't auto-merged — a "Merge into one mortgage account" action folds a tracking account's value into a mortgage account's new value log and archives the tracking account, but the tool itself isn't built yet.

## Tracking/investment accounts (shipped)
Non-cash accounts (RRSP/TFSA-style investments, or any `tracking` account) share the `account_value_history` log with a mortgage's value side. A snapshot is one figure: **the total value now**, with a date and a note.

Gain/loss is never entered, only derived. It shipped as a second entry mode — type the period's gain and the new value is the old one plus it — and came back out: a real gain moves every day, so a number typed as "the gain" is only true for the instant it was read, while a total is a fact you can copy off a statement. Subtracting two totals recovers the gain exactly, and the chart already does that against real transactions (`domain/investmentGrowth.ts` splits deposited vs gain).

A tracking account's "balance" is its latest logged value rather than opening_balance + transactions. Transactions still exist for real cash moving in and out (a contribution), but growth is logged, not summed.

## Income accounts (removed)
Shipped as an `income`-typed account plus a `transactions.income_account_id` tag; removed again in migration 028.

The tag was a third field for a fact the first two already carried. Worse, the spend form defaulted it — every inflow got stamped with the first Income account whether or not the user chose one — so a deposit read "Account: RRSP, Payee: Chequing, Income account: Income" and meant nothing by it.

**An inflow's source is its payee.** That is what a payee is for, it needs no second field, and it needs no account that money never sits in. Income reporting groups inflows by payee (`reportsRepo.incomeByPayeeInRange`), using the same definition of income the totals already used — positive, non-transfer, on-budget — so the parts add up to the whole.

- Migration 028 drops both `income_account_id` columns, and converts income-typed accounts to archived `tracking` ones rather than deleting them: they hold no transactions of their own, and archiving keeps their names recoverable from Closed Accounts.
- `income_detail_history` (pay-rate history) is left in place, unread. Dropping a table the user typed into isn't a migration's call to make.
- Gone with it: the Income account kind and group, `useIncomeInsights`, `useIncomeAccountTransactions`, `useIncomeAccountYearTotals`, `IncomeTrendChart`, `IncomeDetailModal`, `incomeRepo`, `incomeDetailHistoryRepo`.
- Accounts list order is now `ACCOUNT_KIND_ORDER`: Cash · Savings · Tracking · Loan · Asset · Credit — Loan ahead of Asset so a mortgage's debt reads near the cash it is paid from.

## Inter-account transfers (shipped)
A transfer is two rows, and each names the account across from it: the payer's row names where the money went and is negative, the receiver's names where it came from and is positive. Both are created from one entry — post a transaction whose payee is an account-linked payee (`payeesRepo.ensureAccountPayee`) and `transactionsRepo.postLinkedAccountLeg` mirrors it.

- The mirror used to carry the *same* payee through, labelling the receiving row with its own account name ("Maple Street Mortgage" on the mortgage's own page). Migration 027 relabels the ones already posted.
- `createTransfer` posted both legs with no payee at all, which read as "(No payee)" everywhere; migration 026 backfilled those. It has no callers — every real transfer goes through the linked payee.

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
3. App calls the provider's REST API directly from the device — no Budgets Bro server in the path.
4. Response renders in-app; nothing is persisted or transmitted to Budgets Bro infrastructure (there is none).

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

## Size and speed budget
Lightweight and instant is a requirement, not a nice-to-have — see
[`AGENTS.md`](../AGENTS.md) for the rules that hold it. Measured on a Release
device build, 2026-09-19:

| | measured | budget |
|---|---|---|
| installed on device | **17 MB** | < 25 MB |
| zipped (download proxy) | **7.2 MB** | < 12 MB |
| `main.jsbundle` | 3.38 MB Hermes bytecode | < 4 MB |
| JS source in the bundle | 4.80 MB | — |
| app binary / `React.framework` / `hermesvm` | 3.3 / 5.6 / 2.3 MB stripped | fixed floor |

Two thirds of an unstripped build is debug symbols (29 MB → 17 MB), and
Xcode's own `STRIP_INSTALLED_PRODUCT` only reaches the app binary, not the
three embedded frameworks. `scripts/install-ios-device.sh` therefore strips
all four after the build, re-signs each with the identity the build used, and
installs the result **only if `codesign --verify --deep --strict` passes** —
otherwise it installs the untouched build and says so.

Bundle by package: `react-native` 2.0 MB, own `src/` ~1.4 MB,
`react-native-svg` 257 KB, `@react-navigation/*` ~400 KB, `jszip` 95 KB,
`http-status-codes` 58 KB + `buffer` 57 KB (both dragged in by
`@dr.pogodin/react-native-fs` — the next 115 KB to reclaim, and only
reachable by replacing that library, since `src/files/bytes.ts` already
means none of our own code imports them).

Reproduce:
```
du -sh /tmp/budgetsbro-device/Build/Products/Release-iphoneos/BudgetsBro.app
npx react-native bundle --platform ios --dev false --entry-file index.ts \
  --bundle-output /tmp/bb.bundle --sourcemap-output /tmp/bb.map
# then sum sourcesContent lengths in /tmp/bb.map, grouped by node_modules package
```

Runtime shape:
- **Startup**: Hermes bytecode (no JS parse), SQLite opened once behind a
  cached promise, WAL + `synchronous = NORMAL`, and `migrate` costs one
  `PRAGMA user_version` when there is nothing to run.
- **Invalidation is global**: every write bumps `dataVersion` and every
  mounted read hook refetches. Fine at a personal ledger's size, and the
  reason each hook's query must stay narrow — it runs again after every save.
- **The whole-board reads** are `useTransactions` (the list), `useFlaggedCount`
  (badge: list + transfer audit + month totals) and the Flagged Transactions
  page. Those pages are *about* every row; nothing else may join the payee,
  category and account labels onto the board to render a subset of it.

## Storage/backup architecture
- **SQLite** = source of truth. Library: `expo-sqlite` (works under Expo managed workflow + EAS builds, no custom native linking). `op-sqlite`/SQLCipher deferred until at-rest encryption is required.
- **iCloud backup**: export of the SQLite file into the app's iCloud container (Expo config plugin + entitlement, buildable via EAS).
- **S3 backup**: user provisions their own bucket + scoped IAM credentials. No backend to presign requests, so the app signs S3 REST calls client-side with `aws4fetch`, keeping the app backend-less.
- **Backup format**: primary = raw SQLite file copy; secondary/optional = JSON export for portability.
- **Restore**: pick a backup source → download → validate schema-version tag → full replace of local DB (destructive-and-confirmed, no merge/dedupe for MVP).
- **S3 credential validation, on save, before the key is accepted** (fail closed — reject and explain, don't silently store an unusable/unsafe credential):
  1. **Reachable**: sign and send a lightweight request (e.g. `HEAD` the bucket) — confirms the endpoint/region/bucket name resolve at all.
  2. **Read/write**: write a small marker object (e.g. `.budgetsbro/write-test`) and read it back, then delete it — confirms the credential can actually do both, not just list.
  3. **Not public**: check the bucket's Public Access Block config / ACL — reject if the bucket is publicly readable or writable; this is a personal finance backup target, not a public one.
  4. **No anonymous access**: repeat the reachability check with no credentials — must fail. If an unauthenticated request succeeds, the bucket policy is too permissive regardless of what this app's own IAM user can do.
  - Any step failing shows a specific, actionable error (which check failed and why) instead of a generic "invalid credentials" — the user provisioned this bucket themselves and needs to know what to fix in AWS.

## Tech stack
| Concern | Choice | Reasoning |
|---|---|---|
| Framework | Expo SDK (prebuild, TypeScript) | Native project generated from `app.json`, built locally with Xcode — see "No Expo Go, no dev server" below |
| Navigation | React Navigation (native-stack + bottom-tabs) | Explicit nav tree simpler than file-based routing for a small app |
| Local DB | expo-sqlite | No custom native linking under EAS; adequate for single-user scale |
| State management | Zustand | Most state is SQLite queries + light UI state; Redux/React Query is overkill |
| Data layer | Repository functions (`src/db/repositories`) | Isolates SQL, testable independent of UI |
| Styling | RN `StyleSheet` + design-tokens file | Avoids Tailwind/NativeWind weight for MVP |
| Secure storage | expo-secure-store | Keychain-backed, for AI API key + S3 credentials |
| AI calls | Direct `fetch` to provider REST endpoints | Avoids heavy SDKs, keeps payload (aggregate/detailed) under app's control |
| S3 signing | own `sync/sigv4.ts` over `@noble/hashes` | AWS's own signer cost 341 KB of bundle for four calls; the replacement is checked against its output in `sigv4.test.ts` |
| Testing | Jest (`jest-expo`) | Unit tests for calculators & budget math only |
| Build/submit | Local `xcodebuild` + `devicectl`; EAS only for over-the-air/TestFlight | Everyday path is a Release build straight onto the phone (`npm run ios`) |
| Lint/format | ESLint + Prettier | Baseline consistency for solo maintainer |
| Charts (Insights) | `react-native-svg` for the line chart; stacked bar still hand-rolled `View`/flex | Line chart needs real point geometry; the bar doesn't |

## No Expo Go, no dev server

Removed entirely: no `expo start`, no Expo Go, no dev client, no Metro server in
the loop. The only way this app runs is a native Release build installed on a
real device (`npm run ios`), with the JS bundled into the app.

**Why.** Expo Go was buggy, wanted a login, and added a layer of its own between
the code and what actually ships. For a personal, single-developer app it bought
nothing: every feature that matters here — SQLite, secure-store, file sharing,
and especially `modules/icloud-drive` — is a native module that either behaves
differently inside Expo Go's shell or is missing from it outright, so anything
seen there had to be re-verified in a real build anyway. What it did add was
overhead and confusion: two runtimes to reason about, a class of bug that only
exists in one of them, and stale-bundle mysteries when the server and the
installed app disagreed.

**Cost accepted.** No Fast Refresh and no one-second reload — a change costs a
native build (minutes, incremental). In exchange there is exactly one runtime,
and what is on the phone is what the code says. Debug builds attached to Metro
are still possible in principle; they are simply not a path this repo documents
or supports.

**Metro is not Expo Go.** The bundler still runs — at build time, to produce the
`main.jsbundle` baked into the app. `metro.config.js` stays.

## Testing strategy
- Unit tests for `finance-tools/*` and `domain/budgetMath.ts` (rollover, to-be-budgeted, overspend) — these need correctness guarantees.
- DB repository layer stays thin (CRUD SQL); business logic lives in pure functions, testable without a DB.
- No E2E (Detox/Maestro) for MVP — manual QA via TestFlight before submission.
- GitHub Actions CI: `npm test` + `npm run lint` on push.

## Risks / open questions
- expo-sqlite has no built-in migration framework — needs a small homegrown versioned migration runner.
- iCloud container entitlement under Expo config plugins + EAS build needs a spike to confirm it doesn't force a bare-workflow eject.
- ~~aws4fetch relies on WebCrypto~~ — settled: signing is pure JS over `@noble/hashes`, so nothing depends on WebCrypto under Hermes.
- Cutting bank-linking, CSV import, and multi-currency may feel too lean for some users — explicitly deferred to post-MVP roadmap.
- App Store privacy label must disclose that transaction data can be sent to a user-chosen AI provider and to user-chosen iCloud/S3 backup targets.
