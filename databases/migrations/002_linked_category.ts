import type { SQLiteDatabase } from 'expo-sqlite';

// Ties a category 1:1 to a loan/mortgage account — its auto-generated
// "Payment: <account>" category (see accountsRepo's payment-category
// lifecycle). Lets a mortgage payment be budgeted like any other category
// while also crediting the loan account's balance.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE categories ADD COLUMN linked_account_id INTEGER REFERENCES accounts(id);
    CREATE INDEX idx_categories_linked_account ON categories(linked_account_id);
  `);
}
