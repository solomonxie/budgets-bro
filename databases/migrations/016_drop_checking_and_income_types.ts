import type { SQLiteDatabase } from 'expo-sqlite';

// 'checking' and 'income' account types are gone — checking was
// indistinguishable from 'cash' (same Kind, no separate behavior) and
// 'income' had no behavior beyond being its own list section. Fold any
// existing rows into 'cash' rather than leaving orphaned type values.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`UPDATE accounts SET type = 'cash' WHERE type IN ('checking', 'income');`);
}
