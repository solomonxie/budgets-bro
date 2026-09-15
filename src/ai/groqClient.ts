import { runOpenAiCompatibleCompletion } from './openaiCompatibleClient';
import type { ChatMessage } from './types';

const MODEL = 'llama-3.1-8b-instant';

export async function runChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  return runOpenAiCompatibleCompletion(
    {
      vendorName: 'Groq',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      model: MODEL,
    },
    apiKey,
    messages,
  );
}
