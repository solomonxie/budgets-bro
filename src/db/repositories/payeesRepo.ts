import type { SQLiteDatabase } from 'expo-sqlite';
import type { PayeeRow } from '../schema';
import type { Payee } from '../../domain/types';

function mapRow(row: PayeeRow): Payee {
  return { id: row.id, name: row.name, linkedAccountId: row.linked_account_id };
}

export async function listPayees(db: SQLiteDatabase, boardId: number): Promise<Payee[]> {
  const rows = await db.getAllAsync<PayeeRow>('SELECT * FROM payees WHERE board_id = ? ORDER BY name', boardId);
  return rows.map(mapRow);
}

export async function getPayee(db: SQLiteDatabase, id: number): Promise<Payee | null> {
  const row = await db.getFirstAsync<PayeeRow>('SELECT * FROM payees WHERE id = ?', id);
  return row ? mapRow(row) : null;
}

export async function findPayeeByLinkedAccount(db: SQLiteDatabase, accountId: number): Promise<Payee | null> {
  const row = await db.getFirstAsync<PayeeRow>('SELECT * FROM payees WHERE linked_account_id = ?', accountId);
  return row ? mapRow(row) : null;
}

export async function findOrCreatePayee(db: SQLiteDatabase, boardId: number, name: string): Promise<number | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = await db.getFirstAsync<PayeeRow>('SELECT * FROM payees WHERE name = ? AND board_id = ?', trimmed, boardId);
  if (existing) return existing.id;
  const result = await db.runAsync('INSERT INTO payees (board_id, name) VALUES (?, ?)', boardId, trimmed);
  return result.lastInsertRowId;
}

export async function renamePayee(db: SQLiteDatabase, id: number, name: string): Promise<void> {
  await db.runAsync('UPDATE payees SET name = ? WHERE id = ?', name, id);
}

// Auto-creates/renames the payee a loan/mortgage account owns 1:1, named
// after it — selecting it on a transaction posts a mirrored credit to the
// account (see transactionsRepo.postLinkedAccountLeg), regardless of
// whatever category that transaction uses.
export async function ensurePaymentPayee(db: SQLiteDatabase, boardId: number, accountId: number, accountName: string): Promise<void> {
  const existing = await findPayeeByLinkedAccount(db, accountId);
  if (existing) {
    if (existing.name !== accountName) await renamePayee(db, existing.id, accountName);
    return;
  }
  const byName = await db.getFirstAsync<PayeeRow>('SELECT * FROM payees WHERE name = ? AND board_id = ?', accountName, boardId);
  if (byName) {
    await db.runAsync('UPDATE payees SET linked_account_id = ? WHERE id = ?', accountId, byName.id);
    return;
  }
  await db.runAsync('INSERT INTO payees (board_id, name, linked_account_id) VALUES (?, ?, ?)', boardId, accountName, accountId);
}

export async function unlinkPaymentPayee(db: SQLiteDatabase, accountId: number): Promise<void> {
  await db.runAsync('UPDATE payees SET linked_account_id = NULL WHERE linked_account_id = ?', accountId);
}
