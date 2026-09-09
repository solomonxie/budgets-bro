import type { SQLiteDatabase } from 'expo-sqlite';
import type { PayeeRow } from '../schema';
import type { Payee } from '../../domain/types';

function mapRow(row: PayeeRow): Payee {
  return { id: row.id, name: row.name };
}

export async function listPayees(db: SQLiteDatabase): Promise<Payee[]> {
  const rows = await db.getAllAsync<PayeeRow>('SELECT * FROM payees ORDER BY name');
  return rows.map(mapRow);
}

export async function findOrCreatePayee(db: SQLiteDatabase, name: string): Promise<number | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = await db.getFirstAsync<PayeeRow>('SELECT * FROM payees WHERE name = ?', trimmed);
  if (existing) return existing.id;
  const result = await db.runAsync('INSERT INTO payees (name) VALUES (?)', trimmed);
  return result.lastInsertRowId;
}
