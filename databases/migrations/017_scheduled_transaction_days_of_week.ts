import type { SQLiteDatabase } from 'expo-sqlite';

// Multi-weekday support for weekly schedules (e.g. "every Mon & Thu" as
// one schedule instead of two) — see domain/recurrence.ts. NULL keeps the
// pre-existing "whatever weekday the schedule's date already falls on"
// behavior for every schedule created before this column existed.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('ALTER TABLE scheduled_transactions ADD COLUMN days_of_week_mask INTEGER;');
}
