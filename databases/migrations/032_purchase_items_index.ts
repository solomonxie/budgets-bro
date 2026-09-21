import type { SQLiteDatabase } from '../../src/db/driver';

// Partial index for the two screens that ask "what has this board bought?"
// (the spend form's item suggestions, the Purchase Insights page). Most rows
// name no items at all, so indexing only the ones that do keeps it small and
// turns a whole-board scan into a lookup of exactly the rows being read.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_transactions_purchase_items
    ON transactions(board_id, date DESC)
    WHERE purchase_items IS NOT NULL;
  `);
}
