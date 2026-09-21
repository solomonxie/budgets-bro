import type { SQLiteDatabase } from '../../src/db/driver';

// Which registered plan a tracking account is. Nullable, and nothing reads
// it as a rule yet — it labels the account and gives the tax page something
// to group by later. A closed set on purpose: only plans whose rules the app
// can actually describe are offered, and "general" covers everything else
// rather than pretending.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`ALTER TABLE accounts ADD COLUMN tracking_kind TEXT;`);
}
