import { getDb } from '../../../db/client';
import * as payeesRepo from '../../../db/repositories/payeesRepo';
import * as scheduledTransactionsRepo from '../../../db/repositories/scheduledTransactionsRepo';
import type { CalendarExtras } from '../../../finance-tools/mortgagePlan';
import { lastDateOfMonth, previousMonth } from '../../../domain/month';

interface Payment {
  firstDate: string;
  endDate: string;
  cents: number;
}

// One schedule per extra: a one-off posts once (it ends on its own date),
// an every-month amount runs until the month before the next change.
export function extrasAsPayments(
  extras: CalendarExtras,
  fromMonth: string,
  untilMonth: string,
): Payment[] {
  const payments: Payment[] = [];
  for (const [month, cents] of Object.entries(extras.lumps)) {
    if (cents > 0 && month >= fromMonth && month <= untilMonth)
      payments.push({
        firstDate: `${month}-01`,
        endDate: `${month}-01`,
        cents,
      });
  }
  const starts = Object.keys(extras.recurring).sort();
  starts.forEach((start, i) => {
    const cents = extras.recurring[start];
    const next = starts[i + 1];
    const begin = start < fromMonth ? fromMonth : start;
    const end = next ? previousMonth(next) : untilMonth;
    if (cents > 0 && begin <= end)
      payments.push({
        firstDate: `${begin}-01`,
        endDate: lastDateOfMonth(end),
        cents,
      });
  });
  return payments.sort((a, b) => a.firstDate.localeCompare(b.firstDate));
}

// Planned extras become scheduled payments from the account that usually
// pays the mortgage, to the mortgage's own payee, so approving one posts
// both legs like a payment typed on the spend form. Ones already scheduled
// (same date, amount and memo) are skipped, so this can be run again.
export async function addExtrasToScheduled({
  boardId,
  mortgageAccountId,
  mortgageName,
  payingAccountId,
  payments,
  memo,
}: {
  boardId: number;
  mortgageAccountId: number;
  mortgageName: string;
  payingAccountId: number;
  payments: Payment[];
  memo: string;
}): Promise<number> {
  const db = await getDb();
  await payeesRepo.ensureAccountPayee(
    db,
    boardId,
    mortgageAccountId,
    mortgageName,
  );
  const payee = await payeesRepo.findPayeeByLinkedAccount(
    db,
    mortgageAccountId,
  );
  if (!payee) return 0;
  const existing = await scheduledTransactionsRepo.listForAccount(
    db,
    payingAccountId,
  );
  let added = 0;
  for (const p of payments) {
    const duplicate = existing.some(
      (s) =>
        s.nextDate === p.firstDate &&
        s.amountCents === -p.cents &&
        s.memo === memo,
    );
    if (duplicate) continue;
    await scheduledTransactionsRepo.createScheduledTransaction(db, boardId, {
      accountId: payingAccountId,
      categoryId: null,
      payeeName: payee.name,
      memo,
      amountCents: -p.cents,
      frequency: 'monthly',
      intervalN: 1,
      daysOfWeekMask: null,
      nextDate: p.firstDate,
      endDate: p.endDate,
    });
    added++;
  }
  return added;
}
