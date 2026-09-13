// Hand-rolled `fetch` call, no SDK — same choice as sync/s3Provider.ts's
// own SigV4 signing instead of pulling in the AWS SDK: one endpoint, not
// worth a dependency.

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export type AiClientErrorCode = 'invalid_key' | 'rate_limited' | 'network' | 'unknown';

export class AiClientError extends Error {
  code: AiClientErrorCode;
  constructor(code: AiClientErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

// Cheap and fast enough for a short analysis of a household's own budget
// data — not a hard requirement, just a reasonable default. `apiKey` comes
// from secureStore (see Settings' OpenAI section); this function never
// persists it.
const MODEL = 'gpt-4o-mini';

export async function runChatCompletion(apiKey: string, messages: ChatMessage[]): Promise<string> {
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.3 }),
    });
  } catch {
    throw new AiClientError('network', 'Network request to OpenAI failed.');
  }

  if (!response.ok) {
    if (response.status === 401) throw new AiClientError('invalid_key', 'OpenAI rejected the API key.');
    if (response.status === 429) throw new AiClientError('rate_limited', 'OpenAI rate-limited this request.');
    throw new AiClientError('unknown', `OpenAI request failed (${response.status}).`);
  }

  const json = await response.json();
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new AiClientError('unknown', 'Unexpected response shape from OpenAI.');
  return text;
}
