import { AiClientError } from './types';
import type { ChatMessage } from './types';

// Gemini's own request/response shape — system prompts go in a separate
// top-level field (like Anthropic's), and the key is a query param rather
// than a header.
const MODEL = 'gemini-1.5-flash';

export async function runChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  const systemInstruction = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: 'user' as const, parts: [{ text: m.content }] }));

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          ...(systemInstruction
            ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
            : {}),
        }),
      },
    );
  } catch {
    throw new AiClientError('network', 'Network request to Google failed.');
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 403)
      throw new AiClientError('invalid_key', 'Google rejected the API key.');
    if (response.status === 429)
      throw new AiClientError(
        'rate_limited',
        'Google rate-limited this request.',
      );
    throw new AiClientError(
      'unknown',
      `Google request failed (${response.status}).`,
    );
  }

  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string')
    throw new AiClientError(
      'unknown',
      'Unexpected response shape from Google.',
    );
  return text;
}
