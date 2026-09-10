import type { SQLiteDatabase } from 'expo-sqlite';

// Loan/mortgage terms (nullable — only set for loan-like accounts) so the
// account page can show a real amortization projection, not just a balance.
// `app_settings` is a small generic key/value store for cross-screen state
// that doesn't need its own table (e.g. Baby Steps progress).
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE accounts ADD COLUMN interest_rate_bps INTEGER;
    ALTER TABLE accounts ADD COLUMN term_months INTEGER;
    ALTER TABLE accounts ADD COLUMN original_principal_cents INTEGER;
    ALTER TABLE accounts ADD COLUMN origination_date TEXT;

    CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
