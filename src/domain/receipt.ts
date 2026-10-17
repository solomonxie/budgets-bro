// A receipt photo, read on the device (modules/receipt-scanner), turned into
// purchase items: one priced row per thing bought, discounts taken off the
// item they name, and the total when the receipt prints one. Tax, fees and
// deposits are not things anyone tracks the price of, so they are left out.
// Items get a general name ("Chicken Breast", not "B/S BREASTS"), because
// every store abbreviates differently and a price is only comparable across
// stores under one name.

export interface ScannedText {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ReceiptItem {
  name: string;
  priceCents: number;
}

export interface Receipt {
  items: ReceiptItem[];
  totalCents: number | null;
}

// Vision returns the name and the price columns as separate pieces; pieces
// whose vertical centres sit within half a line of each other are one row.
export function receiptRows(texts: ScannedText[]): string[] {
  if (texts.length === 0) return [];
  const heights = texts.map((t) => t.h).sort((a, b) => a - b);
  const tolerance = heights[Math.floor(heights.length / 2)] / 2;
  const rows: { centre: number; pieces: ScannedText[] }[] = [];
  for (const piece of [...texts].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2))) {
    const centre = piece.y + piece.h / 2;
    const row = rows.find((r) => Math.abs(r.centre - centre) <= tolerance);
    if (row) row.pieces.push(piece);
    else rows.push({ centre, pieces: [piece] });
  }
  return rows.map((r) =>
    r.pieces
      .sort((a, b) => a.x - b.x)
      .map((p) => p.text.trim())
      .join('  '),
  );
}

const PRICE_AT_END = /(-)?\s*[$¥￥€£]?\s*(\d{1,6}[.,]\d{2})\s*(-)?\s*-?\s*[A-Z*]{0,3}\s*$/;
const TOTAL = /(^|[^A-Z])(TOTAL|AMOUNT|BALANCE DUE)\b|合计|总计|实付|应付/i;
const SUBTOTAL = /SUB\s*-?\s*TOTAL|小计/i;
const NOT_AN_ITEM =
  /\b(TAX|GST|PST|HST|QST|VAT|FEE|DEPOSIT|ENVIRO|ECO|LEVY|BOTTLE|CHANGE|CASH|GRATUITY|ROUNDING)\b|税|找零|押金/i;
const QUANTITY = /@|\d\s*(kg|lb|g)\b|^\s*\d+\s*x\b/i;
const LEADING_CODE = /^(?:[A-Z]\s+)?\d{3,}\s+/;
const REFERENCE = /\/\s*(\d{3,})/;

function toCents(digits: string): number {
  return Math.round(Number(digits.replace(',', '.')) * 100);
}

function hasLetters(text: string): boolean {
  return /[A-Za-z一-鿿]/.test(text);
}

// "B/S BREASTS" → "B/S Breasts": short words are usually brands or codes.
export function tidyItemName(raw: string): string {
  const name = raw.replace(/[,=]/g, ' ').replace(/\s+/g, ' ').trim();
  if (name !== name.toUpperCase()) return name;
  return name
    .split(' ')
    .map((word) =>
      word.length <= 2 || /[\d/]/.test(word)
        ? word
        : word[0] + word.slice(1).toLowerCase(),
    )
    .join(' ');
}

// Food specific enough to compare a price (cut and animal); everything else
// one broad category. First match wins, so specific patterns go first.
const GENERAL_NAMES: [RegExp, string][] = [
  [/BREAST|鸡胸/i, 'Chicken Breast'],
  [/THIGH|鸡腿/i, 'Chicken Thighs'],
  [/WING|鸡翅/i, 'Chicken Wings'],
  [/DRUMSTICK/i, 'Chicken Drumsticks'],
  [/WHOLE CHICKEN|ROTISSERIE/i, 'Whole Chicken'],
  [/SIRLOIN/i, 'Beef Top Sirloin'],
  [/BRISKET|牛腩/i, 'Beef Brisket'],
  [/SHANK|牛腱/i, 'Beef Shank'],
  [/RIB ?EYE/i, 'Beef Ribeye'],
  [/STRIPLOIN|NY STRIP/i, 'Beef Striploin'],
  [/GR(OU)?ND BEEF|LEAN GRND|牛肉末/i, 'Ground Beef'],
  [/PORK BELLY|五花/i, 'Pork Belly'],
  [/PORK CHOP/i, 'Pork Chops'],
  [/GR(OU)?ND PORK|猪肉末/i, 'Ground Pork'],
  [/SALMON|三文鱼/i, 'Salmon'],
  [/SHRIMP|PRAWN|虾/i, 'Shrimp'],
  [/MILK|牛奶/i, 'Milk'],
  [/\bEGGS?\b|鸡蛋/i, 'Eggs'],
  [/BUTTER/i, 'Butter'],
  [/CHEESE|CASTELLO|PARM|CHEDDAR|BRIE/i, 'Cheese'],
  [/YOG(H)?URT|酸奶/i, 'Yogurt'],
  [/BREAD|BAGEL|面包/i, 'Bread'],
  [/GRAPE/i, 'Grapes'],
  [/BANANA|香蕉/i, 'Bananas'],
  [/STRAWBERR/i, 'Strawberries'],
  [/BLUEBERR/i, 'Blueberries'],
  [/AVOCADO/i, 'Avocados'],
  [/GUAC/i, 'Guacamole'],
  [/\bRICE\b|大米/i, 'Rice'],
  [/POPCORN|CRETORS/i, 'Popcorn'],
  [/TRUF|CHOC/i, 'Chocolate'],
  [/SYRUP/i, 'Syrup'],
  [/PROBIOTIC|VITAMIN|OMEGA|SUPPLEMENT/i, 'Supplements'],
  [/T-?SHIRT|SHIRT|PANTS?\b|JEANS|SOCKS?|JACKET|HOODIE|DRESS|SWEATER|UNDERWEAR|衣|裤/i, 'Clothes'],
  [/LOTION|MOISTUR|SUNSCREEN|CLEANSER|SHAVE|DOVE|SERUM|护肤/i, 'Skin Care'],
  [/CREST|COLGATE|TOOTHPASTE|SHAMPOO|CONDITIONER|DEODORANT|牙膏|洗发/i, 'Personal Care'],
  [/DISH|DETERGENT|TISSUE|PAPER TOWEL|TRASH BAG|GARBAGE BAG|CLEANER|纸巾/i, 'Household Supplies'],
  [/BULB|FILTER|PAINT|SCREW|BATTER(Y|IES)|CAULK|TOOL/i, 'Home Maintenance'],
];

export function generalItemName(raw: string): string {
  return GENERAL_NAMES.find(([pattern]) => pattern.test(raw))?.[1] ?? tidyItemName(raw);
}

export function parseReceipt(rows: string[]): Receipt {
  const items: (ReceiptItem & { code: string | null })[] = [];
  let totalCents: number | null = null;
  let totalFromTotalLine = false;
  let itemsDone = false;
  let pendingName: string | null = null;

  for (const row of rows) {
    const match = row.match(PRICE_AT_END);
    if (!match) {
      const name = row.replace(LEADING_CODE, '').trim();
      pendingName =
        !itemsDone && hasLetters(name) && !NOT_AN_ITEM.test(name) ? name : null;
      continue;
    }
    const cents = toCents(match[2]);
    const label = row.slice(0, match.index).trim();

    if (SUBTOTAL.test(label)) {
      itemsDone = true;
    } else if (TOTAL.test(label)) {
      itemsDone = true;
      const isTotalLine = /TOTAL|合计|总计/i.test(label);
      if (isTotalLine ? !totalFromTotalLine : totalCents == null) totalCents = cents;
      totalFromTotalLine ||= isTotalLine;
    } else if (itemsDone || NOT_AN_ITEM.test(label)) {
      // Payment and tax lines.
    } else if (match[1] || match[3]) {
      const ref = label.match(REFERENCE)?.[1];
      const target = (ref && items.find((i) => i.code === ref)) || items.at(-1);
      if (target) target.priceCents = Math.max(0, target.priceCents - cents);
    } else if (QUANTITY.test(label) || !hasLetters(label)) {
      if (pendingName) items.push({ name: pendingName, priceCents: cents, code: null });
    } else {
      items.push({
        name: label.replace(LEADING_CODE, ''),
        priceCents: cents,
        code: label.match(/\d{3,}/)?.[0] ?? null,
      });
    }
    pendingName = null;
  }

  return {
    items: items
      .map((i) => ({ name: generalItemName(i.name), priceCents: i.priceCents }))
      .filter((i) => i.name !== ''),
    totalCents,
  };
}

// Prefer the spelling already used on the board, so a scanned "HOMO MILK"
// lands on the same tracked item as a typed "Homo Milk".
export function matchKnownNames(items: ReceiptItem[], known: string[]): ReceiptItem[] {
  const byKey = new Map(known.map((name) => [name.trim().toLowerCase(), name]));
  return items.map((i) => ({ ...i, name: byKey.get(i.name.toLowerCase()) ?? i.name }));
}

// The AI's answer: JSON, possibly wrapped in prose or a code fence.
export function receiptFromAiReply(reply: string): Receipt | null {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const data = JSON.parse(reply.slice(start, end + 1));
    if (!Array.isArray(data.items)) return null;
    const items = data.items
      .map((i: { name?: unknown; price?: unknown }) => ({
        name: typeof i.name === 'string' ? tidyItemName(i.name) : '',
        priceCents: typeof i.price === 'number' ? Math.round(i.price * 100) : NaN,
      }))
      .filter((i: ReceiptItem) => i.name !== '' && Number.isFinite(i.priceCents) && i.priceCents >= 0);
    const total = typeof data.total === 'number' ? Math.round(data.total * 100) : null;
    return { items, totalCents: total };
  } catch {
    return null;
  }
}
