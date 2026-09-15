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
