import type { SQLiteDatabase } from '../../src/db/driver';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('ALTER TABLE accounts ADD COLUMN loan_payment_category_id INTEGER REFERENCES categories(id);');
}
