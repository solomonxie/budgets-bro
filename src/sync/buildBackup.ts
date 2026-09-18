import type { SQLiteDatabase } from 'expo-sqlite';
import JSZip from 'jszip';

// Raw table dumps (not the mapped camelCase domain types) — a lossless
// backup is more useful here than a "clean" export.
const TABLES = [
  'accounts',
  'category_groups',
  'categories',
  'budget_entries',
  'payees',
  'transactions',
  // Both board-scoped like the rest, and both left out for no reason other
  // than nobody adding them: every recurring transaction set up, and every
  // Baby Steps goal and its progress.
  'scheduled_transactions',
  'custom_goals',
] as const;

// Deliberately not backed up: app_settings holds cloud credentials and sync
// bookkeeping that belong to this install rather than to the board, and
// ai_requests holds prompts and responses that should not leave the device
// in a file the user might share. income_detail_history is dead (migration
// 028) and carries nothing anything reads.

// These hang off an account rather than a board, which is why they were
// missing from backups entirely: a house's value log, a loan's principal
// readings, a rate history. All of it typed in by hand and none of it
// recoverable from anywhere else, and a mortgage's whole balance is derived
// from the principal readings — losing them silently drops a loan back to
// the amount borrowed.
const ACCOUNT_OWNED_TABLES = ['account_value_history', 'account_rate_history'] as const;

// Capped: the log is for reading back what happened, not for restoring, and
// the newest entries are the ones anybody looks at.
const CHANGE_LOG_LIMIT = 5000;

async function dumpTable(db: SQLiteDatabase, table: (typeof TABLES)[number], boardId: number): Promise<unknown[]> {
  return db.getAllAsync(`SELECT * FROM ${table} WHERE board_id = ?`, boardId);
}

async function dumpAccountOwned(db: SQLiteDatabase, table: (typeof ACCOUNT_OWNED_TABLES)[number], boardId: number): Promise<unknown[]> {
  return db.getAllAsync(
    `SELECT h.* FROM ${table} h JOIN accounts a ON a.id = h.account_id WHERE a.board_id = ?`,
    boardId,
  );
}

// Builds the same zip shape export/exportBoard.ts (share-sheet export) and
// every sync/*Provider.ts (cloud backup) both need — pure bytes in, no I/O
// beyond reading the db, so both callers layer their own destination
// (share sheet vs. HTTP upload) on top without duplicating the table dump.
export async function buildBackupZip(db: SQLiteDatabase, boardId: number, boardName: string): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const table of TABLES) {
    const rows = await dumpTable(db, table, boardId);
    zip.file(`${table}.json`, JSON.stringify(rows, null, 2));
  }
  for (const table of ACCOUNT_OWNED_TABLES) {
    const rows = await dumpAccountOwned(db, table, boardId);
    zip.file(`${table}.json`, JSON.stringify(rows, null, 2));
  }
  // Carried off-device so the record of what changed outlives the phone,
  // but never restored — replaying a log into a database whose ids were
  // remapped on import would describe rows that aren't these ones.
  const changeLog = await db.getAllAsync(
    'SELECT * FROM change_log ORDER BY seq DESC LIMIT ?',
    CHANGE_LOG_LIMIT,
  );
  zip.file('change_log.json', JSON.stringify(changeLog, null, 2));
  zip.file('manifest.json', JSON.stringify({ boardId, boardName, exportedAt: new Date().toISOString() }, null, 2));

  return zip.generateAsync({ type: 'uint8array' });
}
