import { runOpenAiCompatibleCompletion } from './openaiCompatibleClient';
import type { ChatMessage } from './types';

const MODEL = 'mistral-small-latest';

export async function runChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  return runOpenAiCompatibleCompletion(
    {
      vendorName: 'Mistral',
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
      model: MODEL,
    },
    apiKey,
    messages,
  );
}
