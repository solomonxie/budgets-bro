import type { PickedAppExport } from './parseBackupZip';

export interface BackupSummary {
  boardName: string | null;
  exportedAt: string | null;
  accounts: number;
  categories: number;
  transactions: number;
  firstDate: string | null;
  lastDate: string | null;
}

// What a backup holds, for telling two files apart before restoring one.
export function summarizeBackup(backup: PickedAppExport): BackupSummary {
  let firstDate: string | null = null;
  let lastDate: string | null = null;
  for (const { date } of backup.transactions) {
    if (firstDate == null || date < firstDate) firstDate = date;
    if (lastDate == null || date > lastDate) lastDate = date;
  }
  return {
    boardName: backup.manifest?.boardName ?? null,
    exportedAt: backup.manifest?.exportedAt ?? null,
    accounts: backup.accounts.length,
    categories: backup.categories.length,
    transactions: backup.transactions.length,
    firstDate,
    lastDate,
  };
}
