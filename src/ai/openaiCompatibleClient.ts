import { AiClientError } from './types';
import type { ChatMessage } from './types';

// Several vendors (OpenAI itself, Groq, Mistral, DeepSeek, xAI) expose the
// same `/chat/completions` request/response shape — this is that shared
// implementation, parameterized by endpoint/model/display name, so each
// vendor's own client file is just a one-line config.
export interface OpenAiCompatibleConfig {
  vendorName: string;
  endpoint: string;
  model: string;
}

export async function runOpenAiCompatibleCompletion(
  config: OpenAiCompatibleConfig,
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: config.model, messages, temperature: 0.3 }),
    });
  } catch {
    throw new AiClientError(
      'network',
      `Network request to ${config.vendorName} failed.`,
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new AiClientError(
        'invalid_key',
        `${config.vendorName} rejected the API key.`,
      );
    if (response.status === 429)
      throw new AiClientError(
        'rate_limited',
        `${config.vendorName} rate-limited this request.`,
      );
    throw new AiClientError(
      'unknown',
      `${config.vendorName} request failed (${response.status}).`,
    );
  }

  const json = await response.json();
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string')
    throw new AiClientError(
      'unknown',
      `Unexpected response shape from ${config.vendorName}.`,
    );
  return text;
}
