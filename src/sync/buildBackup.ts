import type { SQLiteDatabase } from '../db/driver';
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

// The log has no board column: a row's board is read out of its own
// before/after JSON, and an account's history through the account — current
// accounts, plus deleted ones the log still shows belonging here. Whole, not
// capped: it is small text, and the oldest entry may be the one you need.
const ownerId = (field: string) =>
  `COALESCE(json_extract(after, '$.${field}'), json_extract(before, '$.${field}'))`;
const ACCOUNT_OWNED_LIST = ACCOUNT_OWNED_TABLES.map((t) => `'${t}'`).join(', ');
const BOARD_CHANGE_LOG = `
  WITH board_accounts AS (
    SELECT id FROM accounts WHERE board_id = ?
    UNION
    SELECT row_id FROM change_log WHERE tbl = 'accounts' AND ${ownerId('board_id')} = ?
  )
  SELECT * FROM change_log
  WHERE CASE WHEN tbl IN (${ACCOUNT_OWNED_LIST})
    THEN ${ownerId('account_id')} IN (SELECT id FROM board_accounts)
    ELSE ${ownerId('board_id')} = ?
  END
  ORDER BY seq DESC`;

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
  const changeLog = await db.getAllAsync(BOARD_CHANGE_LOG, boardId, boardId, boardId);
  zip.file('change_log.json', JSON.stringify(changeLog, null, 2));
  zip.file('manifest.json', JSON.stringify({ boardId, boardName, exportedAt: new Date().toISOString() }, null, 2));

  return zip.generateAsync({ type: 'uint8array' });
}
