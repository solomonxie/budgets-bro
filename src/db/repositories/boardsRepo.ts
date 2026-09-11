import type { SQLiteDatabase } from 'expo-sqlite';
import type { BoardRow } from '../schema';
import type { Board } from '../../domain/types';
import { LIST_BOARDS, DELETE_BOARD_CASCADE } from '../../../databases/queries/boards';

function mapRow(row: BoardRow): Board {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export async function listBoards(db: SQLiteDatabase): Promise<Board[]> {
  const rows = await db.getAllAsync<BoardRow>(LIST_BOARDS);
  return rows.map(mapRow);
}

export async function createBoard(db: SQLiteDatabase, name: string): Promise<number> {
  const result = await db.runAsync('INSERT INTO boards (name) VALUES (?)', name);
  return result.lastInsertRowId;
}

export async function renameBoard(db: SQLiteDatabase, id: number, name: string): Promise<void> {
  await db.runAsync('UPDATE boards SET name = ? WHERE id = ?', name, id);
}

// Wipes the board and everything in it — there's no "hide" concept for a
// board the way accounts/categories have archived_at, since deleting one is
// meant to actually reclaim the space, not just declutter a list.
export async function deleteBoard(db: SQLiteDatabase, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const sql of DELETE_BOARD_CASCADE) {
      await db.runAsync(sql, id);
    }
  });
}
