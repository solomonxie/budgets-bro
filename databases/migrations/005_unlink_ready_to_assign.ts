import type { SQLiteDatabase } from 'expo-sqlite';

// The YNAB importer used to create a real category for "Ready to Assign"
// rows (YNAB's reserved category for uncategorized inflow) instead of
// leaving them uncategorized — so that money never counted toward
// Unassigned Cash, only toward whatever category it happened to land in.
// Reclassifies already-imported transactions back to uncategorized and
// archives the now-empty category/group.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    UPDATE transactions
    SET category_id = NULL
    WHERE category_id IN (
      SELECT id FROM categories WHERE LOWER(TRIM(name)) IN ('ready to assign', 'inflow: ready to assign')
    );

    UPDATE categories
    SET archived_at = COALESCE(archived_at, datetime('now'))
    WHERE LOWER(TRIM(name)) IN ('ready to assign', 'inflow: ready to assign');

    UPDATE category_groups
    SET archived_at = COALESCE(archived_at, datetime('now'))
    WHERE id IN (
      SELECT group_id FROM categories WHERE LOWER(TRIM(name)) IN ('ready to assign', 'inflow: ready to assign')
    )
    AND id NOT IN (
      SELECT group_id FROM categories WHERE archived_at IS NULL
    );
  `);
}
