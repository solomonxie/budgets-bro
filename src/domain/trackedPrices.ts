import { itemPriceCents, parsePurchaseItems } from './purchaseItems';

// All these functions need of a transaction. Narrow on purpose: the query
// behind them reads three columns rather than joining payee, category and
// account onto every row of the board to label something no item list
// shows. A full TransactionWithLabels satisfies it, so callers holding one
// can pass it straight in.
export interface PurchaseItemRow {
  id: number;
  date: string;
  purchaseItems: string | null;
}

// What the ledger knows about a *thing* rather than a transaction: every
// priced purchase item (see purchaseItems.ts), collected across the board and
// ranked by how often it was bought. Pure — the DB read lives in
// hooks/useTrackedPrices, the same split as aiAnalysis.ts.
//
// Only pairs whose value is money count. `Warranty=2 years` stays on its
// transaction and out of here: a price is what makes an item comparable with
// itself over time.

export interface PurchaseItemSummary {
  // Trimmed and lower-cased — "Olive Oil" and "olive oil " are one thing.
  name: string;
  // The spelling used most often, which is what the list shows.
  displayName: string;
  count: number;
  totalCents: number;
  avgCents: number;
  minCents: number;
  maxCents: number;
  lastDate: string;
}

// One per day an item was bought, because that is the grain a price means
// anything at: two bottles in the same shop on the same afternoon are one
// purchase decision, and averaging them is what makes the trend line a
// price rather than a basket total.
export interface PurchaseItemDay {
  date: string;
  count: number;
  totalCents: number;
  // The average paid per item that day, and the point the trend plots.
  priceCents: number;
  transactionIds: number[];
}

export interface PurchaseItemTrend {
  points: { date: string; priceCents: number }[];
  // The average of everything before the newest point, over at most a year
  // of them — the same "trailing window, excluding the one being read" rule
  // the category trend's baseline uses on InsightsScreen.
  benchmarkCents: number | null;
}

const BENCHMARK_WINDOW = 12;

interface Occurrence {
  name: string;
  displayName: string;
  priceCents: number;
  date: string;
  transactionId: number;
}

function occurrences(txns: PurchaseItemRow[]): Occurrence[] {
  const found: Occurrence[] = [];
  for (const txn of txns) {
    for (const item of parsePurchaseItems(txn.purchaseItems)) {
      const priceCents = itemPriceCents(item.value);
      if (priceCents == null) continue;
      found.push({
        name: item.key.trim().toLowerCase(),
        displayName: item.key.trim(),
        priceCents,
        date: txn.date,
        transactionId: txn.id,
      });
    }
  }
  return found;
}

// Most-bought first — the question this page answers is "what do I keep
// buying?", not "what did I spend most on", which the category breakdown
// already covers. Ties go to the bigger spend.
export function summarizePurchaseItems(
  txns: PurchaseItemRow[],
): PurchaseItemSummary[] {
  const byName = new Map<string, Occurrence[]>();
  for (const occurrence of occurrences(txns)) {
    const group = byName.get(occurrence.name);
    if (group) group.push(occurrence);
    else byName.set(occurrence.name, [occurrence]);
  }

  const summaries: PurchaseItemSummary[] = [];
  for (const [name, group] of byName) {
    const prices = group.map((o) => o.priceCents);
    const totalCents = prices.reduce((sum, cents) => sum + cents, 0);
    summaries.push({
      name,
      displayName: mostUsedSpelling(group),
      count: group.length,
      totalCents,
      avgCents: Math.round(totalCents / group.length),
      minCents: Math.min(...prices),
      maxCents: Math.max(...prices),
      lastDate: group.reduce(
        (latest, o) => (o.date > latest ? o.date : latest),
        group[0].date,
      ),
    });
  }
  return summaries.sort(
    (a, b) => b.count - a.count || b.totalCents - a.totalCents,
  );
}

function mostUsedSpelling(group: Occurrence[]): string {
  const tally = new Map<string, number>();
  for (const o of group) tally.set(o.displayName, (tally.get(o.displayName) ?? 0) + 1);
  let best = group[0].displayName;
  let bestCount = 0;
  for (const [spelling, count] of tally) {
    if (count > bestCount) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
}

// Newest first, which is the order the history list reads in.
export function purchaseItemHistory(
  txns: PurchaseItemRow[],
  name: string,
): PurchaseItemDay[] {
  const key = name.trim().toLowerCase();
  const byDate = new Map<string, Occurrence[]>();
  for (const occurrence of occurrences(txns)) {
    if (occurrence.name !== key) continue;
    const group = byDate.get(occurrence.date);
    if (group) group.push(occurrence);
    else byDate.set(occurrence.date, [occurrence]);
  }

  return [...byDate.entries()]
    .map(([date, group]) => {
      const totalCents = group.reduce((sum, o) => sum + o.priceCents, 0);
      return {
        date,
        count: group.length,
        totalCents,
        priceCents: Math.round(totalCents / group.length),
        transactionIds: [...new Set(group.map((o) => o.transactionId))],
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function purchaseItemTrend(history: PurchaseItemDay[]): PurchaseItemTrend {
  const points = [...history]
    .reverse()
    .map((day) => ({ date: day.date, priceCents: day.priceCents }));
  const prior = points.slice(Math.max(0, points.length - 1 - BENCHMARK_WINDOW), points.length - 1);
  return {
    points,
    benchmarkCents:
      prior.length > 0
        ? Math.round(prior.reduce((sum, p) => sum + p.priceCents, 0) / prior.length)
        : null,
  };
}

// Every item name the board has seen, commonest first — what the spend
// form's item picker offers. Unpriced pairs count here even though they
// never reach the ranking above: the point is to type a name once and pick
// it forever after, so that the same thing doesn't end up recorded under
// three spellings.
export function purchaseItemNames(txns: PurchaseItemRow[]): string[] {
  const tally = new Map<string, { displayName: string; count: number }>();
  for (const txn of txns) {
    for (const item of parsePurchaseItems(txn.purchaseItems)) {
      const name = item.key.trim();
      if (name === '') continue;
      const key = name.toLowerCase();
      const seen = tally.get(key);
      if (seen) seen.count += 1;
      else tally.set(key, { displayName: name, count: 1 });
    }
  }
  return [...tally.values()]
    .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName))
    .map((entry) => entry.displayName);
}
