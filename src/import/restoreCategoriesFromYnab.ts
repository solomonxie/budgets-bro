import type { SQLiteDatabase } from 'expo-sqlite';
import { parseCsv, parseYnabDate } from './csv';
import { makeOccurrenceCounter, ynabImportId } from './ynabImportId';
import * as categoriesRepo from '../db/repositories/categoriesRepo';

export interface CategoryRestoreResult {
  restored: number; // rows that gained a category back
  alreadySet: number; // rows that still had one — left alone
  notFound: number; // rows in the file with no matching transaction here
  categoryMissing: number; // matched, but the category no longer exists
}

const TRANSFER_PREFIX = 'Transfer : ';
const READY_TO_ASSIGN_NAMES = new Set(['ready to assign', 'inflow: ready to assign']);

// Repairs categories that migration 029 cleared, from the YNAB export they
// originally came from. Deliberately NOT the importer: re-running that
// upserts, which would resurrect transactions since deleted, reopen work
// done on accounts, and overwrite payees, memos and amounts edited since.
//
// This only ever runs one statement — set category_id on a row that has
// none — matched on the same import_id the importer builds, so a row the
// file doesn't know about is left exactly as it is. It creates nothing: no
// accounts, no categories, no transactions. A category that no longer
// exists is reported rather than recreated, since deleting it may well have
// been deliberate too.
export async function restoreCategoriesFromYnab(
  db: SQLiteDatabase,
  boardId: number,
  registerCsv: string,
): Promise<CategoryRestoreResult> {
  const rows = parseCsv(registerCsv);
  const result: CategoryRestoreResult = { restored: 0, alreadySet: 0, notFound: 0, categoryMissing: 0 };

  const categories = await categoriesRepo.listCategories(db, boardId);
  const groups = await categoriesRepo.listCategoryGroups(db, boardId);
  const groupNameById = new Map(groups.map((g) => [g.id, g.name.trim().toLowerCase()]));
  const categoryIdByKey = new Map(
    categories.map((c) => [`${groupNameById.get(c.groupId) ?? ''}|${c.name.trim().toLowerCase()}`, c.id]),
  );

  // Same key and counter the importer writes with (ynabImportId), walked in
  // the same order, so the ids line up with what it wrote.
  const nextOccurrence = makeOccurrenceCounter();

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const accountName = row['Account'];
      if (!accountName) continue;
      const payeeName = (row['Payee'] ?? '').trim();
      const date = parseYnabDate(row['Date']);
      const occurrence = nextOccurrence(accountName, date, payeeName);

      const categoryName = (row['Category'] ?? '').trim();
      const groupName = (row['Category Group'] ?? '').trim();
      // Nothing to restore: a transfer with no category, or YNAB's reserved
      // inflow pseudo-category, which was never a real category here.
      if (!categoryName || !groupName) continue;
      if (READY_TO_ASSIGN_NAMES.has(categoryName.toLowerCase())) continue;
      if (payeeName.startsWith(TRANSFER_PREFIX) && !categoryName) continue;

      const importId = ynabImportId(accountName, date, payeeName, occurrence);
      const existing = await db.getFirstAsync<{ id: number; category_id: number | null }>(
        'SELECT id, category_id FROM transactions WHERE import_id = ? AND board_id = ?',
        importId,
        boardId,
      );
      if (!existing) {
        result.notFound++;
        continue;
      }
      if (existing.category_id != null) {
        result.alreadySet++;
        continue;
      }

      const categoryId = categoryIdByKey.get(`${groupName.toLowerCase()}|${categoryName.toLowerCase()}`);
      if (categoryId == null) {
        result.categoryMissing++;
        continue;
      }

      await db.runAsync(
        "UPDATE transactions SET category_id = ?, updated_at = datetime('now') WHERE id = ?",
        categoryId,
        existing.id,
      );
      result.restored++;
    }
  });

  return result;
}
