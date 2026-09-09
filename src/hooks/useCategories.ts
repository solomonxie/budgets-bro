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

  const refresh = useCallback(async () => {
    const db = await getDb();
    const [g, c] = await Promise.all([categoriesRepo.listCategoryGroups(db), categoriesRepo.listCategories(db)]);
    setGroups(g);
    setCategories(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return { groups, categories, loading, refresh };
}
