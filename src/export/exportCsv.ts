import type { SQLiteDatabase } from '../db/driver';
import { cacheDir, fileUrl, joinPath, writeBytes } from '../files/fileStore';
import { utf8ToBytes } from '../files/bytes';
import { Share } from 'react-native';
import { slugifyBoardName } from '../sync/backupPath';

const HEADER = ['Date', 'Account', 'Payee', 'Category', 'Memo', 'Amount'];

const TRANSACTIONS_SQL = `
  SELECT t.date, a.name AS account, p.name AS payee, c.name AS category, t.memo, t.amount_cents
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN payees p ON p.id = t.payee_id
  LEFT JOIN categories c ON c.id = t.category_id
  WHERE t.board_id = ?
  ORDER BY t.date DESC, t.id DESC`;

interface Row {
  date: string;
  account: string;
  payee: string | null;
  category: string | null;
  memo: string | null;
  amount_cents: number;
}

export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function formatAmount(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? '-' : '';
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function toCsv(rows: Row[]): string {
  const lines = [HEADER.join(',')];
  for (const r of rows) {
    lines.push(
      [r.date, r.account, r.payee ?? '', r.category ?? '', r.memo ?? '', formatAmount(r.amount_cents)]
        .map(csvField)
        .join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}

export async function exportTransactionsCsv(db: SQLiteDatabase, boardId: number, boardName: string): Promise<void> {
  const rows = await db.getAllAsync<Row>(TRANSACTIONS_SQL, boardId);
  const bom = '﻿'; // Excel needs it to read UTF-8 (Chinese payees)
  const path = joinPath(cacheDir, `${slugifyBoardName(boardName)}-transactions-${Date.now()}.csv`);
  await writeBytes(path, utf8ToBytes(bom + toCsv(rows)));
  await Share.share({ url: fileUrl(path) });
}
