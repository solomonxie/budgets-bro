import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as budgetsRepo from '../db/repositories/budgetsRepo';
import * as categoriesRepo from '../db/repositories/categoriesRepo';
import {
  categoryBalanceCents,
  categoryCaption,
  categoryStatus,
} from '../domain/budgetMath';
import type { CategoryStatus } from '../domain/budgetMath';
import type { Category, CategoryGroup } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

export interface CategoryBudgetItem {
  category: Category;
  assignedThisMonthCents: number;
  activityThisMonthCents: number;
  balanceCents: number;
  status: CategoryStatus;
  captionText: string;
}

export function useBudget(month: string) {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [itemsByGroup, setItemsByGroup] = useState<
    Record<number, CategoryBudgetItem[]>
  >({});
  const [unassignedCents, setUnassignedCents] = useState(0);
  const [breakdown, setBreakdown] =
    useState<budgetsRepo.UnassignedBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const [
      allGroups,
      allCategories,
      cumAssigned,
      cumActivity,
      thisAssigned,
      thisActivity,
      unassigned,
    ] = await Promise.all([
      categoriesRepo.listCategoryGroups(db, boardId),
      categoriesRepo.listCategories(db, boardId),
      budgetsRepo.cumulativeAssignedByCategory(db, boardId, month),
      budgetsRepo.cumulativeActivityByCategory(db, boardId, month),
      budgetsRepo.assignedThisMonthByCategory(db, boardId, month),
      budgetsRepo.activityThisMonthByCategory(db, boardId, month),
      budgetsRepo.unassignedBreakdown(db, boardId, month),
    ]);

    const byGroup: Record<number, CategoryBudgetItem[]> = {};
    for (const category of allCategories) {
      const assignedCum = cumAssigned[category.id] ?? 0;
      const activityCum = cumActivity[category.id] ?? 0;
      const balanceCents = categoryBalanceCents(assignedCum, activityCum);
      const assignedThisMonthCents = thisAssigned[category.id] ?? 0;
      const activityThisMonthCents = thisActivity[category.id] ?? 0;
      const status = categoryStatus(balanceCents, assignedThisMonthCents);
      const spentThisMonthCents = Math.max(0, -activityThisMonthCents);
      const captionText = categoryCaption(
        status,
        spentThisMonthCents,
        assignedThisMonthCents,
        balanceCents,
      );
      const item: CategoryBudgetItem = {
        category,
        assignedThisMonthCents,
        activityThisMonthCents,
        balanceCents,
        status,
        captionText,
      };
      (byGroup[category.groupId] ??= []).push(item);
    }

    setGroups(allGroups);
    setItemsByGroup(byGroup);
    setUnassignedCents(unassigned.unassignedCents);
    setBreakdown(unassigned);
    setLoading(false);
  }, [month, boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const setAssigned = useCallback(
    async (categoryId: number, assignedCents: number) => {
      const db = await getDb();
      await budgetsRepo.setAssignedCents(
        db,
        boardId,
        categoryId,
        month,
        assignedCents,
      );
      bumpDataVersion();
    },
    [month, boardId, bumpDataVersion],
  );

  return {
    groups,
    itemsByGroup,
    unassignedCents,
    breakdown,
    loading,
    setAssigned,
    refresh,
  };
}
