import type { SQLiteDatabase } from '../db/driver';
import * as settingsRepo from '../db/repositories/settingsRepo';
import { recordAiRequest } from '../db/repositories/aiRequestsRepo';
import { secureStore } from '../secure/secureStore';
import { runChatCompletion as runOpenAi } from './openaiClient';
import { runChatCompletion as runAnthropic } from './anthropicClient';
import { runChatCompletion as runGoogle } from './googleClient';
import { runChatCompletion as runGroq } from './groqClient';
import { runChatCompletion as runMistral } from './mistralClient';
import { runChatCompletion as runDeepSeek } from './deepseekClient';
import { runChatCompletion as runXai } from './xaiClient';
import type { ChatMessage } from './types';

export type AiVendor =
  'openai' | 'anthropic' | 'google' | 'groq' | 'mistral' | 'deepseek' | 'xai';
export type AiKeyStrategy = 'sequential' | 'round_robin';

// Display name, a short hint about what the key looks like, and where to
// go make one — shown in AiKeyModal so "add a key" doesn't require already
// knowing each vendor's console. keyHint doubles as the field's masked
// placeholder.
export interface AiVendorMeta {
  code: AiVendor;
  name: string;
  keyHint: string;
  docsUrl: string;
}

export const AI_VENDORS: AiVendorMeta[] = [
  {
    code: 'openai',
    name: 'OpenAI',
    keyHint: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    code: 'anthropic',
    name: 'Anthropic',
    keyHint: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    code: 'google',
    name: 'Google Gemini',
    keyHint: 'AIza...',
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  {
    code: 'groq',
    name: 'Groq',
    keyHint: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    code: 'mistral',
    name: 'Mistral',
    keyHint: '...',
    docsUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    code: 'deepseek',
    name: 'DeepSeek',
    keyHint: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    code: 'xai',
    name: 'xAI (Grok)',
    keyHint: 'xai-...',
    docsUrl: 'https://console.x.ai',
  },
];

export function aiVendorName(vendor: AiVendor): string {
  return AI_VENDORS.find((v) => v.code === vendor)?.name ?? vendor;
}

// requestCount is a plain usage counter (every attempt, success or not) —
// shown next to each key in Settings so you can see which ones are
// actually carrying traffic. The prompts and replies behind that number
// are in ai_requests (db/repositories/aiRequestsRepo.ts), readable from the
// key's own detail view. The secret itself lives in secureStore,
// keyed by `id` (see secureStore.getAiKeySecret).
export interface AiKeyMeta {
  id: string;
  vendor: AiVendor;
  requestCount: number;
}

const KEYS_KEY = 'ai_keys';
const STRATEGY_KEY = 'ai_key_strategy';
const CURSOR_KEY = 'ai_key_cursor';

function newKeyId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// One-time migration from the old single-OpenAI-key slot into the new
// list, the first time it's read after this feature shipped.
async function migrateLegacyKey(db: SQLiteDatabase): Promise<AiKeyMeta[]> {
  const existingRaw = await settingsRepo.getSetting(db, KEYS_KEY);
  if (existingRaw != null) return JSON.parse(existingRaw) as AiKeyMeta[];
  const legacySecret = await secureStore.getAiApiKey();
  if (!legacySecret) {
    await settingsRepo.setJsonSetting<AiKeyMeta[]>(db, KEYS_KEY, []);
    return [];
  }
  const id = newKeyId();
  await secureStore.setAiKeySecret(id, legacySecret);
  await secureStore.clearAiApiKey();
  const migrated: AiKeyMeta[] = [{ id, vendor: 'openai', requestCount: 0 }];
  await settingsRepo.setJsonSetting(db, KEYS_KEY, migrated);
  return migrated;
}

export async function listAiKeys(db: SQLiteDatabase): Promise<AiKeyMeta[]> {
  return migrateLegacyKey(db);
}

export async function addAiKey(
  db: SQLiteDatabase,
  vendor: AiVendor,
  secret: string,
): Promise<string> {
  const keys = await listAiKeys(db);
  const id = newKeyId();
  await secureStore.setAiKeySecret(id, secret);
  await settingsRepo.setJsonSetting(db, KEYS_KEY, [
    ...keys,
    { id, vendor, requestCount: 0 },
  ]);
  return id;
}

export async function removeAiKey(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  const keys = await listAiKeys(db);
  await settingsRepo.setJsonSetting(
    db,
    KEYS_KEY,
    keys.filter((k) => k.id !== id),
  );
  await secureStore.clearAiKeySecret(id);
}

// Swaps a key with its neighbor — the reordering UI is a pair of ↑/↓
// buttons per row rather than a drag gesture (simpler to get right inside
// a ScrollView, and just as capable for a handful of keys).
export async function moveAiKey(
  db: SQLiteDatabase,
  id: string,
  direction: -1 | 1,
): Promise<void> {
  const keys = await listAiKeys(db);
  const idx = keys.findIndex((k) => k.id === id);
  const swapWith = idx + direction;
  if (idx < 0 || swapWith < 0 || swapWith >= keys.length) return;
  const next = [...keys];
  [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
  await settingsRepo.setJsonSetting(db, KEYS_KEY, next);
}

async function bumpRequestCount(db: SQLiteDatabase, id: string): Promise<void> {
  const keys = await listAiKeys(db);
  await settingsRepo.setJsonSetting(
    db,
    KEYS_KEY,
    keys.map((k) =>
      k.id === id ? { ...k, requestCount: k.requestCount + 1 } : k,
    ),
  );
}

export async function getAiKeyStrategy(
  db: SQLiteDatabase,
): Promise<AiKeyStrategy> {
  const raw = await settingsRepo.getSetting(db, STRATEGY_KEY);
  return raw === 'round_robin' ? 'round_robin' : 'sequential';
}

export async function setAiKeyStrategy(
  db: SQLiteDatabase,
  strategy: AiKeyStrategy,
): Promise<void> {
  await settingsRepo.setSetting(db, STRATEGY_KEY, strategy);
}

async function getCursor(db: SQLiteDatabase): Promise<number> {
  const raw = await settingsRepo.getSetting(db, CURSOR_KEY);
  return raw ? Number(raw) || 0 : 0;
}

async function setCursor(db: SQLiteDatabase, value: number): Promise<void> {
  await settingsRepo.setSetting(db, CURSOR_KEY, String(value));
}

const VENDOR_RUNNERS: Record<
  AiVendor,
  (secret: string, messages: ChatMessage[]) => Promise<string>
> = {
  openai: runOpenAi,
  anthropic: runAnthropic,
  google: runGoogle,
  groq: runGroq,
  mistral: runMistral,
  deepseek: runDeepSeek,
  xai: runXai,
};

export async function runChatCompletionForVendor(
  vendor: AiVendor,
  secret: string,
  messages: ChatMessage[],
): Promise<string> {
  return VENDOR_RUNNERS[vendor](secret, messages);
}

export class NoAiKeyError extends Error {
  constructor() {
    super('No AI key configured.');
  }
}

// Tries each configured key in turn, starting point depending on the
// chosen strategy, until one succeeds. Sequential is sticky — it keeps
// starting from the same key call after call, only moving the pointer on
// once that key itself errors (rate limit, quota, revoked, ...);
// round-robin instead advances the starting point by one on every single
// call, win or lose, to spread load across keys rather than favor one.
// Either way, a failure falls through to the next configured key before
// giving up, so one dead key doesn't take AI Analysis down entirely.
export async function runWithAiKeys(
  db: SQLiteDatabase,
  messages: ChatMessage[],
): Promise<string> {
  const keys = await listAiKeys(db);
  if (keys.length === 0) throw new NoAiKeyError();
  const strategy = await getAiKeyStrategy(db);
  const startAt = (await getCursor(db)) % keys.length;
  const order = [...keys.slice(startAt), ...keys.slice(0, startAt)];

  if (strategy === 'round_robin')
    await setCursor(db, (startAt + 1) % keys.length);

  let lastError: unknown;
  for (let i = 0; i < order.length; i++) {
    const key = order[i];
    const secret = await secureStore.getAiKeySecret(key.id);
    if (!secret) continue;
    await bumpRequestCount(db, key.id);
    try {
      const response = await runChatCompletionForVendor(
        key.vendor,
        secret,
        messages,
      );
      // Recorded here rather than in each vendor client: this is the one
      // place every call passes through, and it's the only place that knows
      // which key a call actually went out on after fallback.
      await recordAiRequest(db, {
        keyId: key.id,
        vendor: key.vendor,
        messages,
        response,
        error: null,
      });
      return response;
    } catch (err) {
      lastError = err;
      // Failures are kept too — a key that's rate-limited or revoked is
      // exactly what someone opens the history to find out.
      await recordAiRequest(db, {
        keyId: key.id,
        vendor: key.vendor,
        messages,
        response: null,
        error: err instanceof Error ? err.message : String(err),
      });
      if (strategy === 'sequential')
        await setCursor(db, (startAt + i + 1) % keys.length);
    }
  }
  throw lastError ?? new NoAiKeyError();
}
