import type { SQLiteDatabase } from '../../src/db/driver';
import { up as backfillGids } from './046_sync_gid';

// A build shipped 046 before the repos set gid on insert, so rows added on
// that build have none. 046 only fills NULLs, so running it again is the fix.
export async function up(db: SQLiteDatabase): Promise<void> {
  await backfillGids(db);
}
