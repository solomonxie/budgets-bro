import type { SQLiteDatabase } from 'expo-sqlite';

// Generic key/value store for small cross-screen state that doesn't warrant
// its own table (e.g. which account is the emergency fund, Baby Steps
// checkbox state). Values are caller-defined strings (often JSON).
export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

export async function getJsonSetting<T>(db: SQLiteDatabase, key: string, fallback: T): Promise<T> {
  const raw = await getSetting(db, key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJsonSetting<T>(db: SQLiteDatabase, key: string, value: T): Promise<void> {
  await setSetting(db, key, JSON.stringify(value));
}
