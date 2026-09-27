import type { SQLiteDatabase } from '../../src/db/driver';

// Only cash is assigned to categories now (see
// domain/accountKind.holdsAssignableCash), so a category on a savings row
// would count as budget activity with no assigned cash behind it. Same
// clearing as 029; only category_id changes.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    UPDATE transactions SET category_id = NULL
    WHERE category_id IS NOT NULL
      AND account_id IN (SELECT id FROM accounts WHERE type = 'savings');
  `);
}
