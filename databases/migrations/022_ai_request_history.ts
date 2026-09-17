import type { SQLiteDatabase } from 'expo-sqlite';

// Every AI call's exact prompt and reply, so "what did this key actually
// send?" has an answer. The app's pitch is that budget data leaves the
// device only on an explicit Run Analysis, straight to the user's own
// vendor — that claim was previously unauditable from inside the app, and
// the vendor dashboards it points at show token counts, not content.
//
// Deliberately not board-scoped: sync/buildBackup.ts dumps board-owned
// tables only, so this history stays on the device it was made on and
// never rides along in a backup that lands in iCloud or a bucket.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE ai_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_id TEXT NOT NULL,
      vendor TEXT NOT NULL,
      messages TEXT NOT NULL,
      response TEXT,
      error TEXT,
      created_at TEXT NOT NULL
    );
  `);
  await db.execAsync(
    'CREATE INDEX idx_ai_requests_key ON ai_requests (key_id, id DESC);',
  );
}
