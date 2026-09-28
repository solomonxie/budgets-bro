import type { SQLiteDatabase } from '../../src/db/driver';

// QBR no longer tracks hand-added ad hoc payees. Their review state is
// cleared, so they're detected like any other payee.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("UPDATE payees SET review_mode = NULL, review_on = NULL, review_note = NULL WHERE review_mode = 'adHoc';");
}
