import type { SQLiteDatabase } from 'expo-sqlite';

// A category means "this money was spent out of that envelope", which only
// holds for cash and credit cards, and only when the money actually left
// (see domain/accountKind.transactionTakesCategory). Rows that predate that
// rule still carry one, and it is not merely cosmetic: a category on an
// on-budget account counts toward budget activity whether or not any list
// shows it, so a savings withdrawal categorised as Groceries is counted
// there and again when that cash is really spent.
//
// Cleared here rather than hidden. Two groups:
//   - every row on an account that doesn't spend (savings, tracking, asset,
//     loan, mortgage);
//   - transfer legs anywhere, including on cash and credit cards.
//
// Only category_id is touched; nothing is deleted and no amount moves. Past
// months' "spent" figures do change — that is the double-counting coming
// back out.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    UPDATE transactions SET category_id = NULL
    WHERE category_id IS NOT NULL
      AND (
        account_id IN (SELECT id FROM accounts WHERE type NOT IN ('cash', 'credit_card'))
        OR transfer_account_id IS NOT NULL
      );
  `);
}
