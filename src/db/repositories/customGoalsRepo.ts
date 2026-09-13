import type { SQLiteDatabase } from 'expo-sqlite';
import type { CustomGoalJoinRow } from '../schema';
import type { CustomGoalWithProgress } from '../../domain/types';
import { currentDateISO } from '../../domain/month';
import { LIST_FOR_BOARD, INSERT_CUSTOM_GOAL, UPDATE_CUSTOM_GOAL, DELETE_CUSTOM_GOAL, MAX_SORT_ORDER } from '../../../databases/queries/customGoals';

function mapRow(row: CustomGoalJoinRow): CustomGoalWithProgress {
  return {
    id: row.id,
    name: row.name,
    targetCents: row.target_cents,
    linkedAccountId: row.linked_account_id,
    manualProgressCents: row.manual_progress_cents,
    sortOrder: row.sort_order,
    progressCents: row.linked_account_id != null ? (row.linked_balance_cents ?? 0) : (row.manual_progress_cents ?? 0),
  };
}

export async function listForBoard(db: SQLiteDatabase, boardId: number): Promise<CustomGoalWithProgress[]> {
  const rows = await db.getAllAsync<CustomGoalJoinRow>(LIST_FOR_BOARD, currentDateISO(), boardId);
  return rows.map(mapRow);
}

export interface CustomGoalInput {
  name: string;
  targetCents: number;
  // Exactly one of these should be non-null — the modal enforces the
  // choice, this layer just stores whichever was given.
  linkedAccountId: number | null;
  manualProgressCents: number | null;
}

export async function createGoal(db: SQLiteDatabase, boardId: number, input: CustomGoalInput): Promise<number> {
  const maxOrderRow = await db.getFirstAsync<{ max_order: number | null }>(MAX_SORT_ORDER, boardId);
  const sortOrder = (maxOrderRow?.max_order ?? -1) + 1;
  const result = await db.runAsync(
    INSERT_CUSTOM_GOAL,
    boardId,
    input.name,
    input.targetCents,
    input.linkedAccountId,
    input.manualProgressCents,
    sortOrder,
  );
  return result.lastInsertRowId;
}

export async function updateGoal(db: SQLiteDatabase, id: number, input: CustomGoalInput): Promise<void> {
  await db.runAsync(UPDATE_CUSTOM_GOAL, input.name, input.targetCents, input.linkedAccountId, input.manualProgressCents, id);
}

export async function deleteGoal(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(DELETE_CUSTOM_GOAL, id);
}
