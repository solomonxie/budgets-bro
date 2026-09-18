# Budgets Bro MVP — Implementation Plan

See [`DESIGN.md`](DESIGN.md) for the design doc these phases implement.

## Phase 0: Repo & Tooling Bootstrap
Version control, Expo/TS app shell, and the skeleton (nav, DB, secure store) every later phase builds on.

- [x] T0.1 Initialize git repo, `.gitignore`, initial commit
- [x] T0.2 Scaffold Expo TypeScript app — `package.json`, `App.tsx`
- [x] T0.3 Configure ESLint + Prettier
- [x] T0.4 `eas.json` + `app.json` bundle identifier — enables EAS cloud builds
- [x] T0.5 Navigation shell: React Navigation tab skeleton, stub screens — `src/navigation/`
- [x] T0.6 SQLite init + versioned migration runner + initial schema — `src/db/`
- [x] T0.7 Secure-store wrapper for API key/S3 credentials — `src/secure/secureStore.ts`; keys never touch the SQLite DB, written `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (excluded from iCloud/iTunes backup), Android `allowBackup: false` (no OS backup path at all) — see "Secrets vs. backups" in the design doc
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
User-facing screens for end-to-end manual budgeting. Reference: real YNAB's screenshots — see [`DESIGN.md`](DESIGN.md#core-ui) for the full breakdown per screen.

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
- [x] T6.2 Show the rollover carried into the typed amount — the assign popup shows a "Carried over: $X" line (derived from the category's existing balance/assigned/activity fields, no new query) whenever there's a nonzero carryover from prior months, so the typed number reads as new assignment on top of that, not a number in a vacuum
- [x] T6.3 Validate against Unassigned Cash — already shipped in `a0331c6`: `AssignedAmountModal` caps the typed amount at `unassignedCents + initialCents` and shows `assignedAmountModal.exceedsError` if exceeded (this task's original "no such check" note was stale)

## Phase 7: YNAB Data Import
One-time, idempotent import of a user's existing YNAB register export — see [`DESIGN.md`](DESIGN.md#ynab-data-import). Needs stable schema (Phase 1/2) and the Budget UI (Phase 3) to sanity-check imported data against.

- [x] T7.1 Add `import_id` (nullable, unique) to `transactions` if not already in the Phase 1 schema — dedupe key
- [x] T7.2 CSV parser for YNAB's Register/Plan export format — `src/import/csv.ts`
- [x] T7.3 Import mapper: match-or-create accounts/payees/categories by name; `import_id` keyed on account+date+payee (+ occurrence, for same-day duplicates); upserts on conflict — `src/import/ynabImporter.ts`
- [x] T7.4 Import screen: zip file picker (Insights tab), result counts, runs inside one DB transaction
- [x] T7.5 Parser verified against a real export (2489 register rows / 945 plan rows, all dates/amounts/months parsed, transfers detected); full on-device round-trip still untested

## Phase 8: Loan/mortgage v2, investment tracking, recurring transactions
Requested as a follow-up; design captured in [`DESIGN.md`](DESIGN.md#loanmortgage-accounts-v2-designed-not-yet-built). Moved ahead of Backup/Polish — pick up now.

- [x] T8.1 `account_rate_history` table (id, account_id, rate_bps, effective_date) replacing the single static `interest_rate_bps` column on loan/mortgage accounts; migration backfills one row per existing account from its current rate. Edit Account shows the tracked list (add/edit/delete) for an existing loan/mortgage account.
- [x] T8.1b Debt-account linkage moved from category to **payee**: a loan/mortgage account auto-owns a payee named after it (`payees.linked_account_id`); selecting that payee on a transaction posts a mirrored credit to the account, regardless of category. Migration backfills a linked payee for every existing loan/mortgage account. (Supersedes an earlier category-based version — see `DESIGN.md`.)
- [x] T8.1c "Original House Price" field + computed "Down payment: $X" hint (Original House Price − Original Principal).
- [x] T8.2 `account_house_value_history` table (id, account_id, value_cents, effective_date, created_at) — manual value log for a mortgage's home value, feeding Net Worth as the offsetting asset (`HouseValueDetails`). Renamed to `account_value_history` in T8.6 (migration 014) and reused as the generic table for both mortgage house value and tracking-account value logs
- [x] T8.3 Merge loan/mortgage debt + a separate tracking (value) account into one combined account — "Merge Tracking Account" in `AccountModal` (editing a loan-like account) re-points the tracking account's value-history rows onto this account (`accountValueHistoryRepo.reassignAccount`) and archives it
- [x] T8.4 `remainingMonthsToPayoff`/`totalInterestRemainingCents` already take a total payment amount, so an extra/early payment composes by adding to the scheduled payment rather than needing a new signature — see `LoanDetailsCard`'s extra-payment field; unit test confirms it shortens the payoff (rate-history support already shipped in T8.1)
- [x] T8.5 Mortgage account page: equity (value − debt) and value history log (`HouseValueCard`), payoff projection card with an adjustable extra-payment input (`LoanDetailsCard`) — rate history list already shipped in T8.1
- [x] T8.6 Tracking/investment account page: value log entry form with the two modes (exact gain vs. latest total balance, auto-computing the delta for the latter) — `TrackingValueDetails`/`TrackingValueModal`; generalized `account_house_value_history` into `account_value_history` (migration 014) so mortgage and tracking accounts share one table; a tracking account's balance now resolves from its latest logged value instead of transaction math
- [x] T8.7 `scheduled_transactions` table + repo (frequency, interval, next_date, end_date, auto_post) — `scheduledTransactionsRepo.ts`; recurrence math (`nextOccurrenceDate`) lives in `domain/recurrence.ts`, unit-tested, reusing `finance-tools/amortization.ts`'s `addMonths` for monthly/yearly steps
- [x] T8.8 "Upcoming" list (`UpcomingScreen`, Insights tab) + lazy auto-post check on app foreground (`useAutoPostScheduledTransactions`, mounted in `RootNavigator` beside `useAutoCloudSync`) for `auto_post` schedules — catches up multiple missed occurrences in one pass, capped at 366
- [x] T8.9 Scheduled-transaction CRUD UI — `ScheduledTransactionModal` (create/edit/delete), opened from `UpcomingScreen`'s "+ New Schedule" button and each row's Edit menu item. "Pause" wasn't built as a separate state — deleting and re-creating a schedule (or just setting a far-future `next_date`) covers the same need without an extra `paused` column/UI
- [x] T8.10 Simplified: `UpcomingScreen`/`ScheduledTransactionModal` and the manual-approve posting mode removed — every schedule auto-posts (T8.8's lazy foreground check is now the only posting path). Creating one moved into `AddTransactionModal` via a "Scheduled" toggle, so there's one entry point for both one-off and recurring transactions. `RepeatField` replaced the plain Weekly/Monthly/Yearly dropdown: daily/weekly/monthly/yearly + a per-weekday multi-select for weekly (`days_of_week_mask`, migration 017), shown directly with no preset-shortcut list to click through first; the "every N" count is a native wheel (`NumberWheel`, `@react-native-picker/picker`) instead of a keyboard number field.
- [x] T8.11 Simplified: T8.3's "Merge Tracking Account" removed from `AccountModal` — unused in practice, and folding a tracking account's history into a loan/mortgage's own value log blurred two things that should stay distinct. The full amortization calculator/schedule (previously its own pushed screen, `AmortizationScheduleScreen`, reached from `LoanDetailsCard`) moved into a new "Tools" section at the end of `AccountModal`'s edit form instead — a nested pageSheet Modal wrapping the same shared `components/ui/AmortizationCalculator.tsx` the Calculators tab uses, prefilled from the form's own (in-progress-edit) term/principal/rate fields rather than the last-saved account record.

## Phase 9: Cloud Backup & Restore
Superseded by [`docs/design/cloud-sync/`](design/cloud-sync/DESIGN.md), built as a follow-up ahead of this phase's original slot — see that design/plan for the authoritative task breakdown. Below reconciles this phase's original tasks against what actually shipped.

- [x] T9.1 Backup file format — `src/sync/buildBackup.ts` (zip-bytes builder) + `src/sync/parseBackupZip.ts` (parser) + `src/sync/types.ts` (`CloudProvider` shape), extracted from the pre-existing share-sheet export/import so cloud and manual paths share one implementation. No separate version tag beyond the zip's existing table dump — not needed yet at one format.
- [x] T9.3 S3 backup — `src/sync/s3Provider.ts` (hand-rolled SigV4 signing, `@noble/hashes` for HMAC since `expo-crypto` has no HMAC primitive) + `S3ConfigModal.tsx`. `testS3Connection` runs the full fail-closed checklist on save: reachable (`HEAD` the bucket), read/write/delete a marker object, not public (unauthenticated GET of the just-written test object must fail — not `GetBucketPublicAccessBlock`, which needs a permission a least-privilege IAM policy won't have), no anonymous bucket-root access (repeats the reachability check unsigned — must fail). So the whole test only ever needs List/Get/Put/DeleteObject.
- [x] T9.4 Backup settings screen — S3 section in `SettingsScreen.tsx`: add/remove bucket configs, auto-sync toggle, "Last synced", "Sync Now", "Restore Latest from Cloud" (creates a new board, same confirmation as today's file-based restore).
- [x] T9.5 Local device backup (the practical stand-in for iCloud) — `src/sync/localProvider.ts` writes the backup zip to `Paths.document/backups/`, a location the OS never excludes from the user's normal encrypted device backup (iCloud or Finder/computer); `app.json`'s `expo-file-system` plugin config adds `UIFileSharingEnabled` so a real device build also surfaces it in the Files app. One toggle in Settings, no credentials.

Phase complete. Real iCloud Drive was dropped (no first-party Expo module — needs a native module, a dev-client build, and a paid Apple Developer account) and re-scoped to Google Drive as the second cloud provider; that work is tracked only in Backlog below, not as a phase task, since it's blocked on a user-owned Google Cloud Console OAuth Client ID with no ETA.

## Phase 10: Polish & App Store Submission Prep
Converts a working skeleton into a submittable app.

- [ ] T10.1 App icon/splash/branding assets
- [ ] T10.2 Empty states, error boundaries, minimal onboarding
- [ ] T10.3 Privacy nutrition label content + App Store metadata/screenshots (disclose AI/backup data flows)
- [ ] T10.4 TestFlight build via EAS + manual QA pass
- [ ] T10.5 EAS Submit to App Store

## Phase 11: Income accounts redesign — tag, not ledger
Design captured in [`DESIGN.md`](DESIGN.md#income-accounts-shipped). Replaces the original create-then-sweep model (a real entry on the Income account + a generated mirror transfer into a board-wide default cash account) — two independently-editable rows that desynced if you edited or deleted just one after the fact.

- [x] T11.1 `transactions.income_account_id` + `scheduled_transactions.income_account_id` (nullable FK → accounts) — migration 021; backfills existing income-account entries (`income_account_id = account_id` for pre-sweep rows) so historical income-insights totals keep working without surgically collapsing the old sweep-transfer pairs (left in place, self-cancelling, harmless — Income accounts are excluded from Net Worth by kind regardless)
- [x] T11.2 `AddTransactionModal`: the real "Account" field no longer offers Income-typed accounts (nothing to target — they hold no balance); a new optional "Income Account" dropdown appears for positive-amount entries, tagging the transaction. Old auto-sweep-on-save logic removed entirely.
- [x] T11.3 `accountsRepo`/`incomeRepo`/`useIncomeInsights` queries switched from `account_id = ? AND transfer_account_id IS NULL` to `income_account_id = ?`; new `incomeRepo.thisYearTotalsByBoard` powers the Accounts list's Income group (shows "$X this year" per row/subtotal instead of a near-zero ledger balance); `netWorth()` explicitly skips Income-kind accounts rather than relying on their balance netting to ~0
- [x] T11.4 `AccountDetailScreen`'s Income branch swapped to show "Income This Year" big / "$X this month" small (was the reverse); its transaction list now reads `income_account_id`-tagged rows across whichever real accounts the money landed in (`useIncomeAccountTransactions`), each row showing which account that was, with no running-balance column (not a ledger)
- [x] T11.5 Accounts list moves the Income group to the end (`ACCOUNT_KIND_ORDER`), was first
- [x] T11.6 New-board creation (`useBoards.addBoard`) seeds a default Cash, Savings, and Income account — at least one Income account must exist to tag a transaction as income. Scoped to the user-facing "new board" action only, not `boardsRepo.createBoard` itself (shared by demo-board seeding and backup/YNAB-import board creation, both of which populate their own full account set and would double up)
- [x] T11.7 Settings' old "Default Cash Account" (board-wide sweep target) section removed — superseded by the per-transaction Income Account tag
- [x] T11.8 Demo board updated to post tagged transactions directly on checking instead of the entry-plus-sweep-transfer pair

## Phase 12: Off Expo — bare React Native

Rationale in [`DESIGN.md`](DESIGN.md#no-expo-go-no-dev-server). Removes the
`expo` dependency outright, not just the dev-server workflow: every `expo-*`
package swapped for a community library, `ios/` hand-owned and committed
instead of regenerated from `app.json`, and `modules/icloud-drive` rewritten as
a plain RN native module.

Ordered by dependency: leaves first, tooling next, then the three storage
surfaces behind adapters, then the native module, and only then does the
`expo` package itself come out.

| Expo | Replaced by |
|---|---|
| `expo-status-bar` | RN core `StatusBar` |
| `expo-sharing` | RN core `Share` |
| `expo-splash-screen` | the generated `LaunchScreen.storyboard`, kept |
| `expo` (`registerRootComponent`) | `AppRegistry.registerComponent` |
| `expo` (`requireOptionalNativeModule`) | `TurboModuleRegistry.get` |
| `expo/metro-config` | `@react-native/metro-config` |
| `jest-expo` | `react-native/jest-preset` |
| `eslint-config-expo` | `@react-native/eslint-config` |
| `expo-sqlite` | `@op-engineering/op-sqlite` behind `src/db/driver.ts` |
| `expo-file-system` | `react-native-blob-util` behind `src/platform/fs.ts` |
| `expo-file-system`'s `File.pickFileAsync` | `@react-native-documents/picker` |
| `expo-secure-store` | `react-native-keychain` |
| `expo prebuild` | `ios/` committed, edited by hand |

- [ ] T12.1 Leaf swaps — `expo-status-bar` → RN `StatusBar`, `expo-sharing` → RN `Share` (iOS shares a file by `url`), `registerRootComponent` → `AppRegistry`. No native deps touched, no data at risk.
- [ ] T12.2 Tooling off Expo presets — `metro.config.js`, jest preset (all 363 tests must stay green), eslint config. Lands before any library swap so the next phases are verified by the same toolchain they'll ship on.
- [ ] T12.3 `src/db/driver.ts` — own `SQLiteDatabase` interface (`runAsync`/`getAllAsync`/`getFirstAsync`/`execAsync`/`withTransactionAsync`, the only five methods actually used) and re-point all 28 files' type imports at it. Still expo-sqlite underneath: a pure indirection step, so the driver swap that follows touches one file.
- [ ] T12.4 op-sqlite under the driver — same on-disk path (`<documents>/SQLite/budgetsbro.db`) so nothing has to migrate. Re-run the full migration chain (001→030) against a fresh DB and against a restored backup.
- [ ] T12.5 `src/platform/fs.ts` adapter over `react-native-blob-util`, replacing `Directory`/`File`/`Paths` in the six call sites. Must keep the Files-app-visible document folder working (`UIFileSharingEnabled`).
- [ ] T12.6 Document picking — `@react-native-documents/picker` for the YNAB import.
- [ ] T12.7 `react-native-keychain` for the AI key and S3 credentials. **Breaking:** different keychain items, so existing secrets are not readable — Settings must prompt for re-entry rather than silently showing an empty field.
- [ ] T12.8 `modules/icloud-drive` as a plain TurboModule — codegen spec + Swift, dropping `ExpoModulesCore` from the podspec. The Swift body (ubiquity container, coordinated read/write) is unchanged; only the module registration is.
- [ ] T12.9 Own `ios/` — stop gitignoring it, commit the current generated project, and move what `app.json` was configuring (bundle id, entitlements, iCloud containers, `NSUbiquitousContainers`, icons, splash, file sharing) into `Info.plist`/`.entitlements`/asset catalogs. After this there is no prebuild to re-run.
- [ ] T12.10 Remove `expo`, every `expo-*` dependency and `app.json`'s expo block; update README, AGENTS.md (v57 docs no longer the reference) and the tech-stack table.

Done when `grep -ri expo` over tracked files returns nothing but history, and a
device build from a clean checkout still installs and runs.

## Backlog
Not sequenced against the phases above — pick up opportunistically.

- [x] Financial Calculators Module: `amortization.ts` (`monthlyPaymentCents`/`remainingMonthsToPayoff`/`totalInterestRemainingCents`/`buildAmortizationSchedule`, unit-tested) backs both a real account's `AmortizationScheduleScreen` and the standalone `CalculatorsHomeScreen` — extracted into one shared `components/ui/AmortizationCalculator.tsx` (inputs, result summary, extra-payment payoff, full schedule table) so the two screens are thin wrappers differing only in prefill/pinned-payment. `CalculatorsHomeScreen` was also wired into `InsightsStackNavigator` (previously registered as a `StubScreen` despite already existing).
- [x] AI Analysis (BYO Key): Settings' OpenAI section (key entry via `secureStore`, now also a "Test Connection" button) already existed; added `ai/openaiClient.ts` (plain `fetch` to Chat Completions, no SDK) + `ai/prompts.ts` (spending/variance/forecast templates) + `domain/aiAnalysis.ts` (pure context-shaping and Privacy Mode redaction, unit-tested) + a real `AiAnalysisScreen` (kind picker, Privacy Mode toggle, run/result/error states). Provider is OpenAI only for now (matching the pre-existing Settings copy) — Anthropic adapter not built.
- [x] AI Analysis extended: an optional "About You" profile (city/country/age/family size — `settingsRepo` JSON setting, outside Privacy Mode's redaction since it's opt-in by nature of being typed in) feeds two new kinds — **Health** (net worth + this month's spending + profile → overall financial-health read) and **Comparison** (spending vs. typical city/country/world figures, explicitly labeled an LLM general-knowledge estimate, not a real data source — see the external-data-widgets Backlog item below for the real thing).
- [ ] Insights — external-data widgets: cost of living by city, interest rate trends, exchange rates, housing market stats — each needs a data source/API not yet chosen; decide free-vs-paid and where API keys live (likely BYO key via `expo-secure-store`, same pattern as the AI Analysis item above). Note: AI Analysis's "Comparison" kind (see Phase 8-era AI Analysis entry) covers a lighter version of the cost-of-living-by-city case already — an LLM general-knowledge estimate, explicitly labeled as such, not a verified data source. This item is for the real thing.
- [ ] Google Drive as a second cloud-sync provider (`sync/googleDriveProvider.ts`): `expo-auth-session` PKCE against `drive.appdata` scope, Drive REST v3 multipart upload/download to `appDataFolder`, Connect/Disconnect in Settings — see `docs/design/cloud-sync/DESIGN.md`/`IMPLEMENT_PLAN.md` (T2.3–T2.5, T4.2). Blocked on a user-owned Google Cloud Console OAuth Client ID (bundle id `com.solomonxie.budgetsbro`, `drive.appdata` scope, self as test user) before any of this can start.
- [ ] "Backup to iCloud/Folder…" via `Directory.pickDirectoryAsync()` (system folder picker, iCloud Drive included as a normal destination — no native module, entitlement, or paid Apple account needed, unlike real ubiquity-container integration). Deliberately not built: iOS only grants that folder access for the current app session (no persisted security-scoped bookmark in Expo's JS API), so it can only ever be a manual "pick folder, sync now" action, re-prompting after every cold start — not real auto-sync. Given the Local Backup provider (T9.5) already rides the user's normal iPhone/iCloud device backup for free, and manually copying a file from the Files app into iCloud Drive is already one drag-and-drop away, the added picker UI wasn't worth it. Revisit only if Expo's file-system API grows persisted bookmark support.
