import { parseMoneyToCents } from './money';

// What was in the bag, when the total alone doesn't say it: a short list of
// `key=value` pairs — `Oil=8.40, Beef=12.99, Warranty=2 years` — kept in one
// TEXT column rather than a child table or JSON. It is only ever read whole,
// and living in the row means every query, backup and restore already carries
// it.
//
// There is no escaping scheme. A comma or an equals sign inside a key or a
// value would be indistinguishable from a separator, so both are removed on
// the way in — which is why format/parse round-trips exactly and a hand-typed
// value can never corrupt the row next to it.

export interface PurchaseItem {
  key: string;
  value: string;
}

const PAIR_SEPARATOR = ', ';

function clean(text: string): string {
  return text.replace(/[,=]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Forgiving on the way out of the database: a pair with no `=` is a key with
// no value (someone typed "Milk, Bread"), and a pair with no key is dropped —
// a value alone names nothing.
export function parsePurchaseItems(stored: string | null | undefined): PurchaseItem[] {
  if (!stored) return [];
  return stored
    .split(',')
    .map((part) => {
      const split = part.indexOf('=');
      return {
        key: clean(split === -1 ? part : part.slice(0, split)),
        value: split === -1 ? '' : clean(part.slice(split + 1)),
      };
    })
    .filter((item) => item.key !== '');
}

// Null rather than '' for an empty list, so the column reads as "nothing here"
// the same way memo does.
export function formatPurchaseItems(items: PurchaseItem[]): string | null {
  const pairs = items
    .map((item) => ({ key: clean(item.key), value: clean(item.value) }))
    .filter((item) => item.key !== '')
    .map((item) => `${item.key}=${item.value}`);
  return pairs.length > 0 ? pairs.join(PAIR_SEPARATOR) : null;
}

export function purchaseItemCount(stored: string | null | undefined): number {
  return parsePurchaseItems(stored).length;
}

// A pair whose value is money is a priced item, and those are what the
// purchase insights can rank and chart. Anything else (`Warranty=2 years`)
// still shows and still round-trips, it just isn't a data point — so this
// answers "is it a price?" rather than parseMoneyToCents's "give me a number
// either way".
export function itemPriceCents(value: string): number | null {
  const digitsOnly = value.replace(/[\s,$¥￥€£]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(digitsOnly)) return null;
  return parseMoneyToCents(value);
}

export function pricedPurchaseItems(
  stored: string | null | undefined,
): { key: string; priceCents: number }[] {
  return parsePurchaseItems(stored)
    .map((item) => ({ key: item.key, priceCents: itemPriceCents(item.value) }))
    .filter((item): item is { key: string; priceCents: number } => item.priceCents !== null);
}
