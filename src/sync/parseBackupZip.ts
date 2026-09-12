import JSZip from 'jszip';
import type { AccountRow, CategoryGroupRow, CategoryRow, BudgetEntryRow, PayeeRow, TransactionRow } from '../db/schema';

export interface PickedAppExport {
  manifest: { boardId: number; boardName: string; exportedAt: string } | null;
  accounts: AccountRow[];
  categoryGroups: CategoryGroupRow[];
  categories: CategoryRow[];
  budgetEntries: BudgetEntryRow[];
  payees: PayeeRow[];
  transactions: TransactionRow[];
}

async function readJson<T>(zip: JSZip, name: string): Promise<T[]> {
  const entry = zip.file(name);
  if (!entry) return [];
  return JSON.parse(await entry.async('string'));
}

// Parses this app's own backup shape (see sync/buildBackup.ts) — raw table
// dumps named after each table plus a manifest.json, which is what tells
// it apart from a YNAB export. Shared by the file-picker restore
// (import/pickAppExport.ts) and cloud "Restore Latest from Cloud" alike —
// same bytes shape either way.
export async function parseBackupZip(bytes: Uint8Array | ArrayBuffer): Promise<PickedAppExport> {
  const zip = await JSZip.loadAsync(bytes);

  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) {
    throw new Error('Not a recognized backup — pick the .zip from Settings’ "Export Board as .zip".');
  }
  const manifest = JSON.parse(await manifestEntry.async('string'));

  return {
    manifest,
    accounts: await readJson<AccountRow>(zip, 'accounts.json'),
    categoryGroups: await readJson<CategoryGroupRow>(zip, 'category_groups.json'),
    categories: await readJson<CategoryRow>(zip, 'categories.json'),
    budgetEntries: await readJson<BudgetEntryRow>(zip, 'budget_entries.json'),
    payees: await readJson<PayeeRow>(zip, 'payees.json'),
    transactions: await readJson<TransactionRow>(zip, 'transactions.json'),
  };
}
