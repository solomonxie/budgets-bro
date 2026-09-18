import type { SQLiteDatabase } from '../db/driver';
import * as boardsRepo from '../db/repositories/boardsRepo';
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
export async function importAppExport(db: SQLiteDatabase, files: PickedAppExport): Promise<AppExportImportResult> {
  const boardName = files.manifest?.boardName ? `${files.manifest.boardName} (Imported)` : 'Imported Board';
  let result: AppExportImportResult | null = null;

  await db.withTransactionAsync(async () => {
    const boardId = await boardsRepo.createBoard(db, boardName);

    const groupIdMap = new Map<number, number>();
    for (const g of files.categoryGroups) {
      const result = await db.runAsync(
        'INSERT INTO category_groups (board_id, name, sort_order, archived_at) VALUES (?, ?, ?, ?)',
        boardId,
        g.name,
        g.sort_order,
        g.archived_at,
      );
      groupIdMap.set(g.id, result.lastInsertRowId);
    }

    const categoryIdMap = new Map<number, number>();
    for (const c of files.categories) {
      const newGroupId = groupIdMap.get(c.group_id);
      if (newGroupId == null) continue;
      const result = await db.runAsync(
        'INSERT INTO categories (board_id, group_id, name, icon, sort_order, archived_at) VALUES (?, ?, ?, ?, ?, ?)',
        boardId,
        newGroupId,
        c.name,
        c.icon,
        c.sort_order,
        c.archived_at,
      );
      categoryIdMap.set(c.id, result.lastInsertRowId);
    }

    const accountIdMap = new Map<number, number>();
    for (const a of files.accounts) {
      const result = await db.runAsync(
        `INSERT INTO accounts (board_id, name, type, on_budget, currency, opening_balance_cents, archived_at, interest_rate_bps, term_months, original_principal_cents, origination_date, original_house_price_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      );
      accountIdMap.set(a.id, result.lastInsertRowId);
    }

    const payeeIdMap = new Map<number, number>();
    for (const p of files.payees) {
      const newLinkedAccountId = p.linked_account_id != null ? (accountIdMap.get(p.linked_account_id) ?? null) : null;
      const result = await db.runAsync(
        'INSERT INTO payees (board_id, name, linked_account_id) VALUES (?, ?, ?)',
        boardId,
        p.name,
        newLinkedAccountId,
      );
      payeeIdMap.set(p.id, result.lastInsertRowId);
    }

    for (const be of files.budgetEntries) {
      const newCategoryId = categoryIdMap.get(be.category_id);
      if (newCategoryId == null) continue;
      await db.runAsync(
        'INSERT INTO budget_entries (board_id, category_id, month, assigned_cents) VALUES (?, ?, ?, ?)',
        boardId,
        newCategoryId,
        be.month,
        be.assigned_cents,
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
        `INSERT INTO transactions (board_id, account_id, category_id, payee_id, memo, amount_cents, date, transfer_account_id, import_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        boardId,
        newAccountId,
        newCategoryId,
        newPayeeId,
        t.memo,
        t.amount_cents,
        t.date,
        newTransferAccountId,
        t.import_id,
        t.created_at,
        t.updated_at,
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
        'INSERT INTO account_value_history (account_id, value_cents, effective_date, kind, note) VALUES (?, ?, ?, ?, ?)',
        newAccountId,
        v.value_cents,
        v.effective_date,
        v.kind ?? 'value',
        v.note ?? null,
      );
    }
    for (const r of files.accountRateHistory) {
      const newAccountId = accountIdMap.get(r.account_id);
      if (newAccountId == null) continue;
      await db.runAsync(
        'INSERT INTO account_rate_history (account_id, rate_bps, effective_date, note) VALUES (?, ?, ?, ?)',
        newAccountId,
        r.rate_bps,
        r.effective_date,
        r.note ?? null,
      );
    }

    for (const st of files.scheduledTransactions) {
      const newAccountId = accountIdMap.get(st.account_id);
      if (newAccountId == null) continue;
      await db.runAsync(
        `INSERT INTO scheduled_transactions
           (board_id, account_id, category_id, payee_id, memo, amount_cents, frequency, interval_n, next_date, end_date, days_of_week_mask)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      );
    }
    for (const g of files.customGoals) {
      await db.runAsync(
        'INSERT INTO custom_goals (board_id, name, target_cents, linked_account_id, manual_progress_cents, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        boardId,
        g.name,
        g.target_cents,
        g.linked_account_id != null ? (accountIdMap.get(g.linked_account_id) ?? null) : null,
        g.manual_progress_cents,
        g.sort_order,
      );
    }

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
