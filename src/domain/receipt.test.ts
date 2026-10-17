import {
  matchKnownNames,
  parseReceipt,
  receiptFromAiReply,
  receiptRows,
  tidyItemName,
} from './receipt';

const COSTCO = [
  'COSTCO',
  'WHOLESALE',
  'Port Coquitlam #255',
  '2370 Ottawa St.',
  'JR Member 111998625563',
  '458287 CRETORS MIX  9.49 G',
  '1684499 KS DISH  10.99 GP',
  '1933211 WITOR TRUF  19.99 G',
  '0000390133 /1933211  5.00-G',
  '457 HOMO MILK  6.11',
  'ENVIRO FEE C  0.07',
  'DEPOSIT CL  0.10',
  '438342 ORG GUAC  15.99',
  '0000390120 / 438342  4.00-',
  '55503 B/S BREASTS  38.29',
  '0000395382 / 55503  5.00-',
  'SUBTOTAL  410.08',
  'TAX  12.31',
  '**** TOTAL  422.39',
  'AMOUNT: $422.39',
];

describe('parseReceipt', () => {
  it('gives store abbreviations a general name', () => {
    expect(
      parseReceipt([
        '22057 SIRLOIN TIP  89.77',
        '55501 THIGHS  25.30',
        '7771713 KS T-SHIRT  28.99 GP',
        '1555495 DOVE ORIG  19.99 GP',
        '1426812 CREST  15.99 GP',
        '9999 XYZ GADGET  5.00',
      ]).items.map((i) => i.name),
    ).toEqual([
      'Beef Top Sirloin',
      'Chicken Thighs',
      'Clothes',
      'Skin Care',
      'Personal Care',
      'Xyz Gadget',
    ]);
  });

  it('reads a Costco receipt: codes stripped, discounts applied, fees and tax left out', () => {
    expect(parseReceipt(COSTCO)).toEqual({
      items: [
        { name: 'Popcorn', priceCents: 949 },
        { name: 'Household Supplies', priceCents: 1099 },
        { name: 'Chocolate', priceCents: 1499 },
        { name: 'Milk', priceCents: 611 },
        { name: 'Guacamole', priceCents: 1199 },
        { name: 'Chicken Breast', priceCents: 3329 },
      ],
      totalCents: 42239,
    });
  });

  it('falls back to the amount line when the total line is unreadable', () => {
    expect(parseReceipt(['MILK 4.00', 'AMOUNT: $4.00']).totalCents).toBe(400);
  });

  it('takes a name from the line above a quantity line', () => {
    expect(parseReceipt(['BANANAS', '2 @ 0.59  1.18']).items).toEqual([
      { name: 'Bananas', priceCents: 118 },
    ]);
  });

  it('applies an unreferenced discount to the item before it', () => {
    expect(parseReceipt(['Bread  3.50', 'Coupon  -1.00']).items).toEqual([
      { name: 'Bread', priceCents: 250 },
    ]);
  });

  it('reads Chinese receipts', () => {
    expect(parseReceipt(['牛奶  12.50', '鸡蛋  ¥18.00', '合计  30.50'])).toEqual({
      items: [
        { name: 'Milk', priceCents: 1250 },
        { name: 'Eggs', priceCents: 1800 },
      ],
      totalCents: 3050,
    });
  });
});

describe('receiptRows', () => {
  it('joins pieces on one line, left to right, top to bottom', () => {
    expect(
      receiptRows([
        { text: '9.49', x: 0.8, y: 0.101, w: 0.1, h: 0.02 },
        { text: 'MILK', x: 0.1, y: 0.2, w: 0.2, h: 0.02 },
        { text: 'CRETORS MIX', x: 0.1, y: 0.1, w: 0.3, h: 0.02 },
        { text: '6.11', x: 0.8, y: 0.198, w: 0.1, h: 0.02 },
      ]),
    ).toEqual(['CRETORS MIX  9.49', 'MILK  6.11']);
  });
});

describe('tidyItemName', () => {
  it('title-cases shouting but keeps short codes and mixed case', () => {
    expect(tidyItemName('KS ORG SYRUP')).toBe('KS Org Syrup');
    expect(tidyItemName('Olive Oil, 1L')).toBe('Olive Oil 1L');
  });
});

describe('matchKnownNames', () => {
  it('reuses an existing spelling', () => {
    expect(matchKnownNames([{ name: 'Homo Milk', priceCents: 611 }], ['homo milk'])).toEqual([
      { name: 'homo milk', priceCents: 611 },
    ]);
  });
});

describe('receiptFromAiReply', () => {
  it('reads JSON inside a code fence', () => {
    expect(
      receiptFromAiReply('```json\n{"items":[{"name":"Milk","price":6.11}],"total":6.11}\n```'),
    ).toEqual({ items: [{ name: 'Milk', priceCents: 611 }], totalCents: 611 });
  });

  it('returns null for prose', () => {
    expect(receiptFromAiReply('Sorry, I cannot read that.')).toBeNull();
  });
});
