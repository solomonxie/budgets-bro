// Minimal RFC4180 CSV parser: quoted fields, "" escapes, commas/newlines
// inside quotes, CRLF or LF line endings. Good enough for YNAB's export
// without pulling in a parsing dependency.
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text.replace(/^﻿/, ''));
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    header.forEach((key, i) => (record[key] = row[i] ?? ''));
    return record;
  });
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      endField();
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      endRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) endRow();
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

// "$1,234.56" / "-$1,234.56" -> 123456 / -123456. Empty/"$0.00" -> 0.
export function parseMoneyToCents(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const negative = trimmed.startsWith('-');
  const numeric = trimmed.replace(/[^0-9.]/g, '');
  if (!numeric) return 0;
  const cents = Math.round(parseFloat(numeric) * 100);
  return negative ? -cents : cents;
}

// "MM/DD/YYYY" -> "YYYY-MM-DD"
export function parseYnabDate(value: string): string {
  const [m, d, y] = value.trim().split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// "Jan 2023" -> "2023-01"
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function parseYnabMonth(value: string): string {
  const [monthName, year] = value.trim().split(' ');
  const monthIndex = MONTHS.indexOf(monthName);
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}
