import type { ChatMessage } from './openaiClient';
import { AiClientError } from './openaiClient';

// Second vendor for AI Keys' multi-provider support — same hand-rolled
// `fetch` choice as openaiClient.ts. Anthropic's Messages API takes system
// prompts as a separate top-level field, not a message role, so those get
// pulled out of `messages` before sending.
const MODEL = 'claude-haiku-4-5-20251001';
const API_VERSION = '2023-06-01';

export async function runChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  const system =
    messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n') || undefined;
  const userMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: 'user' as const, content: m.content }));

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages: userMessages,
      }),
    });
  } catch {
    throw new AiClientError('network', 'Network request to Anthropic failed.');
  }

  if (!response.ok) {
    if (response.status === 401)
      throw new AiClientError('invalid_key', 'Anthropic rejected the API key.');
    if (response.status === 429)
      throw new AiClientError(
        'rate_limited',
        'Anthropic rate-limited this request.',
      );
    throw new AiClientError(
      'unknown',
      `Anthropic request failed (${response.status}).`,
    );
  }

  const json = await response.json();
  const text = json?.content?.[0]?.text;
  if (typeof text !== 'string')
    throw new AiClientError(
      'unknown',
      'Unexpected response shape from Anthropic.',
    );
  return text;
}
