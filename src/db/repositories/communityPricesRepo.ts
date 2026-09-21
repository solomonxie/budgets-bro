import type { SQLiteDatabase } from '../../db/driver';
import type { CommunityPriceRow } from '../schema';

// A hand-kept benchmark price per community, month by month. Boards' real
// estate boards publish MLS® HPI benchmarks as documents, not as an API, and
// their terms don't allow republishing them — so this is the same shape as a
// tracking account's value log: the user reads a figure and records it, and
// the app does the remembering and the arithmetic.

export interface CommunityPrice {
  id: number;
  city: string;
  community: string;
  propertyType: string | null;
  asOfMonth: string;
  benchmarkPriceCents: number;
  note: string | null;
}

export interface CommunityPriceInput {
  city: string;
  community: string;
  propertyType: string | null;
  asOfMonth: string;
  benchmarkPriceCents: number;
  note: string | null;
}

function mapRow(row: CommunityPriceRow): CommunityPrice {
  return {
    id: row.id,
    city: row.city,
    community: row.community,
    propertyType: row.property_type,
    asOfMonth: row.as_of_month,
    benchmarkPriceCents: row.benchmark_price_cents,
    note: row.note,
  };
}

export async function listPrices(
  db: SQLiteDatabase,
  boardId: number,
): Promise<CommunityPrice[]> {
  const rows = await db.getAllAsync<CommunityPriceRow>(
    `SELECT * FROM community_prices WHERE board_id = ?
     ORDER BY city, community, as_of_month`,
    boardId,
  );
  return rows.map(mapRow);
}

export async function addPrice(
  db: SQLiteDatabase,
  boardId: number,
  input: CommunityPriceInput,
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO community_prices
       (board_id, city, community, property_type, as_of_month, benchmark_price_cents, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    boardId,
    input.city,
    input.community,
    input.propertyType,
    input.asOfMonth,
    input.benchmarkPriceCents,
    input.note,
  );
  return result.lastInsertRowId;
}

export async function deletePrice(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM community_prices WHERE id = ?', id);
}
