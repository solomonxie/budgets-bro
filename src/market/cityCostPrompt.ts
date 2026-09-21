import { COST_BUCKETS } from './costOfLiving';
import type { CostBucket } from './costOfLiving';

// Asking an AI for a city's costs is asking for a number it half-remembers.
// Two things make that useful rather than misleading: the reply must be a
// bare JSON object (so it can be checked rather than read), and whatever
// comes back is stored with the model's name and the date it was asked —
// never presented as measured data.

export function cityCostPrompt(cityName: string, currency: string): string {
  return [
    `Typical monthly living costs for one adult in ${cityName}, in ${currency}.`,
    'Answer with a JSON object only — no prose, no code fence, no units.',
    'Keys, all required, each a plain number of whole currency units per month:',
    '- housing: rent for a one-bedroom apartment, city centre',
    '- groceries: food bought to cook at home',
    '- diningOut: restaurants, cafés, takeaway',
    '- transport: a monthly transit pass, or equivalent running costs',
    '- utilities: electricity, heating, water, refuse',
    '- internetPhone: home internet plus a mobile plan',
    '- childcare: full-time daycare for one preschool child',
    '- leisure: gym, cinema, hobbies',
    'Use the middle of the usual range. If you are unsure of a figure, still give your best estimate.',
  ].join('\n');
}

/**
 * Pulls the object out of whatever the model wrapped it in, and keeps only
 * finite positive numbers for keys we asked about. A missing or nonsense
 * bucket is dropped rather than defaulted — a zero would read as "free".
 */
export function parseCityCostReply(
  reply: string,
): Partial<Record<CostBucket, number>> | null {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const raw = parsed as Record<string, unknown>;
  const out: Partial<Record<CostBucket, number>> = {};
  for (const bucket of COST_BUCKETS) {
    const value = raw[bucket];
    const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
    if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
      out[bucket] = Math.round(amount * 100);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
