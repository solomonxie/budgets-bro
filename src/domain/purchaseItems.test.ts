import {
  formatPurchaseItems,
  itemPriceCents,
  parsePurchaseItems,
  pricedPurchaseItems,
  purchaseItemCount,
} from './purchaseItems';

describe('purchaseItems', () => {
  it('round-trips a typed list', () => {
    const items = [
      { key: 'Oil', value: '8.40' },
      { key: 'Beef', value: '12.99' },
    ];
    const stored = formatPurchaseItems(items);
    expect(stored).toBe('Oil=8.40, Beef=12.99');
    expect(parsePurchaseItems(stored)).toEqual(items);
  });

  it('is null for an empty list, and empty for a null column', () => {
    expect(formatPurchaseItems([])).toBeNull();
    expect(formatPurchaseItems([{ key: '  ', value: '1' }])).toBeNull();
    expect(parsePurchaseItems(null)).toEqual([]);
    expect(parsePurchaseItems('')).toEqual([]);
  });

  it('strips the separators out instead of escaping them', () => {
    const stored = formatPurchaseItems([
      { key: 'Beef, minced', value: '1,234.50' },
      { key: 'Note=this', value: 'a=b' },
    ]);
    expect(stored).toBe('Beef minced=1 234.50, Note this=a b');
    expect(parsePurchaseItems(stored)).toHaveLength(2);
  });

  it('reads a pair with no value, and drops one with no key', () => {
    expect(parsePurchaseItems('Milk, Bread=')).toEqual([
      { key: 'Milk', value: '' },
      { key: 'Bread', value: '' },
    ]);
    expect(parsePurchaseItems('=9.99, Oil=8.40')).toEqual([{ key: 'Oil', value: '8.40' }]);
  });

  it('counts what it parses', () => {
    expect(purchaseItemCount('Oil=8.40, Beef=12.99')).toBe(2);
    expect(purchaseItemCount(null)).toBe(0);
  });

  it('tells a price from free text', () => {
    expect(itemPriceCents('8.40')).toBe(840);
    expect(itemPriceCents('$1,234.56')).toBe(123456);
    expect(itemPriceCents('1 234.50')).toBe(123450);
    expect(itemPriceCents('-3')).toBe(-300);
    expect(itemPriceCents('2 years')).toBeNull();
    expect(itemPriceCents('')).toBeNull();
    expect(itemPriceCents('about 9')).toBeNull();
  });

  it('keeps only priced pairs for the analysis', () => {
    expect(pricedPurchaseItems('Oil=8.40, Warranty=2 years, Beef=12.99')).toEqual([
      { key: 'Oil', priceCents: 840 },
      { key: 'Beef', priceCents: 1299 },
    ]);
  });
});
