import type { SQLiteDatabase } from 'expo-sqlite';

// Groups can now be deleted (soft) from the Budget screen directly, same
// as categories already could — needed a place to mark that.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('ALTER TABLE category_groups ADD COLUMN archived_at TEXT;');
}
