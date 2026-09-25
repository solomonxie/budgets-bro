import { useEffect, useState } from 'react';
import { getDb } from '../db/client';
import * as budgetsRepo from '../db/repositories/budgetsRepo';
import * as transactionsRepo from '../db/repositories/transactionsRepo';
import { auditBoardTransfers } from '../db/repositories/transferIntegrityRepo';
import {
  duplicateTransactionIds,
  reviewReasons,
} from '../domain/transactionReview';
import { overspentMonths } from '../domain/budgetMath';
import { currentMonth } from '../domain/month';
import { useAppStore } from '../state/useAppStore';

// How many cards the review page would show — counted by row, not by
// problem, so a transaction missing both a payee and a category is one thing
// to go and look at rather than two. Overspent categories are cards there
// too, so they count here. Every entry point to that page shows the same
// number from here.
//
// Both the budget and history banners mount this, and a tab stays mounted:
// one count per board and data version, shared, not one per banner.
let cached: { key: string; count: Promise<number> } | null = null;

function flaggedCount(boardId: number, dataVersion: number): Promise<number> {
  const key = `${boardId}:${dataVersion}`;
  if (cached?.key !== key) cached = { key, count: countFlagged(boardId).catch(() => 0) };
  return cached.count;
}

export function useFlaggedCount(): number {
  const [count, setCount] = useState(0);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  useEffect(() => {
    let cancelled = false;
    flaggedCount(boardId, dataVersion).then((n) => {
      if (!cancelled) setCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [boardId, dataVersion]);

  return count;
}

async function countFlagged(boardId: number): Promise<number> {
  const db = await getDb();
  const [all, violations, monthTotals] = await Promise.all([
    transactionsRepo.listTransactions(db, boardId),
    auditBoardTransfers(db, boardId),
    budgetsRepo.monthlyTotalsByCategory(db, boardId, currentMonth()),
  ]);
  const duplicates = duplicateTransactionIds(all);
  const ids = new Set<number>();
  for (const txn of all) {
    if (reviewReasons(txn, duplicates).length > 0) ids.add(txn.id);
  }
  for (const violation of violations) ids.add(violation.row.id);

  // One per category-month that overspent — the same cards the review
  // page shows.
  const overspent = Object.values(monthTotals).reduce(
    (total, months) => total + overspentMonths(months).length,
    0,
  );

  return ids.size + overspent;
}
