import type { SQLiteDatabase } from 'expo-sqlite';
import { parseCsv, parseMoneyToCents, parseYnabDate, parseYnabMonth } from './csv';
import * as accountsRepo from '../db/repositories/accountsRepo';
import * as categoriesRepo from '../db/repositories/categoriesRepo';
import * as budgetsRepo from '../db/repositories/budgetsRepo';
import * as transactionsRepo from '../db/repositories/transactionsRepo';
import { findOrCreatePayee } from '../db/repositories/payeesRepo';
import type { AccountType } from '../domain/types';

export interface YnabImportFiles {
  registerCsv: string;
  planCsv: string;
}

export interface YnabImportResult {
  accountsCreated: number;
  categoriesCreated: number;
  transactionsInserted: number;
  transactionsUpdated: number;
  budgetEntriesWritten: number;
}

// No exact match to an existing account: guess a reasonable type from the
// name so the account lands in a sane Accounts-screen group. The user can
// always fix it afterward — this only runs once, at first import.
function inferAccountType(name: string): AccountType {
  const n = name.toLowerCase();
  if (n.includes('mortgage')) return 'mortgage';
  if (n.includes('debt') || n.includes('loan')) return 'loan';
  if (n.includes('credit')) return 'credit_card';
  if (n.includes('rrsp') || n.includes('tfsa') || n.includes('fhsa') || n.includes('saving')) return 'savings';
  if (n.includes('value') || n.includes('asset') || n.includes('depreciat')) return 'tracking';
  return 'checking';
}

// YNAB never puts a category on a transfer between two on-budget accounts —
// only on one that crosses the budget boundary (into/out of an off-budget
// tracking account). So any account that's ever the target of a categorized
// transfer must be off-budget, regardless of what its name suggests (e.g. an
// "Emergency" fund or "RRSP" kept as a tracking account, not real cash).
function findOffBudgetAccountNames(registerRows: Record<string, string>[]): Set<string> {
  const names = new Set<string>();
  for (const row of registerRows) {
    const payee = (row['Payee'] ?? '').trim();
    if (payee.startsWith(TRANSFER_PREFIX) && (row['Category'] ?? '').trim()) {
      names.add(payee.slice(TRANSFER_PREFIX.length).trim());
    }
  }
  return names;
}

async function ensureAccountId(
  db: SQLiteDatabase,
  boardId: number,
  cache: Map<string, number>,
  name: string,
  offBudgetNames: Set<string>,
  onCreated: () => void,
): Promise<number> {
  const trimmed = name.trim();
  const cached = cache.get(trimmed);
  if (cached != null) return cached;
  const existing = await accountsRepo.findAccountByName(db, boardId, trimmed);
  if (existing) {
    cache.set(trimmed, existing.id);
    // Self-heal: a past import may have guessed this account as on-budget
    // cash before we saw a categorized transfer prove it's actually
    // off-budget (see findOffBudgetAccountNames) — fix the type in place.
    if (offBudgetNames.has(trimmed) && CASH_TYPES.has(existing.type)) {
      await accountsRepo.updateAccount(db, boardId, existing.id, {
        name: existing.name,
        type: 'tracking',
        openingBalanceCents: existing.openingBalanceCents,
        termMonths: existing.termMonths,
        originalPrincipalCents: existing.originalPrincipalCents,
        originationDate: existing.originationDate,
        originalHousePriceCents: existing.originalHousePriceCents,
      });
    }
    return existing.id;
  }
  const guessedType = inferAccountType(trimmed);
  const type = offBudgetNames.has(trimmed) ? 'tracking' : guessedType;
  const id = await accountsRepo.createAccount(db, boardId, { name: trimmed, type, openingBalanceCents: 0 });
  cache.set(trimmed, id);
  onCreated();
  return id;
}

async function ensureCategoryId(
  db: SQLiteDatabase,
  boardId: number,
  cache: Map<string, number>,
  groupName: string,
  categoryName: string,
  onCreated: () => void,
): Promise<number | null> {
  if (!groupName.trim() || !categoryName.trim()) return null;
  const key = `${groupName} ${categoryName}`;
  const cached = cache.get(key);
  if (cached != null) return cached;
  const groupId = await categoriesRepo.findOrCreateCategoryGroup(db, boardId, groupName.trim());
  const before = await categoriesRepo.listCategories(db, boardId);
  const id = await categoriesRepo.findOrCreateCategory(db, boardId, groupId, categoryName.trim());
  if (!before.some((c) => c.id === id)) onCreated();
  cache.set(key, id);
  return id;
}

const CASH_TYPES = new Set<AccountType>(['checking', 'cash', 'savings', 'income']);
const TRANSFER_PREFIX = 'Transfer : ';

// YNAB's reserved category for uncategorized inflow — importing it as a real
// category would make that money look "spent" into a category instead of
// landing in Unassigned Cash where it actually belongs.
const READY_TO_ASSIGN_NAMES = new Set(['ready to assign', 'inflow: ready to assign']);
function isReadyToAssign(categoryName: string): boolean {
  return READY_TO_ASSIGN_NAMES.has(categoryName.trim().toLowerCase());
}

export async function importYnabExport(db: SQLiteDatabase, boardId: number, files: YnabImportFiles): Promise<YnabImportResult> {
  const registerRows = parseCsv(files.registerCsv);
  const planRows = parseCsv(files.planCsv);

  const result: YnabImportResult = {
    accountsCreated: 0,
    categoriesCreated: 0,
    transactionsInserted: 0,
    transactionsUpdated: 0,
    budgetEntriesWritten: 0,
  };

  const accountIds = new Map<string, number>();
  const categoryIds = new Map<string, number>();
  const offBudgetNames = findOffBudgetAccountNames(registerRows);
  // Row position in the export isn't stable across re-exports (rows shift
  // when older transactions are edited or new ones inserted), so identity
  // instead comes from the row's own fields — with an occurrence counter to
  // tell apart genuine duplicates (e.g. two identical same-day purchases).
  const occurrenceCounts = new Map<string, number>();

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < registerRows.length; i++) {
      const row = registerRows[i];
      const accountName = row['Account'];
      if (!accountName) continue;
      const accountId = await ensureAccountId(db, boardId, accountIds, accountName, offBudgetNames, () => result.accountsCreated++);

      const payeeName = (row['Payee'] ?? '').trim();
      const isTransfer = payeeName.startsWith(TRANSFER_PREFIX);
      const transferAccountId = isTransfer
        ? await ensureAccountId(db, boardId, accountIds, payeeName.slice(TRANSFER_PREFIX.length), offBudgetNames, () => result.accountsCreated++)
        : null;

      // A transfer usually carries no category (money just moves between
      // on-budget accounts) — except when it crosses into/out of an
      // off-budget account, where YNAB requires one, same as any other
      // outflow/inflow. Keep that category so its activity counts normally;
      // only the reserved Ready to Assign pseudo-category maps to none.
      const categoryId = isReadyToAssign(row['Category'] ?? '')
        ? null
        : isTransfer && !(row['Category'] ?? '').trim()
          ? null
          : await ensureCategoryId(db, boardId, categoryIds, row['Category Group'] ?? '', row['Category'] ?? '', () => result.categoriesCreated++);

      const payeeId = !isTransfer && payeeName ? await findOrCreatePayee(db, boardId, payeeName) : null;
      const amountCents = parseMoneyToCents(row['Inflow']) - parseMoneyToCents(row['Outflow']);
      const memo = (row['Memo'] ?? '').trim() || null;
      const date = parseYnabDate(row['Date']);

      // Account + date + payee is the natural key: YNAB already combines
      // same-day, same-payee transactions on export, so this alone
      // identifies a row without being brittle to a later memo/category edit.
      const contentKey = `${accountName}|${date}|${payeeName}`;
      const occurrence = occurrenceCounts.get(contentKey) ?? 0;
      occurrenceCounts.set(contentKey, occurrence + 1);

      const outcome = await transactionsRepo.importTransaction(db, boardId, {
        accountId,
        categoryId,
        payeeId,
        memo,
        amountCents,
        date,
        transferAccountId,
        importId: `ynab:${contentKey}|#${occurrence}`,
      });
      if (outcome === 'inserted') result.transactionsInserted++;
      else result.transactionsUpdated++;
    }

    for (const row of planRows) {
      const groupName = row['Category Group'] ?? '';
      const categoryName = row['Category'] ?? '';
      if (!groupName.trim() || !categoryName.trim() || isReadyToAssign(categoryName)) continue;
      const categoryId = await ensureCategoryId(db, boardId, categoryIds, groupName, categoryName, () => result.categoriesCreated++);
      if (categoryId == null) continue;
      const month = parseYnabMonth(row['Month']);
      const assignedCents = parseMoneyToCents(row['Assigned']);
      await budgetsRepo.setAssignedCents(db, boardId, categoryId, month, assignedCents);
      result.budgetEntriesWritten++;
    }
  });

  return result;
}
