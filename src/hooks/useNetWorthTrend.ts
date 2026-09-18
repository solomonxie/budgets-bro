import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDb } from '../db/client';
import * as accountRateHistoryRepo from '../db/repositories/accountRateHistoryRepo';
import { netWorthTrend } from '../domain/netWorthTrend';
import type { NetWorthTrendPoint, TrendActivity, TrendPayment, TrendReading } from '../domain/netWorthTrend';
import { currentDateISO, currentMonth, monthsBetween } from '../domain/month';
import { useAccounts } from './useAccounts';
import { useAppStore } from '../state/useAppStore';
import {
  EARLIEST_ACTIVITY_MONTH,
  LOAN_PAYMENTS_FOR_BOARD,
  MONTHLY_ACTIVITY_BY_ACCOUNT,
} from '../../databases/queries/accounts';
import { ALL_READINGS_FOR_BOARD } from '../../databases/queries/accountValueHistory';
import type { AccountValueKind } from '../domain/types';

interface TrendInputs {
  activity: TrendActivity[];
  readings: TrendReading[];
  payments: TrendPayment[];
  rateByAccountId: Map<number, number>;
  earliestMonth: string | null;
}

const EMPTY: TrendInputs = { activity: [], readings: [], payments: [], rateByAccountId: new Map(), earliestMonth: null };

// Net worth month by month, over the board's whole history. The accounts
// themselves come from useAccounts (so the caller's Net Worth card and this
// line are reading the same list); everything else is what those accounts
// were worth at each point, which only the database knows.
export function useNetWorthTrend(excludedAccountIds: Set<number>): NetWorthTrendPoint[] {
  const { accounts } = useAccounts();
  const boardId = useAppStore((s) => s.currentBoardId);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const [inputs, setInputs] = useState<TrendInputs>(EMPTY);

  const refresh = useCallback(async () => {
    const db = await getDb();
    const today = currentDateISO();
    const [activityRows, readingRows, paymentRows, rateByAccountId, earliest] = await Promise.all([
      db.getAllAsync<{ account_id: number; month: string; total: number }>(MONTHLY_ACTIVITY_BY_ACCOUNT, boardId, today),
      db.getAllAsync<{ account_id: number; kind: string; value_cents: number; effective_date: string }>(ALL_READINGS_FOR_BOARD, boardId),
      db.getAllAsync<{ account_id: number; amount_cents: number; date: string }>(LOAN_PAYMENTS_FOR_BOARD, boardId, today),
      accountRateHistoryRepo.currentRatesByBoard(db, boardId),
      db.getFirstAsync<{ month: string | null }>(EARLIEST_ACTIVITY_MONTH, boardId, boardId),
    ]);
    setInputs({
      activity: activityRows.map((r) => ({ accountId: r.account_id, month: r.month, totalCents: r.total })),
      readings: readingRows.map((r) => ({
        accountId: r.account_id,
        kind: r.kind as AccountValueKind,
        valueCents: r.value_cents,
        effectiveDate: r.effective_date,
      })),
      payments: paymentRows.map((r) => ({ accountId: r.account_id, date: r.date, amountCents: r.amount_cents })),
      rateByAccountId,
      earliestMonth: earliest?.month ?? null,
    });
  }, [boardId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  return useMemo(() => {
    if (inputs.earliestMonth == null) return [];
    const included = accounts.filter((a) => !excludedAccountIds.has(a.account.id));
    if (included.length === 0) return [];
    return netWorthTrend({
      months: monthsBetween(inputs.earliestMonth, currentMonth()),
      accounts: included.map(({ account }) => ({
        id: account.id,
        type: account.type,
        openingBalanceCents: account.openingBalanceCents,
        originalPrincipalCents: account.originalPrincipalCents,
        originationDate: account.originationDate,
        createdAt: account.createdAt,
      })),
      activity: inputs.activity,
      readings: inputs.readings,
      payments: inputs.payments,
      rateByAccountId: inputs.rateByAccountId,
    });
  }, [inputs, accounts, excludedAccountIds]);
}
