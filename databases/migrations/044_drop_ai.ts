import type { SQLiteDatabase } from '../../src/db/driver';

// AI features are gone: their request log and saved settings go with them.
// The city tables' AI refreshes (city_costs:*) were the only rows there.
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DROP INDEX IF EXISTS idx_ai_requests_key;
    DROP TABLE IF EXISTS ai_requests;
    DELETE FROM app_settings
      WHERE key IN ('ai_keys', 'ai_key_strategy', 'ai_key_cursor',
                    'aiAnalysis.profile', 'receiptScan.useAi')
         OR key LIKE 'city_costs:%';
  `);
}
