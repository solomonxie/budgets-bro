import { File } from 'expo-file-system';
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

// This app's own "Export Board as .zip" (see export/exportBoard.ts) — its
// files are raw table dumps named after each table plus a manifest.json,
// which is what tells this apart from a YNAB export.
export async function pickAppExport(): Promise<PickedAppExport | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/zip'] });
  if (picked.canceled) return null;
  const file = picked.result;
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

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
