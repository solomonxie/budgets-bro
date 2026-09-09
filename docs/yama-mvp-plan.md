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

- [ ] T1.1 Finalize SQLite schema for `accounts`, `category_groups`, `categories` — `src/db/migrations/`
- [ ] T1.2 `accountsRepo` CRUD + Accounts list/add/edit screen
- [ ] T1.3 `categoriesRepo` CRUD + grouped Categories screen
- [ ] T1.4 Shared domain types for account/category — `src/domain/types.ts`

## Phase 2: Transactions & Budget Envelope Logic
Core ledger and envelope math the budget UI depends on.

- [ ] T2.1 `transactions` table + `transactionsRepo` CRUD (incl. transfer pairing)
- [ ] T2.2 `budgetMath.ts` pure functions: category rollover, to-be-budgeted, overspend
- [ ] T2.3 `budget_entries` table + `budgetsRepo` (monthly assigned amounts)
- [ ] T2.4 Unit tests for `budgetMath.ts`

## Phase 3: Core Budget UI
User-facing screens for end-to-end manual budgeting.

- [ ] T3.1 Budget screen (monthly envelope view: assign/activity/balance per category)
- [ ] T3.2 Transactions list + edit screen (account/category pickers)
- [ ] T3.3 Account detail/register screen with running balance
- [ ] T3.4 Month navigation (prev/next, carryover display)

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

## Phase 7: Polish & App Store Submission Prep
Converts a working skeleton into a submittable app.

- [ ] T7.1 App icon/splash/branding assets
- [ ] T7.2 Empty states, error boundaries, minimal onboarding
- [ ] T7.3 Privacy nutrition label content + App Store metadata/screenshots (disclose AI/backup data flows)
- [ ] T7.4 TestFlight build via EAS + manual QA pass
- [ ] T7.5 EAS Submit to App Store
