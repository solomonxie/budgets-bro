import { summarizeBackup } from './backupSummary';
import type { PickedAppExport } from './parseBackupZip';

const empty: PickedAppExport = {
  manifest: { boardId: 1, boardName: 'Home', exportedAt: '2026-09-20T10:00:00Z' },
  accounts: [],
  categoryGroups: [],
  categories: [],
  budgetEntries: [],
  payees: [],
  transactions: [],
  accountValueHistory: [],
  accountRateHistory: [],
  scheduledTransactions: [],
  customGoals: [],
};

describe('summarizeBackup', () => {
  it('counts rows and spans the transaction dates', () => {
    const summary = summarizeBackup({
      ...empty,
      accounts: [{}, {}] as PickedAppExport['accounts'],
      categories: [{}] as PickedAppExport['categories'],
      transactions: [
        { date: '2026-03-02' },
        { date: '2025-01-15' },
        { date: '2026-09-19' },
      ] as PickedAppExport['transactions'],
    });
    expect(summary).toEqual({
      boardName: 'Home',
      exportedAt: '2026-09-20T10:00:00Z',
      accounts: 2,
      categories: 1,
      transactions: 3,
      firstDate: '2025-01-15',
      lastDate: '2026-09-19',
    });
  });

  it('has no date span without transactions', () => {
    expect(summarizeBackup(empty).firstDate).toBeNull();
  });
});
