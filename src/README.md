# App Source

TypeScript/React Native source for YAMA:

- `screens/` — one folder per tab/feature area
- `components/` — shared UI building blocks
- `domain/` — pure business logic (money math, budget math, shared types)
- `db/` — SQLite client, migrations glue, per-table repositories
- `hooks/` — React hooks bridging screens to `db/repositories`
- `state/` — global app state (Zustand store)
- `navigation/` — React Navigation stack/tab definitions
- `import/` — YNAB CSV and app-backup import
- `export/` — share-sheet board export
- `sync/` — cloud/local backup providers (S3, on-device)
- `secure/` — secure-storage wrapper for API keys/credentials
- `finance-tools/` — standalone calculators (amortization, etc.)
- `i18n/` — English/Chinese translations
- `theme/` — colors and spacing constants
