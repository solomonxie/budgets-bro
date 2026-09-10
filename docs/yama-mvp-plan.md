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

## Phase 4: Financial Calculators Module
Independent of the budgeting domain — can proceed in parallel with Phases 1-3.

- [ ] T4.1 `mortgage.ts` / `loan.ts` pure functions + unit tests — `src/finance-tools/`
- [ ] T4.2 `amortization.ts` schedule generator + unit tests
- [ ] T4.3 Calculators home + mortgage/loan calculator screens
- [ ] T4.4 Amortization schedule table screen

## Phase 5: iCloud/S3 Backup & Restore
Additive to a working local ledger — comes after Phase 1's schema is stable.

- [ ] T5.1 Backup file format + version tagging — `src/backup/backupFormat.ts`
- [ ] T5.2 iCloud export/import (config plugin + entitlement spike) — `src/backup/icloudBackup.ts`
- [ ] T5.3 S3 backup via aws4fetch + credentials settings screen — `src/backup/s3Backup.ts`
- [ ] T5.4 Backup settings screen: manual backup/restore, destructive-restore confirmation

## Phase 6: AI Analysis (BYO Key)
Needs secure-store (Phase 0) and real budget data (Phase 2).

- [ ] T6.1 AI settings screen: enter/store API key, test connection
- [ ] T6.2 `aiClient.ts` + Anthropic/OpenAI provider adapters, error handling — `src/ai/`
- [ ] T6.3 Analysis prompt templates (spending/variance/forecast), aggregate-vs-detailed modes
- [ ] T6.4 AI analysis screen: trigger, privacy-mode toggle, render results

## Phase 7: YNAB Data Import
One-time, idempotent import of a user's existing YNAB register export — see [`yama-mvp.md`](yama-mvp.md#ynab-data-import). Needs stable schema (Phase 1/2) and the Budget UI (Phase 3) to sanity-check imported data against.

- [x] T7.1 Add `import_id` (nullable, unique) to `transactions` if not already in the Phase 1 schema — dedupe key
- [x] T7.2 CSV parser for YNAB's Register/Plan export format — `src/import/csv.ts`
- [x] T7.3 Import mapper: match-or-create accounts/payees/categories by name; `import_id` keyed on account+date+payee (+ occurrence, for same-day duplicates); upserts on conflict — `src/import/ynabImporter.ts`
- [x] T7.4 Import screen: zip file picker (Insights tab), result counts, runs inside one DB transaction
- [x] T7.5 Parser verified against a real export (2489 register rows / 945 plan rows, all dates/amounts/months parsed, transfers detected); full on-device round-trip still untested

## Phase 8: Polish & App Store Submission Prep
Converts a working skeleton into a submittable app.

- [ ] T8.1 App icon/splash/branding assets
- [ ] T8.2 Empty states, error boundaries, minimal onboarding
- [ ] T8.3 Privacy nutrition label content + App Store metadata/screenshots (disclose AI/backup data flows)
- [ ] T8.4 TestFlight build via EAS + manual QA pass
- [ ] T8.5 EAS Submit to App Store

## Phase 9: Insights — external-data widgets (deferred)
Ideas for the Insights tab that need a live external data source (none wired up yet — no backend, no chosen provider). Built so far without one: spending breakdown + category trends (local), Baby Steps, Tax Insights, mortgage/loan calculator. Deferred:

- [ ] T9.1 Cost of living by city — needs a data source/API
- [ ] T9.2 Interest rate trends — needs a rates feed (e.g. central bank / FRED)
- [ ] T9.3 Exchange rates — needs an FX rates API
- [ ] T9.4 Housing market stats — needs a housing-data API
- [ ] T9.5 Decide free-vs-paid data sources and where API keys live (likely BYO key via `expo-secure-store`, same pattern as Phase 6 AI)

## Phase 10: UX overhaul (nav, budget, accounts, insights)
A batch of usability fixes and feature requests against the working MVP, not new architecture. Bottom tabs are now Budget / Accounts / Insights (Tools folded into Insights; Settings is a header button, not a tab).

- [x] T10.1 Bottom tabs: drop per-tab icons (text-only), reorder/merge so Reports+Tools become one "Insights" tab, Settings moves to a top-left header button on every tab instead of its own slot
- [x] T10.2 Dark theme by default — `theme/colors.ts` + a matching React Navigation theme
- [x] T10.3 Budget screen: "Manage Categories" reachable from the Budget header (was buried in Settings); a "Move to Unassigned" action per category when its balance is positive
- [x] T10.4 Accounts screen: "Total Balance" replaced with Net Worth (Assets/Debts breakdown); Savings and a new Income account kind are their own groups instead of being lumped into Cash
- [x] T10.5 Loan/mortgage accounts: optional rate/term/original-principal/origination-date fields on the account form; an auto-generated, renamed-on-rename "Payment: <account>" budget category (`categories.linked_account_id`); a Loan Details card on the account page projecting payoff date and remaining interest from the account's *actual* current balance (`finance-tools/amortization.ts`)
- [x] T10.6 Insights: month picker, spending breakdown + top categories, and a multi-line category-trend chart (`react-native-svg`, dataviz-skill palette) replacing the old income-vs-spending bars; below the charts, a line-item list to Baby Steps, Tax Insights, Calculators, AI Analysis, and YNAB Import
- [x] T10.7 Baby Steps tracker (Dave Ramsey's 7 steps): Steps 1/2/3/6 computed from real ledger data (emergency-fund account balance, non-mortgage debt, avg monthly spending, mortgage balance), Steps 4/5/7 as manual checkboxes persisted via `app_settings`
- [x] T10.8 Tax Insights: this-year income/spending from the ledger plus two manual inputs (additional income, deductions) → a clearly-labeled non-authoritative "estimated taxable income"; an AI-summary entry point that's honest it's not wired up yet
- [x] T10.9 Mortgage/loan calculator screen (ad-hoc "what if" numbers, not tied to a real account) using the same amortization math as T10.5
- [x] T10.10 Deferred, tracked in Phase 9: cost of living / interest rate / exchange rate / housing market widgets — no external data source chosen yet

## Phase 11: Account entry UX + inline category management
Requested as a follow-up to Phase 10.

- [x] T11.1 "+ Add Account" opens a modal sheet (same pattern as the transaction sheet), not a pushed full-screen form; editing an account reuses the same sheet (`AccountModal.tsx`)
- [x] T11.2 Removed the floating "+ Transaction" button from the Accounts list screen; each individual account's detail page gets its own "+ Transaction" button that pre-selects that account
- [x] T11.3 Category form: dropped the emoji chip picker — the user types an emoji directly into the category/group name instead
- [x] T11.4 "Create a group" and "create a category" are separate actions (a "+ New Group" button, and "Add Category" from a specific group's "⋯" menu) instead of one form doing both
- [x] T11.5 Removed the dedicated Manage Categories page. Inline on the Budget screen instead: each group header row has a "⋯" menu (add category, rename, move up/down, delete — cascades to its categories); each category row has its own "⋯" menu (rename, move up/down, delete)
- [x] T11.6 Reordering shipped as Move Up/Move Down (in the same "⋯" menus) rather than drag gestures — `react-native-gesture-handler`/`react-native-reanimated` would've meant a babel-config change for more integration risk than this batch; true drag is still open if wanted later

## Phase 12: Budget assignment as direct input + rollover-aware validation
Requested as a follow-up to Phase 10 — not yet implemented.

- [ ] T12.1 Replace the +/- stepper on a category's assigned amount with a direct number input (tap the amount, type a value)
- [ ] T12.2 Show the rollover carried into the typed amount — i.e. the input should make clear how much of the category's balance is carryover from prior months vs. new assignment this month, not just accept a number in a vacuum
- [ ] T12.3 Validate against Unassigned Cash: an assignment that would push Unassigned Cash negative is rejected with an explicit message to unassign from other categories first, rather than silently allowed (today's `adjustAssignedCents` has no such check)
