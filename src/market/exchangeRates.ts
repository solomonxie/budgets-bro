// Exchange rates from Frankfurter (frankfurter.app), which republishes the
// European Central Bank's daily reference rates. Chosen for what it does not
// need: no account, no API key, no attribution header, https only, and one
// request returns a whole five-year series.
//
// This is the only outbound request the app makes that isn't the user's own
// AI provider or their own cloud storage — and it carries nothing but two
// currency codes and a date range. Nothing about the user's money is in it,
// and nothing comes back but public rates.

export const FX_HOST = 'https://api.frankfurter.app';

// ECB's published set, minus the ones nobody here would convert between.
// The order is "most likely first" — a picker sorted alphabetically puts
// AUD above CAD, which is wrong for everybody using this.
export const FX_CURRENCIES = [
  'CAD',
  'USD',
  'CNY',
  'EUR',
  'GBP',
  'JPY',
  'HKD',
  'AUD',
  'CHF',
  'SGD',
  'KRW',
  'INR',
  'NZD',
  'MXN',
  'BRL',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'TRY',
  'ZAR',
  'THB',
  'MYR',
  'IDR',
  'PHP',
  'ILS',
  'RON',
  'BGN',
  'ISK',
] as const;

export type FxCurrency = (typeof FX_CURRENCIES)[number];

export interface RatePoint {
  /** YYYY-MM-DD, as published. Weekends and holidays simply aren't there. */
  date: string;
  rate: number;
}

interface SeriesResponse {
  base: string;
  rates: Record<string, Record<string, number>>;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

/** Every published rate for the pair from `startDate` to today, oldest first. */
export async function fetchSeries(
  from: string,
  to: string,
  startDate: string,
): Promise<RatePoint[]> {
  if (from === to) return [];
  const data = await getJson<SeriesResponse>(
    `${FX_HOST}/${startDate}..?from=${from}&to=${to}`,
  );
  return Object.entries(data.rates)
    .map(([date, rates]) => ({ date, rate: rates[to] }))
    .filter((point) => typeof point.rate === 'number')
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function fiveYearsAgoISO(todayISO: string): string {
  const [y, m, d] = todayISO.split('-').map(Number);
  return new Date(Date.UTC(y - 5, m - 1, d)).toISOString().slice(0, 10);
}
