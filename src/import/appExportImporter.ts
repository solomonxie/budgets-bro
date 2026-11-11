import type { SQLiteDatabase } from '../db/driver';
import * as boardsRepo from '../db/repositories/boardsRepo';
import { resetSyncState } from '../db/repositories/syncStateRepo';
import { newGid } from '../db/gid';
import { budgetEntryGid } from '../../sync-core/entities';
import type { PickedAppExport } from './pickAppExport';

export interface AppExportImportResult {
  boardId: number;
  boardName: string;
  accountsImported: number;
  categoriesImported: number;
  transactionsImported: number;
}

// Restores this app's own export (export/exportBoard.ts) as a brand-new
// board, never merged into the current one — every table's id is remapped
// through per-table maps so nothing collides with IDs already used
// elsewhere in this install. `categories.linked_account_id` is dropped
// (legacy/unused column, see migration 008's comment).
// `keepName` is for bringing boards back after a reinstall, where there is
// nothing for "(Imported)" to tell them apart from.
//
// Sync identity (gid): kept from the zip unless any of it already exists
// here — restoring next to the original — in which case the whole board gets
// fresh ones, so two boards never share an identity. A zip from before gids
// gets fresh ones too. budget_entries' gid is always re-derived from its
// category. A restore that keeps identity resets sync state, so this install
// joins as a new device rather than claiming another's log.
export async function importAppExport(
  db: SQLiteDatabase,
  files: PickedAppExport,
  { keepName = false }: { keepName?: boolean } = {},
): Promise<AppExportImportResult> {
  const original = files.manifest?.boardName;
  const boardName = original ? (keepName ? original : `${original} (Imported)`) : 'Imported Board';
  let result: AppExportImportResult | null = null;

  await db.withTransactionAsync(async () => {
    const keep = !(await anyGidExists(db, files));
    const gid = (row: object): string => {
      const g = (row as { gid?: string | null }).gid;
      return keep && g ? g : newGid();
    };
    const categoryGids = new Map<number, string>();

    const boardId = await boardsRepo.createBoard(db, boardName);
    const boardGid = files.manifest?.boardGid;
    if (keep && boardGid) await db.runAsync('UPDATE boards SET gid = ? WHERE id = ?', boardGid, boardId);

    const groupIdMap = new Map<number, number>();
    for (const g of files.categoryGroups) {
      const result = await db.runAsync(
        'INSERT INTO category_groups (board_id, name, sort_order, archived_at, gid) VALUES (?, ?, ?, ?, ?)',
        boardId,
        g.name,
        g.sort_order,
        g.archived_at,
        gid(g),
      );
      groupIdMap.set(g.id, result.lastInsertRowId);
    }

    const categoryIdMap = new Map<number, number>();
    for (const c of files.categories) {
      const newGroupId = groupIdMap.get(c.group_id);
      if (newGroupId == null) continue;
      const categoryGid = gid(c);
      const result = await db.runAsync(
        'INSERT INTO categories (board_id, group_id, name, icon, sort_order, archived_at, gid) VALUES (?, ?, ?, ?, ?, ?, ?)',
        boardId,
        newGroupId,
        c.name,
        c.icon,
        c.sort_order,
        c.archived_at,
        categoryGid,
      );
      categoryIdMap.set(c.id, result.lastInsertRowId);
      categoryGids.set(c.id, categoryGid);
    }

    const accountIdMap = new Map<number, number>();
    for (const a of files.accounts) {
      const result = await db.runAsync(
        `INSERT INTO accounts (board_id, name, type, on_budget, currency, opening_balance_cents, archived_at, interest_rate_bps, term_months, original_principal_cents, origination_date, original_house_price_cents, gid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        boardId,
        a.name,
        a.type,
        a.on_budget,
        a.currency,
        a.opening_balance_cents,
        a.archived_at,
        a.interest_rate_bps,
        a.term_months,
        a.original_principal_cents,
        a.origination_date,
        a.original_house_price_cents,
        gid(a),
      );
      accountIdMap.set(a.id, result.lastInsertRowId);
    }

    const payeeIdMap = new Map<number, number>();
    for (const p of files.payees) {
      const newLinkedAccountId = p.linked_account_id != null ? (accountIdMap.get(p.linked_account_id) ?? null) : null;
      const result = await db.runAsync(
        'INSERT INTO payees (board_id, name, linked_account_id, review_on, review_note, review_mode, gid) VALUES (?, ?, ?, ?, ?, ?, ?)',
        boardId,
        p.name,
        newLinkedAccountId,
        p.review_on ?? null,
        p.review_note ?? null,
        p.review_mode ?? null,
        gid(p),
      );
      payeeIdMap.set(p.id, result.lastInsertRowId);
    }

    for (const be of files.budgetEntries) {
      const newCategoryId = categoryIdMap.get(be.category_id);
      if (newCategoryId == null) continue;
      await db.runAsync(
        'INSERT INTO budget_entries (board_id, category_id, month, assigned_cents, gid) VALUES (?, ?, ?, ?, ?)',
        boardId,
        newCategoryId,
        be.month,
        be.assigned_cents,
        budgetEntryGid(categoryGids.get(be.category_id)!, be.month),
      );
    }

    let transactionsImported = 0;
    for (const t of files.transactions) {
      const newAccountId = accountIdMap.get(t.account_id);
      if (newAccountId == null) continue;
      const newCategoryId = t.category_id != null ? (categoryIdMap.get(t.category_id) ?? null) : null;
      const newPayeeId = t.payee_id != null ? (payeeIdMap.get(t.payee_id) ?? null) : null;
      const newTransferAccountId = t.transfer_account_id != null ? (accountIdMap.get(t.transfer_account_id) ?? null) : null;
      await db.runAsync(
        `INSERT INTO transactions (board_id, account_id, category_id, payee_id, memo, amount_cents, date, transfer_account_id, import_id, purchase_items, created_at, updated_at, gid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        boardId,
        newAccountId,
        newCategoryId,
        newPayeeId,
        t.memo,
        t.amount_cents,
        t.date,
        newTransferAccountId,
        t.import_id,
        t.purchase_items ?? null,
        t.created_at,
        t.updated_at,
        gid(t),
      );
      transactionsImported++;
    }

    // Rebuilt against the new account ids, like everything else here. A
    // mortgage's balance is derived from its principal readings, so a
    // restore that dropped these would put the loan back at the amount
    // borrowed and quietly lose every house value ever typed in.
    for (const v of files.accountValueHistory) {
      const newAccountId = accountIdMap.get(v.account_id);
      if (newAccountId == null) continue;
      await db.runAsync(
        'INSERT INTO account_value_history (account_id, value_cents, effective_date, kind, note, gid) VALUES (?, ?, ?, ?, ?, ?)',
        newAccountId,
        v.value_cents,
        v.effective_date,
        v.kind ?? 'value',
        v.note ?? null,
        gid(v),
      );
    }
    for (const r of files.accountRateHistory) {
      const newAccountId = accountIdMap.get(r.account_id);
      if (newAccountId == null) continue;
      await db.runAsync(
        'INSERT INTO account_rate_history (account_id, rate_bps, effective_date, note, gid) VALUES (?, ?, ?, ?, ?)',
        newAccountId,
        r.rate_bps,
        r.effective_date,
        r.note ?? null,
        gid(r),
      );
    }

    const scheduleIdMap = new Map<number, number>();
    for (const st of files.scheduledTransactions) {
      const newAccountId = accountIdMap.get(st.account_id);
      if (newAccountId == null) continue;
      const inserted = await db.runAsync(
        `INSERT INTO scheduled_transactions
           (board_id, account_id, category_id, payee_id, memo, amount_cents, frequency, interval_n, next_date, end_date, days_of_week_mask, review_on, review_note, review_ignored, gid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        boardId,
        newAccountId,
        st.category_id != null ? (categoryIdMap.get(st.category_id) ?? null) : null,
        st.payee_id != null ? (payeeIdMap.get(st.payee_id) ?? null) : null,
        st.memo,
        st.amount_cents,
        st.frequency,
        st.interval_n,
        st.next_date,
        st.end_date,
        st.days_of_week_mask ?? null,
        st.review_on ?? null,
        st.review_note ?? null,
        st.review_ignored ?? 0,
        gid(st),
      );
      scheduleIdMap.set(st.id, inserted.lastInsertRowId);
    }
    for (const d of files.paymentDecisions) {
      await db.runAsync(
        `INSERT INTO payment_decisions
           (board_id, scheduled_transaction_id, payee_id, name, cadence, amount_cents, decision, note, decided_on, due_on, done_on, gid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        boardId,
        d.scheduled_transaction_id != null ? (scheduleIdMap.get(d.scheduled_transaction_id) ?? null) : null,
        d.payee_id != null ? (payeeIdMap.get(d.payee_id) ?? null) : null,
        d.name,
        d.cadence,
        d.amount_cents,
        d.decision,
        d.note,
        d.decided_on,
        d.due_on,
        d.done_on,
        gid(d),
      );
    }
    for (const g of files.customGoals) {
      await db.runAsync(
        'INSERT INTO custom_goals (board_id, name, target_cents, linked_account_id, manual_progress_cents, sort_order, gid) VALUES (?, ?, ?, ?, ?, ?, ?)',
        boardId,
        g.name,
        g.target_cents,
        g.linked_account_id != null ? (accountIdMap.get(g.linked_account_id) ?? null) : null,
        g.manual_progress_cents,
        g.sort_order,
        gid(g),
      );
    }

    if (keep) await resetSyncState(db);

    result = {
      boardId,
      boardName,
      accountsImported: accountIdMap.size,
      categoriesImported: categoryIdMap.size,
      transactionsImported,
    };
  });

  return result!;
}

const GID_TABLES: [string, keyof PickedAppExport][] = [
  ['category_groups', 'categoryGroups'],
  ['categories', 'categories'],
  ['accounts', 'accounts'],
  ['payees', 'payees'],
  ['transactions', 'transactions'],
  ['account_value_history', 'accountValueHistory'],
  ['account_rate_history', 'accountRateHistory'],
  ['scheduled_transactions', 'scheduledTransactions'],
  ['payment_decisions', 'paymentDecisions'],
  ['custom_goals', 'customGoals'],
];

async function anyGidExists(db: SQLiteDatabase, files: PickedAppExport): Promise<boolean> {
  const checks: [string, (string | null | undefined)[]][] = GID_TABLES.map(([table, key]) => [
    table,
    (files[key] as { gid?: string | null }[]).map((r) => r.gid),
  ]);
  checks.push(['boards', [files.manifest?.boardGid]]);
  for (const [table, gids] of checks) {
    const present = gids.filter((g): g is string => !!g);
    if (present.length === 0) continue;
    const hit = await db.getFirstAsync(
      `SELECT 1 FROM ${table} WHERE gid IN (SELECT value FROM json_each(?)) LIMIT 1`,
      JSON.stringify(present),
    );
    if (hit) return true;
  }
  return false;
}
