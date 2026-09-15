# ByoBudget — Build Your Own Budget

> 🚧 Work in progress.

Free, privacy-first, YNAB-style budgeting for iOS. Envelope budgeting, common financial calculators, and optional AI analysis — no backend, no subscription.

See [`docs/DESIGN.md`](docs/DESIGN.md) for the design doc and [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for the implementation plan.

## Core
- YNAB-style envelope/zero-based budgeting
- Financial tools: mortgage / interest / payment calculators
- AI analysis (bring your own API key)

## Storage
- Local (SQLite): single source of truth
- iCloud: backup option
- S3: backup option

## Privacy
- S3: provisioned by user, grant app access
- AI: user's own API key, usage auditable in the provider's own dashboard

## Development
Expo (React Native, TypeScript).

```
npm install
npm start
```
Opens Expo Go — quick iteration, but native modules (sqlite, secure-store, sharing) run in Expo Go's own shell, not the real app.

### Real app on simulator (not Expo Go)
SDK 57 needs Swift tools 6.2 (Xcode 26+) to build locally; if your Xcode is older, build in the cloud instead:
```
npx eas-cli build --profile preview --platform ios --non-interactive
```
Then download the `.tar.gz` from the printed artifact URL, extract, and install:
```
tar -xzf app.tar.gz
xcrun simctl install booted BYOBudget.app
xcrun simctl launch booted com.solomonxie.buildyourownbudget
```

## Screenshots
| Budget | Insights | Account Trend | Mortgage |
|---|---|---|---|
| <img src="docs/screenshots/budget.png" alt="Budget screen" width="320"> | <img src="docs/screenshots/insights.png" alt="Insights screen" width="320"> | <img src="docs/screenshots/account-trend.png" alt="Account trend screen" width="320"> | <img src="docs/screenshots/mortgage.png" alt="Mortgage calculator screen" width="320"> |
