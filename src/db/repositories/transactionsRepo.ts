import type { SQLiteDatabase } from '../../db/driver';
import type { TransactionJoinRow } from '../schema';
import type { AccountType, TransactionWithLabels } from '../../domain/types';
import { currentDateISO } from '../../domain/month';
import { findOrCreatePayee, getPayee, pruneUnusedPayees } from './payeesRepo';
import {
  SELECT_WITH_LABELS,
  INSERT_TRANSACTION,
  UPDATE_TRANSACTION,
  LAST_CATEGORY_FOR_PAYEE,
} from '../../../databases/queries/transactions';

function mapRow(row: TransactionJoinRow): TransactionWithLabels {
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    payeeId: row.payee_id,
    memo: row.memo,
    amountCents: row.amount_cents,
    date: row.date,
    transferAccountId: row.transfer_account_id,
    importId: row.import_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payeeName: row.payee_name,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    accountName: row.account_name,
    accountType: row.account_type as AccountType,
  };
}

// Excludes scheduled/future transactions (date > today) — those are
// deliberately not "real" yet, see listFutureTransactionsForAccount.
export async function listTransactionsForAccount(
  db: SQLiteDatabase,
  boardId: number,
  accountId: number,
): Promise<TransactionWithLabels[]> {
  const rows = await db.getAllAsync<TransactionJoinRow>(
    `${SELECT_WITH_LABELS} WHERE t.account_id = ? AND t.board_id = ? AND t.date <= ? ORDER BY t.date DESC, t.id DESC`,
    accountId,
    boardId,
    currentDateISO(),
  );
  return rows.map(mapRow);
}

// Powers the account page's expandable "Scheduled" box — the mirror image
// of listTransactionsForAccount's date filter. Ascending (soonest first),
// unlike every other list here, since "what's coming up next" reads better
// than "most recently scheduled first" for a forward-looking list.
export async function listFutureTransactionsForAccount(
  db: SQLiteDatabase,
  boardId: number,
  accountId: number,
): Promise<TransactionWithLabels[]> {
  const rows = await db.getAllAsync<TransactionJoinRow>(
    `${SELECT_WITH_LABELS} WHERE t.account_id = ? AND t.board_id = ? AND t.date > ? ORDER BY t.date ASC, t.id ASC`,
    accountId,
    boardId,
    currentDateISO(),
  );
  return rows.map(mapRow);
}

// Excludes scheduled/future transactions (date > today) — see
// listTransactionsForAccount.
export async function listTransactions(
  db: SQLiteDatabase,
  boardId: number,
): Promise<TransactionWithLabels[]> {
  const rows = await db.getAllAsync<TransactionJoinRow>(
    `${SELECT_WITH_LABELS} WHERE t.board_id = ? AND t.date <= ? ORDER BY t.date DESC, t.id DESC`,
    boardId,
    currentDateISO(),
  );
  return rows.map(mapRow);
}

export async function getTransaction(
  db: SQLiteDatabase,
  id: number,
): Promise<TransactionWithLabels | null> {
  const row = await db.getFirstAsync<TransactionJoinRow>(
    `${SELECT_WITH_LABELS} WHERE t.id = ?`,
    id,
  );
  return row ? mapRow(row) : null;
}

export async function getLastCategoryIdForPayee(
  db: SQLiteDatabase,
  payeeId: number,
): Promise<number | null> {
  const row = await db.getFirstAsync<{ category_id: number | null }>(
    LAST_CATEGORY_FOR_PAYEE,
    payeeId,
  );
  return row?.category_id ?? null;
}

export interface CreateTransactionInput {
  accountId: number;
  categoryId: number | null;
  payeeName: string;
  memo: string | null;
  amountCents: number; // signed
  date: string;
  // Tags this as belonging to an Income-typed account's earnings — see
  // migration 021. Undefined/null for anything that isn't income.
}

// If `payeeId` is an account's auto-generated payee (see
// payeesRepo.ensureAccountPayee), also posts the mirrored credit to that
// account so its balance moves accordingly — this is what makes selecting
// another account's payee act as a transfer, regardless of whatever
// category the original transaction used, since the linkage is by payee,
// not category.
// The two rows of a transfer each name the account across from them: the
// payer's row names where the money went, the mirror names where it came
// from. Carrying the same payee onto the mirror (which is what this used to
// do) labelled the receiving row with its own account name.
async function postLinkedAccountLeg(
  db: SQLiteDatabase,
  boardId: number,
  originId: number,
  input: {
    accountId: number;
    payeeId: number | null;
    memo: string | null;
    amountCents: number;
    date: string;
  },
): Promise<void> {
  if (input.payeeId == null) return;
  const payee = await getPayee(db, input.payeeId);
  if (!payee?.linkedAccountId || payee.linkedAccountId === input.accountId)
    return;
  await db.runAsync(
    INSERT_TRANSACTION,
    boardId,
    payee.linkedAccountId,
    null,
    await getLinkedPayeeId(db, input.accountId),
    input.memo,
    -input.amountCents,
    input.date,
    input.accountId,
    null,
    null,
  );
  // Both legs carry the mark, not just the mirror. Marking one side only
  // made the pair unverifiable from the originating row — nothing could tell
  // "this is half of a transfer" from "this is a spend at a payee that
  // happens to be named after an account" (see domain/transferIntegrity).
  await db.runAsync(
    'UPDATE transactions SET transfer_account_id = ? WHERE id = ?',
    payee.linkedAccountId,
    originId,
  );
}

// The row on the other account that this one is half of a pair with. Strict
// first — both legs marked, which is what everything written from here on
// looks like — then the legacy shape, where only the mirror was marked and
// the originating row is identified by its payee naming that account.
async function findPartnerId(
  db: SQLiteDatabase,
  row: TransactionWithLabels,
): Promise<number | null> {
  const counterpart = row.transferAccountId;
  if (counterpart == null) return null;
  const strict = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM transactions
     WHERE account_id = ? AND transfer_account_id = ? AND amount_cents = ? AND date = ? AND id <> ?
     LIMIT 1`,
    counterpart,
    row.accountId,
    -row.amountCents,
    row.date,
    row.id,
  );
  if (strict) return strict.id;
  const loose = await db.getFirstAsync<{ id: number }>(
    `SELECT t.id FROM transactions t
     JOIN payees p ON p.id = t.payee_id
     WHERE t.account_id = ? AND p.linked_account_id = ? AND t.amount_cents = ? AND t.date = ? AND t.id <> ?
     LIMIT 1`,
    counterpart,
    row.accountId,
    -row.amountCents,
    row.date,
    row.id,
  );
  return loose?.id ?? null;
}

export async function createTransaction(
  db: SQLiteDatabase,
  boardId: number,
  input: CreateTransactionInput,
): Promise<number> {
  const payeeId = input.payeeName
    ? await findOrCreatePayee(db, boardId, input.payeeName)
    : null;
  let insertedId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      INSERT_TRANSACTION,
      boardId,
      input.accountId,
      input.categoryId,
      payeeId,
      input.memo,
      input.amountCents,
      input.date,
      null,
      null,
    );
    insertedId = result.lastInsertRowId;
    await postLinkedAccountLeg(db, boardId, insertedId, { ...input, payeeId });
  });
  return insertedId;
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: number;
}

// Scope cut: editing a transaction doesn't re-derive/rebalance a linked
// loan-account leg created at insert time — deleting and re-entering it
// keeps the loan balance correct if the category changes.
export async function updateTransaction(
  db: SQLiteDatabase,
  boardId: number,
  input: UpdateTransactionInput,
): Promise<void> {
  const before = await getTransaction(db, input.id);
  const partnerId = before ? await findPartnerId(db, before) : null;
  const payeeId = input.payeeName
    ? await findOrCreatePayee(db, boardId, input.payeeName)
    : null;
  await db.runAsync(
    UPDATE_TRANSACTION,
    input.accountId,
    input.categoryId,
    payeeId,
    input.memo,
    input.amountCents,
    input.date,
    input.id,
  );
  await syncPartnerLeg(db, boardId, { ...input, payeeId }, partnerId);
  await pruneUnusedPayees(db, boardId);
}

// Keeps the other half of a transfer in step with an edit to this one, so a
// pair can never drift apart: change the amount and the partner is negated
// to match, point the payee somewhere that isn't an account and the partner
// goes away, point it at an account and one appears. This used to be a
// documented scope cut ("delete and re-enter it"), which is how a ledger
// ends up with legs that don't cancel.
async function syncPartnerLeg(
  db: SQLiteDatabase,
  boardId: number,
  input: {
    id: number;
    accountId: number;
    payeeId: number | null;
    memo: string | null;
    amountCents: number;
    date: string;
  },
  partnerId: number | null,
): Promise<void> {
  const payee =
    input.payeeId != null ? await getPayee(db, input.payeeId) : null;
  const counterpart =
    payee?.linkedAccountId != null && payee.linkedAccountId !== input.accountId
      ? payee.linkedAccountId
      : null;

  if (counterpart == null) {
    if (partnerId != null)
      await db.runAsync('DELETE FROM transactions WHERE id = ?', partnerId);
    await db.runAsync(
      'UPDATE transactions SET transfer_account_id = NULL WHERE id = ?',
      input.id,
    );
    return;
  }

  if (partnerId != null) {
    const partner = await getTransaction(db, partnerId);
    if (partner?.accountId === counterpart) {
      await db.runAsync(
        `UPDATE transactions SET amount_cents = ?, date = ?, memo = ?, transfer_account_id = ?, updated_at = datetime('now')
         WHERE id = ?`,
        -input.amountCents,
        input.date,
        input.memo,
        input.accountId,
        partnerId,
      );
      await db.runAsync(
        'UPDATE transactions SET transfer_account_id = ? WHERE id = ?',
        counterpart,
        input.id,
      );
      return;
    }
    // The transfer now points at a different account than it used to.
    await db.runAsync('DELETE FROM transactions WHERE id = ?', partnerId);
  }
  await postLinkedAccountLeg(db, boardId, input.id, input);
}

// Takes both halves of a transfer with it. Deleting one leg on its own
// leaves the other saying money arrived from an account that never sent it —
// the pair is one event, so it deletes as one.
export async function deleteTransactions(
  db: SQLiteDatabase,
  boardId: number,
  ids: number[],
): Promise<void> {
  if (ids.length === 0) return;
  const withPartners = new Set(ids);
  for (const id of ids) {
    const row = await getTransaction(db, id);
    if (!row) continue;
    const partnerId = await findPartnerId(db, row);
    if (partnerId != null) withPartners.add(partnerId);
  }
  const all = [...withPartners];
  const placeholders = all.map(() => '?').join(',');
  await db.runAsync(
    `DELETE FROM transactions WHERE id IN (${placeholders})`,
    ...all,
  );
  await pruneUnusedPayees(db, boardId);
}

export interface CreateTransferInput {
  fromAccountId: number;
  toAccountId: number;
  // Signed: positive moves money from fromAccountId to toAccountId as
  // normal; negative reverses direction (toAccountId loses, fromAccountId
  // gains) — lets a caller mirror whatever sign it already has (e.g. a
  // negative income correction) without re-deriving direction itself.
  amountCents: number;
  date: string;
  memo: string | null;
}

// Each leg names the account on the other side, via the payee every account
// owns (payeesRepo.ensureAccountPayee). Both legs used to post with no payee
// at all, which read as "(No payee)" in every list — see migration 026, which
// backfills the ones already posted.
export async function createTransfer(
  db: SQLiteDatabase,
  boardId: number,
  input: CreateTransferInput,
): Promise<void> {
  const [fromPayee, toPayee] = await Promise.all([
    getLinkedPayeeId(db, input.fromAccountId),
    getLinkedPayeeId(db, input.toAccountId),
  ]);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO transactions (board_id, account_id, amount_cents, date, memo, transfer_account_id, payee_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      boardId,
      input.fromAccountId,
      -input.amountCents,
      input.date,
      input.memo,
      input.toAccountId,
      toPayee,
    );
    await db.runAsync(
      'INSERT INTO transactions (board_id, account_id, amount_cents, date, memo, transfer_account_id, payee_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      boardId,
      input.toAccountId,
      input.amountCents,
      input.date,
      input.memo,
      input.fromAccountId,
      fromPayee,
    );
  });
}

async function getLinkedPayeeId(
  db: SQLiteDatabase,
  accountId: number,
): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM payees WHERE linked_account_id = ?',
    accountId,
  );
  return row?.id ?? null;
}

// Creates one uncategorized adjustment transaction for `deltaCents` — the
// "Correct Balance" action, not a separate reconciliation mechanism.
export async function correctBalance(
  db: SQLiteDatabase,
  boardId: number,
  accountId: number,
  deltaCents: number,
): Promise<void> {
  if (deltaCents === 0) return;
  const payeeId = await findOrCreatePayee(db, boardId, 'Balance Adjustment');
  await db.runAsync(
    'INSERT INTO transactions (board_id, account_id, payee_id, amount_cents, date) VALUES (?, ?, ?, ?, ?)',
    boardId,
    accountId,
    payeeId,
    deltaCents,
    currentDateISO(),
  );
}

export interface ImportTransactionInput {
  accountId: number;
  categoryId: number | null;
  payeeId: number | null;
  memo: string | null;
  amountCents: number;
  date: string;
  transferAccountId: number | null;
  importId: string;
}

// Upsert for the YNAB importer, keyed on UNIQUE(board_id, import_id):
// re-running the same export refreshes a row's fields instead of leaving it
// stale when the source data changed (e.g. a corrected amount or
// re-categorization) — scoped per board so the same export can be imported
// into two different boards independently instead of one colliding into
// the other's rows (see migration 010).
export async function importTransaction(
  db: SQLiteDatabase,
  boardId: number,
  input: ImportTransactionInput,
): Promise<'inserted' | 'updated'> {
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM transactions WHERE import_id = ? AND board_id = ?',
    input.importId,
    boardId,
  );
  await db.runAsync(
    `INSERT INTO transactions (board_id, account_id, category_id, payee_id, memo, amount_cents, date, transfer_account_id, import_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(board_id, import_id) DO UPDATE SET
       category_id = excluded.category_id,
       payee_id = excluded.payee_id,
       memo = excluded.memo,
       amount_cents = excluded.amount_cents,
       date = excluded.date,
       transfer_account_id = excluded.transfer_account_id,
       updated_at = datetime('now')`,
    boardId,
    input.accountId,
    input.categoryId,
    input.payeeId,
    input.memo,
    input.amountCents,
    input.date,
    input.transferAccountId,
    input.importId,
  );
  return existing ? 'updated' : 'inserted';
}

// Batch payee reassignment from a transaction list's select mode. Creates the
// payee if the typed name is new, same as saving one transaction would, and
// deliberately leaves everything else on each row alone — this is a relabel,
// not an edit. A mirrored loan leg (see postLinkedAccountLeg) keeps its own
// payee: that name is what links it to its account.
export async function setPayeeForTransactions(
  db: SQLiteDatabase,
  boardId: number,
  ids: number[],
  payeeName: string,
): Promise<void> {
  if (ids.length === 0) return;
  const payeeId = await findOrCreatePayee(db, boardId, payeeName);
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE transactions SET payee_id = ? WHERE id IN (${placeholders})`,
    payeeId,
    ...ids,
  );
  await pruneUnusedPayees(db, boardId);
}

// Folds a set of rows into the first of them, summing their amounts —
// the other answer to a duplicate, for when the rows aren't a double entry
// but two halves of one purchase that should have been a single line
// (two $50 charges becoming one $100). The keeper holds the total; the rest
// go.
//
// Refuses anything that is half of a transfer: summing one leg would leave
// the account across from it holding the old amount, and deleting the others
// takes their partners with them (see deleteTransactions). A transfer's
// duplicates are fixed by deleting the pair, not by merging one side.
export async function mergeTransactions(
  db: SQLiteDatabase,
  boardId: number,
  ids: number[],
): Promise<boolean> {
  if (ids.length < 2) return false;
  const rows = await Promise.all(ids.map((id) => getTransaction(db, id)));
  const present = rows.filter(
    (row): row is TransactionWithLabels => row != null,
  );
  if (present.length < 2) return false;
  if (present.some((row) => row.transferAccountId != null)) return false;

  const [keeper, ...rest] = present;
  const totalCents = present.reduce((sum, row) => sum + row.amountCents, 0);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE transactions SET amount_cents = ?, updated_at = datetime('now') WHERE id = ?`,
      totalCents,
      keeper.id,
    );
    const placeholders = rest.map(() => '?').join(',');
    await db.runAsync(
      `DELETE FROM transactions WHERE id IN (${placeholders})`,
      ...rest.map((row) => row.id),
    );
  });
  await pruneUnusedPayees(db, boardId);
  return true;
}

// The category half of the same batch edit, used by the review page. Takes
// an id rather than a name: categories are managed on the Budget screen and
// a transaction can only ever point at one that already exists.
export async function setCategoryForTransactions(
  db: SQLiteDatabase,
  ids: number[],
  categoryId: number | null,
): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE transactions SET category_id = ? WHERE id IN (${placeholders})`,
    categoryId,
    ...ids,
  );
}
