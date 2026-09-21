// What a city costs, in eight figures a month — and what that is next to
// what the user actually spends.
//
// There is no free keyless cost-of-living API: Numbeo's is paid per call and
// its terms forbid scraping it, Teleport's is gone. So the page ships with a
// compiled table, clearly dated and clearly labelled an estimate, and offers
// one button to ask the user's own AI connection for a newer read of one
// city. That answer is as current as the model's training, which nobody can
// pin to a date — so it is stored with the model's name and the day it was
// asked, and says so on screen. Neither number is a source of truth; the
// only exact figures on this page are the user's own.

export const COST_OF_LIVING_AS_OF = '2025-06';

export type CostBucket =
  | 'housing'
  | 'groceries'
  | 'diningOut'
  | 'transport'
  | 'utilities'
  | 'internetPhone'
  | 'childcare'
  | 'leisure';

export const COST_BUCKETS: CostBucket[] = [
  'housing',
  'groceries',
  'diningOut',
  'transport',
  'utilities',
  'internetPhone',
  'childcare',
  'leisure',
];

export interface CityCosts {
  id: string;
  /** Currency the figures are in — a city is priced in its own money. */
  currency: string;
  /** Monthly, in the smallest unit of `currency`. */
  monthly: Record<CostBucket, number>;
}

// Monthly figures for one adult household, compiled from published rent and
// price surveys as of COST_OF_LIVING_AS_OF. Round numbers on purpose: these
// are the middle of a wide range, not a quote.
function costs(
  id: string,
  currency: string,
  values: [number, number, number, number, number, number, number, number],
): CityCosts {
  const [housing, groceries, diningOut, transport, utilities, internetPhone, childcare, leisure] =
    values.map((v) => v * 100) as typeof values;
  return {
    id,
    currency,
    monthly: {
      housing,
      groceries,
      diningOut,
      transport,
      utilities,
      internetPhone,
      childcare,
      leisure,
    },
  };
}

export const CITIES: CityCosts[] = [
  costs('vancouver', 'CAD', [2600, 500, 350, 110, 130, 85, 1400, 200]),
  costs('surrey', 'CAD', [2000, 480, 300, 110, 140, 85, 1200, 180]),
  costs('victoria', 'CAD', [2200, 490, 320, 100, 130, 85, 1250, 190]),
  costs('calgary', 'CAD', [1800, 470, 320, 115, 200, 90, 1000, 180]),
  costs('toronto', 'CAD', [2500, 500, 350, 156, 160, 80, 1300, 200]),
  costs('ottawa', 'CAD', [2000, 470, 320, 130, 160, 80, 1200, 180]),
  costs('montreal', 'CAD', [1750, 450, 300, 97, 100, 65, 220, 170]),
  costs('shanghai', 'CNY', [7500, 2500, 1500, 200, 400, 100, 3500, 500]),
  costs('beijing', 'CNY', [7000, 2400, 1400, 200, 400, 100, 3000, 500]),
  costs('shenzhen', 'CNY', [6500, 2300, 1400, 180, 350, 100, 3000, 500]),
  costs('hongkong', 'HKD', [18000, 3500, 2500, 600, 1500, 250, 6000, 1200]),
  costs('singapore', 'SGD', [3500, 500, 400, 120, 200, 45, 1200, 200]),
  costs('tokyo', 'JPY', [150000, 50000, 30000, 12000, 20000, 5000, 40000, 15000]),
  costs('seattle', 'USD', [2200, 500, 400, 99, 200, 70, 1800, 220]),
  costs('newyork', 'USD', [4200, 550, 500, 132, 180, 65, 2000, 250]),
  costs('london', 'GBP', [2200, 300, 300, 180, 220, 32, 1200, 150]),
  costs('sydney', 'AUD', [3000, 600, 400, 200, 220, 80, 2000, 250]),
];

export function cityById(id: string): CityCosts | null {
  return CITIES.find((c) => c.id === id) ?? null;
}

/** An AI-refreshed figure set, kept beside the shipped one rather than over it. */
export interface CityCostsUpdate {
  cityId: string;
  currency: string;
  monthly: Record<CostBucket, number>;
  /** Which model answered, and the day it was asked — not the day it knows. */
  model: string;
  askedOn: string;
}

export interface BucketComparison {
  bucket: CostBucket;
  /** The city's figure, converted to the user's currency. */
  cityCents: number;
  /** What the user actually spends a month on the categories they mapped. */
  yoursCents: number;
  /** Null when nothing is mapped: no claim either way. */
  differenceCents: number | null;
}

export function compareToCity(
  city: Record<CostBucket, number>,
  yoursByBucket: Partial<Record<CostBucket, number>>,
  rateToUserCurrency = 1,
): BucketComparison[] {
  return COST_BUCKETS.map((bucket) => {
    const cityCents = Math.round(city[bucket] * rateToUserCurrency);
    const mapped = yoursByBucket[bucket];
    return {
      bucket,
      cityCents,
      yoursCents: mapped ?? 0,
      differenceCents: mapped == null ? null : mapped - cityCents,
    };
  });
}

export interface ComparisonTotals {
  cityCents: number;
  yoursCents: number;
  differenceCents: number;
  /** Only over the buckets the user actually mapped — the rest prove nothing. */
  comparedBuckets: number;
}

export function comparisonTotals(rows: BucketComparison[]): ComparisonTotals {
  let cityCents = 0;
  let yoursCents = 0;
  let comparedBuckets = 0;
  for (const row of rows) {
    if (row.differenceCents == null) continue;
    cityCents += row.cityCents;
    yoursCents += row.yoursCents;
    comparedBuckets++;
  }
  return {
    cityCents,
    yoursCents,
    differenceCents: yoursCents - cityCents,
    comparedBuckets,
  };
}
