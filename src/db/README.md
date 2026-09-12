# Database Layer

SQLite is the app's only datastore — no backend.

- `client.ts` — opens the on-device database, runs pending migrations on startup
- `migrate.ts` — versioned migration runner (see `../../databases/migrations`)
- `schema.ts` — TypeScript types for raw table rows
- `repositories/` — the sole read/write path for every table, one file per table/domain concept
- `seed/` — generates the demo board's sample data
