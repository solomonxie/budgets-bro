import { useCallback, useEffect, useState } from 'react';
import { getDb } from '../db/client';
import { conflictedRowIds, conflictsForRow } from '../sync/conflicts';
import type { FieldConflict } from '../sync/conflicts';
import { useAppStore } from '../state/useAppStore';

const NONE: ReadonlySet<number> = new Set();

export function useConflictedRowIds(table: string): ReadonlySet<number> {
  const [ids, setIds] = useState<ReadonlySet<number>>(NONE);
  const dataVersion = useAppStore((s) => s.dataVersion);

  useEffect(() => {
    let live = true;
    (async () => {
      const found = await conflictedRowIds(await getDb(), table);
      if (live) setIds(found.size === 0 ? NONE : found);
    })();
    return () => {
      live = false;
    };
  }, [table, dataVersion]);

  return ids;
}

export function useRowConflicts(table: string, id: number | null) {
  const [conflicts, setConflicts] = useState<FieldConflict[]>([]);

  const refresh = useCallback(async () => {
    if (id == null) return;
    setConflicts(await conflictsForRow(await getDb(), table, id));
  }, [table, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { conflicts, refresh };
}
