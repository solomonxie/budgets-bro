import type { ChatMessage } from './openaiClient';

export type AnalysisKind =
  'spending' | 'variance' | 'forecast' | 'health' | 'comparison';

export const ANALYSIS_KINDS: AnalysisKind[] = [
  'spending',
  'variance',
  'forecast',
  'health',
  'comparison',
];

const SYSTEM_PROMPT =
  "You are a personal finance assistant analyzing one household's own budget data, which they've chosen to share with you. " +
  "Be concise and specific, reference the actual numbers given, and never invent figures that aren't in the data.";

const INSTRUCTION: Record<AnalysisKind, string> = {
  spending:
    'Summarize where the money went this month: the largest categories, anything unusual compared to recent months, and one or two concrete suggestions to reduce discretionary spending.',
  variance:
    'Compare assigned vs. actual spending per category this month. Call out categories significantly over or under budget, and suggest reassignments for next month.',
  forecast:
    "Based on the monthly trend data, project next month's likely spending per category and flag any category trending upward that deserves attention.",
  health:
    "Give an overall financial-health assessment: strengths, risks, and 2-3 concrete next steps. Weigh the net worth (assets vs. debts), this month's spending pattern, and the household profile if one was given (city/country/age/family size) — tailor the advice to their apparent life stage and family size rather than generic tips.",
  comparison:
    "Using your general world knowledge (not live data — you have none), give a rough, approximate comparison of this month's category spending against typical household spending in the stated city, the stated country, and worldwide. If city/country weren't given, compare against general/world figures only. Explicitly label every number you give as an approximate estimate from general knowledge, not a verified statistic, and say so again in your closing line.",
};

export function buildAnalysisMessages(
  kind: AnalysisKind,
  contextText: string,
): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${INSTRUCTION[kind]}\n\nData:\n${contextText}` },
  ];
}

// Only the text read off the receipt on the device is sent, never the photo.
export function buildReceiptMessages(
  rows: string[],
  knownNames: string[],
): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You turn text read from a shopping receipt into a list of items for a personal budget. ' +
        'Reply with JSON only: {"items":[{"name":"...","price":0.00}],"total":0.00}. ' +
        'One entry per product bought, price after any discount printed for it. ' +
        'Leave out tax, fees, deposits, subtotals and payment lines. ' +
        'Names: short and readable, in the language of the receipt, expanding obvious abbreviations ' +
        '(e.g. "ORG GUAC" → "Organic Guacamole"), no item codes. ' +
        'If a product matches one of the known names, use that exact spelling. ' +
        'Use null for total if none is printed. Never invent items.',
    },
    {
      role: 'user',
      content: `Known names: ${knownNames.slice(0, 80).join('; ') || 'none'}\n\nReceipt:\n${rows.join('\n')}`,
    },
  ];
}
