import { useEffect, useState } from 'react';
import { getDb } from '../../../db/client';
import * as accountRateHistoryRepo from '../../../db/repositories/accountRateHistoryRepo';
import * as transactionsRepo from '../../../db/repositories/transactionsRepo';
import { usualPaymentCents } from '../../../finance-tools/mortgagePlan';
import { currentMonth, previousMonth } from '../../../domain/month';
import { useAppStore } from '../../../state/useAppStore';

export interface HeldHistory {
  /** Oldest first. */
  rates: { effectiveDate: string; rateBps: number }[];
  /** Median of the last six full months' payments, if any were recorded. */
  usualPaymentCents: number | null;
  payingAccountId: number | null;
}

const MONTHS_LOOKED_AT = 6;

// What a real mortgage's own rows say: its rate changes, what is actually
// paid each month, and from where. Three small queries, only while a real
// mortgage's tab is open.
export function useHeldHistory(accountId: number | null): HeldHistory | null {
  const [history, setHistory] = useState<HeldHistory | null>(null);
  const dataVersion = useAppStore((s) => s.dataVersion);

  useEffect(() => {
    if (accountId == null) {
      setHistory(null);
      return;
    }
    let live = true;
    (async () => {
      const db = await getDb();
      const thisMonth = currentMonth();
      let since = thisMonth;
      for (let i = 0; i < MONTHS_LOOKED_AT; i++) since = previousMonth(since);
      const [rates, months, payingAccountId] = await Promise.all([
        accountRateHistoryRepo.listRateHistory(db, accountId),
        transactionsRepo.loanPaymentsByMonth(db, accountId, `${since}-01`),
        transactionsRepo.loanPayingAccountId(db, accountId),
      ]);
      if (!live) return;
      setHistory({
        rates: [...rates]
          .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
          .map((r) => ({ effectiveDate: r.effectiveDate, rateBps: r.rateBps })),
        usualPaymentCents: usualPaymentCents(
          months.filter((m) => m.month < thisMonth).map((m) => m.cents),
        ),
        payingAccountId,
      });
    })();
    return () => {
      live = false;
    };
  }, [accountId, dataVersion]);

  return history;
}
