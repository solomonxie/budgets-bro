import type { SQLiteDatabase } from '../../db/driver';
import { slugifyBoardName } from '../../sync/backupPath';
import { DELETE_BOARD_CASCADE } from '../../../databases/queries/boards';

// Remove all app data, the database half. One transaction: a failure leaves
// every row where it was, never half a wipe.
export async function wipeAppData(
  db: SQLiteDatabase,
  { freshBoardName, keepSettings }: { freshBoardName: string; keepSettings: string[] },
): Promise<number> {
  let freshBoardId = 0;
  await db.withTransactionAsync(async () => {
    const boards = await db.getAllAsync<{ id: number }>('SELECT id FROM boards');
    for (const { id } of boards) for (const sql of DELETE_BOARD_CASCADE) await db.runAsync(sql, id);
    await db.runAsync('DELETE FROM houses');
    await db.runAsync('DELETE FROM community_prices');
    await db.runAsync('DELETE FROM ai_requests');
    const placeholders = keepSettings.map(() => '?').join(', ') || "''";
    await db.runAsync(`DELETE FROM app_settings WHERE key NOT IN (${placeholders})`, ...keepSettings);
    freshBoardId = (await db.runAsync('INSERT INTO boards (name) VALUES (?)', freshBoardName)).lastInsertRowId;
    // Last: the triggers above logged every delete.
    await db.runAsync('DELETE FROM change_log');
  });
  // Deleted rows otherwise linger in free pages and the WAL, readable from
  // the file (and from the phone's own device backup).
  await db.execAsync('VACUUM');
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE)');
  return freshBoardId;
}

// Cloud backups are keyed by board slug and pruned per slug, so a fresh
// board sharing a wiped board's slug would overwrite and then prune that
// board's history. The date keeps one wipe's board apart from the next.
export function freshBoardName(base: string, dateIso: string, wipedNames: string[]): string {
  const taken = new Set(wipedNames.map(slugifyBoardName));
  const dated = `${base} ${dateIso}`;
  let name = dated;
  for (let n = 2; taken.has(slugifyBoardName(name)); n++) name = `${dated} (${n})`;
  return name;
}
