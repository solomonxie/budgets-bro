import type { SQLiteDatabase } from '../../src/db/driver';

// The phone's side of browser sync (docs/design/browser-sync/PROTOCOL.md),
// adapted from Photos Vault's sync.db. Kept in the main DB so a local write
// and its outbox cursor commit together. Install-specific like app_settings:
// never in the backup zip (buildBackup lists its tables) and never in
// change_log (no triggers here).
//
// sync_entity is the merge state as checkpoint lines, read only when a pull
// runs — never at launch.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_applied (
      device TEXT PRIMARY KEY,
      seq INTEGER NOT NULL,
      last_key TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_remote_range (
      lo INTEGER PRIMARY KEY,
      hi INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_sealed (
      seq INTEGER PRIMARY KEY,
      key TEXT NOT NULL,
      bytes BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_entity (
      k TEXT PRIMARY KEY,
      line TEXT NOT NULL,
      conflicted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_sync_entity_conflicted
      ON sync_entity(conflicted) WHERE conflicted = 1;
  `);
}
