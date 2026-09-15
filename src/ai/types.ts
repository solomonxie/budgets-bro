// Shared across every vendor client (openaiClient.ts, anthropicClient.ts,
// googleClient.ts, openaiCompatibleClient.ts's Groq/Mistral/DeepSeek/xAI
// configs) so none of them import from one another.

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export type AiClientErrorCode =
  'invalid_key' | 'rate_limited' | 'network' | 'unknown';

export class AiClientError extends Error {
  code: AiClientErrorCode;
  constructor(code: AiClientErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
