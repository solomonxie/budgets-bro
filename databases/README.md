# Databases

SQL lives here, not scattered in `src/`. `migrations/` are schema changes applied in order via `src/db/migrate.ts`. `queries/` holds the non-trivial SQL used by `src/db/repositories/*.ts` (one-liners stay inline in the repo file). `data.db`, if present, is a scratch SQLite file for local verification — not the app's runtime database (that's on-device, managed by `expo-sqlite`).
