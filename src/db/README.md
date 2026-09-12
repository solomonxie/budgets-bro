# Database Layer

SQLite is the app's only datastore — no backend. `client.ts` opens the on-device database and runs pending migrations (see `../../databases/migrations`) on startup; `repositories/` is the sole read/write path for every table, one file per table/domain concept; `schema.ts` types the raw rows.
