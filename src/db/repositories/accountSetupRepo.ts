import type { SQLiteDatabase } from '../driver';
import type { AccountType, TrackingKind } from '../../domain/types';
import { currentDateISO } from '../../domain/month';
import { openingEntries } from '../../domain/accountSetup';
import * as accountsRepo from './accountsRepo';
import * as accountValueHistoryRepo from './accountValueHistoryRepo';
import * as transactionsRepo from './transactionsRepo';

export interface SetupAccountInput {
  name: string;
  type: AccountType;
  trackingKind: TrackingKind | null;
  amountCents: number | null;
  homeWorthCents: number | null;
}

// All or nothing: a half-made list would show up again as "already have
// one" on the next try.
export async function createSetupAccounts(db: SQLiteDatabase, boardId: number, inputs: SetupAccountInput[]): Promise<void> {
  const today = currentDateISO();
  await db.withTransactionAsync(async () => {
    for (const input of inputs) {
      const id = await accountsRepo.createAccount(db, boardId, {
        name: input.name,
        type: input.type,
        openingBalanceCents: 0,
        trackingKind: input.trackingKind,
      });
      const entries = openingEntries(input.type, input.amountCents, input.homeWorthCents);
      if (entries.correctionCents) await transactionsRepo.correctBalance(db, boardId, id, entries.correctionCents);
      if (entries.principalCents) {
        await accountValueHistoryRepo.addValueChange(db, id, entries.principalCents, today, null, 'principal');
      }
      if (entries.valueCents) await accountValueHistoryRepo.addValueChange(db, id, entries.valueCents, today, null, 'value');
    }
  });
}
