import type { ChatMessage } from './openaiClient';

export type AnalysisKind = 'spending' | 'variance' | 'forecast';

export const ANALYSIS_KINDS: AnalysisKind[] = ['spending', 'variance', 'forecast'];

const SYSTEM_PROMPT =
  "You are a personal finance assistant analyzing one household's own budget data, which they've chosen to share with you. " +
  'Be concise and specific, reference the actual numbers given, and never invent figures that aren\'t in the data.';

const INSTRUCTION: Record<AnalysisKind, string> = {
  spending:
    'Summarize where the money went this month: the largest categories, anything unusual compared to recent months, and one or two concrete suggestions to reduce discretionary spending.',
  variance:
    'Compare assigned vs. actual spending per category this month. Call out categories significantly over or under budget, and suggest reassignments for next month.',
  forecast:
    "Based on the monthly trend data, project next month's likely spending per category and flag any category trending upward that deserves attention.",
};

export function buildAnalysisMessages(kind: AnalysisKind, contextText: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${INSTRUCTION[kind]}\n\nData:\n${contextText}` },
  ];
}
