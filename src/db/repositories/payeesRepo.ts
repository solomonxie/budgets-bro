import type { SQLiteDatabase } from 'expo-sqlite';
import type { PayeeRow } from '../schema';
import type { Payee } from '../../domain/types';

function mapRow(row: PayeeRow): Payee {
  return { id: row.id, name: row.name };
}

export async function listPayees(db: SQLiteDatabase, boardId: number): Promise<Payee[]> {
  const rows = await db.getAllAsync<PayeeRow>('SELECT * FROM payees WHERE board_id = ? ORDER BY name', boardId);
  return rows.map(mapRow);
}

export async function findOrCreatePayee(db: SQLiteDatabase, boardId: number, name: string): Promise<number | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = await db.getFirstAsync<PayeeRow>('SELECT * FROM payees WHERE name = ? AND board_id = ?', trimmed, boardId);
  if (existing) return existing.id;
  const result = await db.runAsync('INSERT INTO payees (board_id, name) VALUES (?, ?)', boardId, trimmed);
  return result.lastInsertRowId;
}
