import type { SQLiteDatabase } from '../driver';
import { freshBoardName, wipeAppData } from './appDataRepo';

describe('freshBoardName', () => {
  it('is dated, so the next wipe does not reuse it', () => {
    expect(freshBoardName('My Budget', '2026-09-24', ['Home'])).toBe('My Budget 2026-09-24');
  });

  it('steps aside from a wiped board with the same slug', () => {
    expect(freshBoardName('My Budget', '2026-09-24', ['my budget 2026-09-24'])).toBe('My Budget 2026-09-24 (2)');
  });
});

describe('wipeAppData', () => {
  function fakeDb() {
    const log: string[] = [];
    let inTx = false;
    const db = {
      getAllAsync: async () => [{ id: 1 }, { id: 2 }],
      runAsync: async (sql: string, ...params: unknown[]) => {
        log.push(`${inTx ? 'tx' : 'out'}: ${sql} ${JSON.stringify(params)}`);
        return { lastInsertRowId: 9, changes: 1 };
      },
      execAsync: async (sql: string) => {
        log.push(`${inTx ? 'tx' : 'out'}: ${sql}`);
      },
      withTransactionAsync: async (fn: () => Promise<void>) => {
        inTx = true;
        await fn();
        inTx = false;
      },
    } as unknown as SQLiteDatabase;
    return { db, log };
  }

  it('deletes inside one transaction and vacuums after it', async () => {
    const { db, log } = fakeDb();
    const id = await wipeAppData(db, { freshBoardName: 'B', keepSettings: ['a', 'b'] });
    expect(id).toBe(9);
    const outside = log.filter((l) => l.startsWith('out'));
    expect(outside).toEqual(['out: VACUUM', 'out: PRAGMA wal_checkpoint(TRUNCATE)']);
    expect(log).toContain('tx: DELETE FROM app_settings WHERE key NOT IN (?, ?) ["a","b"]');
    expect(log.filter((l) => l.includes('DELETE FROM boards WHERE id'))).toHaveLength(2);
    expect(log[log.length - 3]).toBe('tx: DELETE FROM change_log []');
  });
});
