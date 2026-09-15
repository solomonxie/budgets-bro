import { runOpenAiCompatibleCompletion } from './openaiCompatibleClient';
import type { ChatMessage } from './types';

// Best-effort default model id — xAI's lineup moves fast; update this if it
// ever 404s (grok-2-latest is xAI's own "-latest" alias convention).
const MODEL = 'grok-2-latest';

export async function runChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  return runOpenAiCompatibleCompletion(
    {
      vendorName: 'xAI',
      endpoint: 'https://api.x.ai/v1/chat/completions',
      model: MODEL,
    },
    apiKey,
    messages,
  );
}
