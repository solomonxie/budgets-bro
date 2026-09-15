import { runOpenAiCompatibleCompletion } from './openaiCompatibleClient';
import type { ChatMessage } from './types';

const MODEL = 'deepseek-chat';

export async function runChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  return runOpenAiCompatibleCompletion(
    {
      vendorName: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/chat/completions',
      model: MODEL,
    },
    apiKey,
    messages,
  );
}
