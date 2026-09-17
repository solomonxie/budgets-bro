import type { SQLiteDatabase } from 'expo-sqlite';
import type { ChatMessage } from '../../ai/types';

// Per key, not global: the history is read from one key's detail view, and
// a key that's been deleted takes its history with it. Old enough entries
// are dropped on write rather than by a sweep elsewhere — nothing else runs
// often enough to be a reliable place to trim from.
const KEEP_PER_KEY = 50;

export interface AiRequestRow {
  id: number;
  key_id: string;
  vendor: string;
  messages: string;
  response: string | null;
  error: string | null;
  created_at: string;
}

export interface AiRequest {
  id: number;
  vendor: string;
  messages: ChatMessage[];
  response: string | null;
  error: string | null;
  createdAt: string;
}

function mapRow(row: AiRequestRow): AiRequest {
  let messages: ChatMessage[];
  try {
    messages = JSON.parse(row.messages) as ChatMessage[];
  } catch {
    // Stored shape changed, or the row predates it — show it as one blob
    // rather than dropping the entry.
    messages = [{ role: 'user', content: row.messages }];
  }
  return {
    id: row.id,
    vendor: row.vendor,
    messages,
    response: row.response,
    error: row.error,
    createdAt: row.created_at,
  };
}

export async function recordAiRequest(
  db: SQLiteDatabase,
  entry: {
    keyId: string;
    vendor: string;
    messages: ChatMessage[];
    response: string | null;
    error: string | null;
  },
): Promise<void> {
  await db.runAsync(
    'INSERT INTO ai_requests (key_id, vendor, messages, response, error, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    entry.keyId,
    entry.vendor,
    JSON.stringify(entry.messages),
    entry.response,
    entry.error,
    new Date().toISOString(),
  );
  await db.runAsync(
    `DELETE FROM ai_requests WHERE key_id = ? AND id NOT IN (
       SELECT id FROM ai_requests WHERE key_id = ? ORDER BY id DESC LIMIT ?
     )`,
    entry.keyId,
    entry.keyId,
    KEEP_PER_KEY,
  );
}

export async function listAiRequests(
  db: SQLiteDatabase,
  keyId: string,
): Promise<AiRequest[]> {
  const rows = await db.getAllAsync<AiRequestRow>(
    'SELECT * FROM ai_requests WHERE key_id = ? ORDER BY id DESC',
    keyId,
  );
  return rows.map(mapRow);
}

export async function clearAiRequests(
  db: SQLiteDatabase,
  keyId: string,
): Promise<void> {
  await db.runAsync('DELETE FROM ai_requests WHERE key_id = ?', keyId);
}
