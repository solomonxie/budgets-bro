import type { TransactionWithLabels } from './types';

type Searchable = Pick<
  TransactionWithLabels,
  'payeeName' | 'memo' | 'categoryName' | 'purchaseItems' | 'date' | 'amountCents'
>;

// Fuzzy free-text match over everything a row shows or carries: payee,
// memo, category, purchase items, date, and amount ("12.5", "$1,200").
// Every word typed must match; a word matches as a substring, or with
// letters skipped inside one word ("cstco" → Costco).
export function matchesSearch(txn: Searchable, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const text = [txn.payeeName, txn.memo, txn.categoryName, txn.purchaseItems, txn.date]
    .join('\n')
    .toLowerCase();
  const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const amount = (Math.abs(txn.amountCents) / 100).toFixed(2);
  return tokens.every(
    (token) =>
      text.includes(token) ||
      matchesAmount(amount, token) ||
      (token.length >= 3 && words.some((word) => isAbbreviation(token, word))),
  );
}

function matchesAmount(amount: string, token: string): boolean {
  const digits = token.replace(/[$,-]/g, '');
  return /^\d*\.?\d+$/.test(digits) && amount.includes(digits);
}

// Same first letter, the rest in order with gaps.
function isAbbreviation(token: string, word: string): boolean {
  if (token[0] !== word[0]) return false;
  let i = 1;
  for (let j = 1; j < word.length && i < token.length; j++) {
    if (word[j] === token[i]) i++;
  }
  return i === token.length;
}
