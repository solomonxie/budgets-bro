import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDb } from '../db/client';
import * as transactionsRepo from '../db/repositories/transactionsRepo';
import {
  purchaseItemNames,
  summarizePurchaseItems,
} from '../domain/trackedPrices';
import type { PurchaseItemRow } from '../domain/trackedPrices';
import { useAppStore } from '../state/useAppStore';

// Ranked in memory: purchase items live in a column on the transaction rather
// than a table of their own, so there is nothing for SQL to group by. The read
// is narrow though — the rows that named something, three columns, no joins —
// and the same rows serve the per-item history the page opens on demand.
export function useTrackedPrices() {
  const [transactions, setTransactions] = useState<PurchaseItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const refresh = useCallback(async () => {
    const db = await getDb();
    setTransactions(await transactionsRepo.listPurchaseItemRows(db, boardId));
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  const items = useMemo(() => summarizePurchaseItems(transactions), [transactions]);
  // Every name ever typed, for the spend form's item picker — including the
  // ones with no price, which the ranking above leaves out.
  const names = useMemo(() => purchaseItemNames(transactions), [transactions]);

  return { items, names, transactions, loading };
}
