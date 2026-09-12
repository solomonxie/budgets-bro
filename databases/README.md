# Databases

SQL lives here, not scattered in `src/`.

- `migrations/` — schema changes, applied in order via `src/db/migrate.ts`
- `queries/` — non-trivial SQL used by `src/db/repositories/*.ts` (simple one-liners stay inline in the repo file)
- `data.db` (if present) — scratch SQLite file for local verification, not the app's runtime database (that's on-device, managed by `expo-sqlite`)
