import { runOpenAiCompatibleCompletion } from './openaiCompatibleClient';
import type { ChatMessage } from './types';

export { AiClientError } from './types';
export type { AiClientErrorCode, ChatMessage } from './types';

// Cheap and fast enough for a short analysis of a household's own budget
// data — not a hard requirement, just a reasonable default. `apiKey` comes
// from one of Settings' AI Keys (see ai/aiKeys.ts); this function never
// persists it.
const MODEL = 'gpt-4o-mini';

export async function runChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  return runOpenAiCompatibleCompletion(
    {
      vendorName: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: MODEL,
    },
    apiKey,
    messages,
  );
}
