# YAMA MVP — Design Doc

## Problem
Existing YNAB-style budgeting apps are subscription-based, cloud-backend-dependent, and require trusting a third party with financial data. There's no free, privacy-first alternative that does zero-based/envelope budgeting well, includes basic financial calculators, and offers AI-assisted analysis without routing data through a vendor-run server.

## Goals
- Free iOS app, lean YNAB-style envelope budgeting (accounts, categories, budgets, transactions, transfers).
- Self-contained financial calculators module (mortgage, loan/interest, amortization).
- AI analysis using the user's own API key, called directly from device to provider.
- SQLite as the single on-device source of truth; iCloud and S3 as optional backup targets.
- Zero backend servers operated by YAMA — client-only app, for both cost and privacy.

## Non-goals (MVP cut lines)
- Multi-device real-time sync (backups are point-in-time export/restore, not live sync)
- Bank-linking / Plaid / automatic transaction import
- Multi-user, family, or shared budgets
- Android (iOS-only initially)
- Push notifications, reminders, recurring-transaction automation
- CSV import (possible post-MVP; manual entry only for MVP)
- Multi-currency (single currency assumed)
- Advanced reporting/BI beyond budget-vs-actual and category spend view
- AI taking actions on data (analysis/insights only, read-only against the AI provider)

## Core domain model
Envelope/zero-based budgeting, YNAB-style. Transfers are linked transaction pairs, not a separate ledger.

**Tables (SQLite):**
- `accounts` (id, name, type: checking|savings|credit_card|cash|tracking, on_budget, currency, opening_balance_cents, archived_at, created_at)
- `category_groups` (id, name, sort_order)
- `categories` (id, group_id, name, sort_order, archived_at)
- `budget_entries` (id, category_id, month `YYYY-MM`, assigned_cents) — one row per category per month
- `payees` (id, name)
- `transactions` (id, account_id, category_id nullable, payee_id nullable, memo, amount_cents signed, date, cleared, transfer_account_id nullable, created_at, updated_at)

**Derived (computed, not stored):**
- Category balance(month) = balance(month-1) + assigned(month) + activity(month)
- To Be Budgeted = sum(inflows to on-budget accounts, all time) − sum(assigned, all time)
- Account balance = opening_balance + sum(transactions.amount_cents)

Balances are computed, not stored, to avoid drift bugs.

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
