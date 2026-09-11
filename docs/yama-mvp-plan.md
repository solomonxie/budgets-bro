# YAMA MVP — Implementation Plan

See [`yama-mvp.md`](yama-mvp.md) for the design doc these phases implement.

## Phase 0: Repo & Tooling Bootstrap
Version control, Expo/TS app shell, and the skeleton (nav, DB, secure store) every later phase builds on.

- [x] T0.1 Initialize git repo, `.gitignore`, initial commit
- [x] T0.2 Scaffold Expo TypeScript app — `package.json`, `App.tsx`
- [x] T0.3 Configure ESLint + Prettier
- [x] T0.4 `eas.json` + `app.json` bundle identifier — enables EAS cloud builds
- [x] T0.5 Navigation shell: React Navigation tab skeleton, stub screens — `src/navigation/`
- [x] T0.6 SQLite init + versioned migration runner + initial schema — `src/db/`
- [x] T0.7 Secure-store wrapper for API key/S3 credentials — `src/secure/secureStore.ts`
- [x] T0.8 Jest test setup + one sample passing test

## Phase 1: Domain Schema + Accounts/Categories CRUD
Accounts and categories are referenced by everything else (transactions, budgets).

- [x] T1.1 Finalize SQLite schema for `accounts` (add `loan` to the account type enum), `category_groups`, `categories` (add nullable `icon` emoji column), `transactions` (add `is_interest` flag) — `src/db/migrations/`
- [x] T1.2 `accountsRepo` CRUD + Accounts screen: grouped by kind (Cash/Credit/Loan/Tracking) with a subtotal per group
- [x] T1.3 `categoriesRepo` CRUD + grouped Categories screen, optional emoji icon picker
- [x] T1.4 Shared domain types for account/category — `src/domain/types.ts`

## Phase 2: Transactions & Budget Envelope Logic
Core ledger and envelope math the budget UI depends on.

- [x] T2.1 `transactions` table + `transactionsRepo` CRUD (incl. transfer pairing and balance-correction adjustment transactions)
- [x] T2.2 `budgetMath.ts` pure functions: category rollover, to-be-budgeted, overspend
- [x] T2.3 `budget_entries` table + `budgetsRepo` (monthly assigned amounts)
- [x] T2.4 Unit tests for `budgetMath.ts`

## Phase 3: Core Budget UI
User-facing screens for end-to-end manual budgeting. Reference: real YNAB's screenshots — see [`yama-mvp.md`](yama-mvp.md#core-ui) for the full breakdown per screen.

- [x] T3.0 Add a Reports tab; consolidate Calculators + AI Analysis into a single "Tools" tab so the bottom bar stays at 5 slots — updates the Phase 0 tab layout in `src/navigation/RootNavigator.tsx`
- [x] T3.1 Budget screen: "Unassigned Cash" banner, collapsible category groups, per-category status badge (funded/partial/overspent) + progress bar + status caption, month navigation
- [x] T3.2 Transaction entry sheet: amount keypad (autofocused — keyboard pops immediately on open), inflow/outflow toggle, payee/category/account pickers, memo, date field, cleared toggle, interest-income toggle on inflows. Also now edits an existing transaction (tap any row in Transactions or an account register) with a Delete action, not just create. Payee autocomplete auto-fills the category from that payee's last transaction.
- [x] T3.3 Transactions (Spending) list: grouped by date, category tag + cleared indicator per row, search, multi-select bulk delete. *Bulk edit not included, delete only.*
- [x] T3.4 Account detail/register screen with running balance, plus a "Correct Balance" action (enter actual balance → one adjustment transaction for the difference)
- [x] T3.5 Reports screen: spending breakdown (stacked bar + top categories), income-vs-spending trend, and interest-earned this month — all computed locally, no AI/network involved

## Phase 4: UX overhaul (nav, budget, accounts, insights)
A batch of usability fixes and feature requests against the working MVP, not new architecture. Bottom tabs are now Budget / Accounts / Insights (Tools folded into Insights; Settings is a header button, not a tab).

- [x] T4.1 Bottom tabs: drop per-tab icons (text-only), reorder/merge so Reports+Tools become one "Insights" tab, Settings moves to a top-left header button on every tab instead of its own slot
- [x] T4.2 Dark theme by default — `theme/colors.ts` + a matching React Navigation theme
- [x] T4.3 Budget screen: "Manage Categories" reachable from the Budget header (was buried in Settings); a "Move to Unassigned" action per category when its balance is positive
- [x] T4.4 Accounts screen: "Total Balance" replaced with Net Worth (Assets/Debts breakdown); Savings and a new Income account kind are their own groups instead of being lumped into Cash
- [x] T4.5 Loan/mortgage accounts: optional rate/term/original-principal/origination-date fields on the account form; an auto-generated, renamed-on-rename "Payment: <account>" budget category (`categories.linked_account_id`); a Loan Details card on the account page projecting payoff date and remaining interest from the account's *actual* current balance (`finance-tools/amortization.ts`)
- [x] T4.6 Insights: month picker, spending breakdown + top categories, and a multi-line category-trend chart (`react-native-svg`, dataviz-skill palette) replacing the old income-vs-spending bars; below the charts, a line-item list to Baby Steps, Tax Insights, Calculators, AI Analysis, and YNAB Import
- [x] T4.7 Baby Steps tracker (Dave Ramsey's 7 steps): Steps 1/2/3/6 computed from real ledger data (emergency-fund account balance, non-mortgage debt, avg monthly spending, mortgage balance), Steps 4/5/7 as manual checkboxes persisted via `app_settings`
- [x] T4.8 Tax Insights: this-year income/spending from the ledger plus two manual inputs (additional income, deductions) → a clearly-labeled non-authoritative "estimated taxable income"; an AI-summary entry point that's honest it's not wired up yet
- [x] T4.9 Mortgage/loan calculator screen (ad-hoc "what if" numbers, not tied to a real account) using the same amortization math as T4.5
- [x] T4.10 Deferred to Backlog: cost of living / interest rate / exchange rate / housing market widgets — no external data source chosen yet

## Phase 5: Account entry UX + inline category management
Requested as a follow-up to Phase 4.

- [x] T5.1 "+ Add Account" opens a modal sheet (same pattern as the transaction sheet), not a pushed full-screen form; editing an account reuses the same sheet (`AccountModal.tsx`)
- [x] T5.2 Removed the floating "+ Transaction" button from the Accounts list screen; each individual account's detail page gets its own "+ Transaction" button that pre-selects that account
- [x] T5.3 Category form: dropped the emoji chip picker — the user types an emoji directly into the category/group name instead
- [x] T5.4 "Create a group" and "create a category" are separate actions (a "+ New Group" button, and "Add Category" from a specific group's "⋯" menu) instead of one form doing both
- [x] T5.5 Removed the dedicated Manage Categories page. Inline on the Budget screen instead: each group header row has a "⋯" menu (add category, rename, move up/down, delete — cascades to its categories); each category row has its own "⋯" menu (rename, move up/down, delete)
- [x] T5.6 Reordering shipped as Move Up/Move Down (in the same "⋯" menus) rather than drag gestures — `react-native-gesture-handler`/`react-native-reanimated` would've meant a babel-config change for more integration risk than this batch; true drag is still open if wanted later

## Phase 6: Budget assignment as direct input + rollover-aware validation
Requested as a follow-up to Phase 4 — not yet implemented.

- [x] T6.1 Replace the +/- stepper on a category's assigned amount with a direct number input (tap the amount, type a value)
- [ ] T6.2 Show the rollover carried into the typed amount — i.e. the input should make clear how much of the category's balance is carryover from prior months vs. new assignment this month, not just accept a number in a vacuum
- [ ] T6.3 Validate against Unassigned Cash: an assignment that would push Unassigned Cash negative is rejected with an explicit message to unassign from other categories first, rather than silently allowed (today's `adjustAssignedCents` has no such check)

## Phase 7: YNAB Data Import
One-time, idempotent import of a user's existing YNAB register export — see [`yama-mvp.md`](yama-mvp.md#ynab-data-import). Needs stable schema (Phase 1/2) and the Budget UI (Phase 3) to sanity-check imported data against.

- [x] T7.1 Add `import_id` (nullable, unique) to `transactions` if not already in the Phase 1 schema — dedupe key
- [x] T7.2 CSV parser for YNAB's Register/Plan export format — `src/import/csv.ts`
- [x] T7.3 Import mapper: match-or-create accounts/payees/categories by name; `import_id` keyed on account+date+payee (+ occurrence, for same-day duplicates); upserts on conflict — `src/import/ynabImporter.ts`
- [x] T7.4 Import screen: zip file picker (Insights tab), result counts, runs inside one DB transaction
- [x] T7.5 Parser verified against a real export (2489 register rows / 945 plan rows, all dates/amounts/months parsed, transfers detected); full on-device round-trip still untested

## Phase 8: iCloud/S3 Backup & Restore
Additive to a working local ledger — comes after Phase 1's schema is stable.

- [ ] T8.1 Backup file format + version tagging — `src/backup/backupFormat.ts`
- [ ] T8.2 iCloud export/import (config plugin + entitlement spike) — `src/backup/icloudBackup.ts`
- [ ] T8.3 S3 backup via aws4fetch + credentials settings screen — `src/backup/s3Backup.ts`
- [ ] T8.4 Backup settings screen: manual backup/restore, destructive-restore confirmation

## Phase 9: Polish & App Store Submission Prep
Converts a working skeleton into a submittable app.

- [ ] T9.1 App icon/splash/branding assets
- [ ] T9.2 Empty states, error boundaries, minimal onboarding
- [ ] T9.3 Privacy nutrition label content + App Store metadata/screenshots (disclose AI/backup data flows)
- [ ] T9.4 TestFlight build via EAS + manual QA pass
- [ ] T9.5 EAS Submit to App Store

## Phase 10: Loan/mortgage v2, investment tracking, recurring transactions
Requested as a follow-up; design captured in [`yama-mvp.md`](yama-mvp.md#loanmortgage-accounts-v2-designed-not-yet-built). Not blocking Phase 9 (App Store submission) — pick up whenever.

- [x] T10.1 `account_rate_history` table (id, account_id, rate_bps, effective_date) replacing the single static `interest_rate_bps` column on loan/mortgage accounts; migration backfills one row per existing account from its current rate. Edit Account shows the tracked list (add/edit/delete) for an existing loan/mortgage account.
- [x] T10.1b Debt-account linkage moved from category to **payee**: a loan/mortgage account auto-owns a payee named after it (`payees.linked_account_id`); selecting that payee on a transaction posts a mirrored credit to the account, regardless of category. Migration backfills a linked payee for every existing loan/mortgage account. (Supersedes an earlier category-based version — see `yama-mvp.md`.)
- [x] T10.1c "Original House Price" field + computed "Down payment: $X" hint (Original House Price − Original Principal).
- [ ] T10.2 `account_value_entries` table (id, account_id, value_cents, as_of_date, note, created_at, gain_cents nullable, mode nullable) — generic manual value log, shared by mortgage "current home value" and tracking/investment accounts
- [ ] T10.3 Merge loan/mortgage debt + a separate tracking (value) account into one combined account — one-time migration action, archives the tracking account
- [ ] T10.4 `finance-tools/amortization.ts`: accept an optional extra/early-payment input for a revised payoff date (rate-history support already shipped in T10.1)
- [ ] T10.5 Mortgage account page: equity (value − debt), value history log, payoff projection card with adjustable extra-payment input (rate history list already shipped in T10.1)
- [ ] T10.6 Tracking/investment account page: value log entry form with the two modes (exact gain vs. latest total balance, auto-computing the delta for the latter)
- [ ] T10.7 `scheduled_transactions` table + repo (frequency, interval, next_date, end_date, auto_post)
- [ ] T10.8 "Upcoming" list (manual-approve schedules) + lazy auto-post check on app foreground for `auto_post` schedules
- [ ] T10.9 Scheduled-transaction CRUD UI (create/edit/pause/delete a schedule, from the transaction entry sheet or a dedicated list)

## Backlog
Not sequenced against the phases above — pick up opportunistically.

- [ ] Financial Calculators Module: `mortgage.ts`/`loan.ts` pure functions + unit tests, `amortization.ts` schedule generator + unit tests, Calculators home + mortgage/loan calculator screens, amortization schedule table screen — independent of the budgeting domain
- [ ] AI Analysis (BYO Key): AI settings screen (enter/store API key, test connection), `aiClient.ts` + Anthropic/OpenAI provider adapters, analysis prompt templates (spending/variance/forecast), AI analysis screen (trigger, privacy-mode toggle, render results) — needs secure-store (Phase 0) and real budget data (Phase 2)
- [ ] Insights — external-data widgets: cost of living by city, interest rate trends, exchange rates, housing market stats — each needs a data source/API not yet chosen; decide free-vs-paid and where API keys live (likely BYO key via `expo-secure-store`, same pattern as the AI Analysis item above)
