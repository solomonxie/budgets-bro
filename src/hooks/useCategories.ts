import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as categoriesRepo from '../db/repositories/categoriesRepo';
import type { Category, CategoryGroup } from '../domain/types';
import { useAppStore } from '../state/useAppStore';

export function useCategories() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const [g, c] = await Promise.all([categoriesRepo.listCategoryGroups(db, boardId), categoriesRepo.listCategories(db, boardId)]);
    setGroups(g);
    setCategories(c);
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { groups, categories, loading, refresh };
}
