import type { TranslationKey } from '../i18n';

// Every code the ECB publishes opens with its country's ISO-3166 pair, so
// the flag is the code itself shifted into regional-indicator letters. No
// image set, nothing in the bundle, and EUR lands on 🇪🇺 for free.
export function currencyFlag(code: string): string {
  return String.fromCodePoint(
    ...[...code.slice(0, 2).toUpperCase()].map(
      (letter) => 0x1f1e6 + letter.charCodeAt(0) - 65,
    ),
  );
}

export function currencyNameKey(code: string): TranslationKey {
  return `currency.${code}` as TranslationKey;
}

// The glyph people recognise the money by, not a unique one: four of these
// are "$" and two are "¥". It sits beside the code, which is what actually
// tells them apart.
const SYMBOLS: Record<string, string> = {
  CAD: '$',
  USD: '$',
  CNY: '¥',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  HKD: '$',
  AUD: '$',
  CHF: 'Fr',
  SGD: '$',
  KRW: '₩',
  INR: '₹',
  NZD: '$',
  MXN: '$',
  BRL: 'R$',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  TRY: '₺',
  ZAR: 'R',
  THB: '฿',
  MYR: 'RM',
  IDR: 'Rp',
  PHP: '₱',
  ILS: '₪',
  RON: 'lei',
  BGN: 'лв',
  ISK: 'kr',
};

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? code;
}
