import { openDatabase } from './driver';

// The engine is native, so what's checked here is the adapter's own
// behaviour: the shape every repository in the app is written against.
// `mock`-prefixed so jest allows the factory below to close over it.
const mockExecute = jest.fn();
jest.mock('@op-engineering/op-sqlite', () => ({
  open: () => ({ execute: (...args: unknown[]) => mockExecute(...args) }),
  IOS_DOCUMENT_PATH: '/documents',
}));

function db() {
  return openDatabase('test.db', '/documents/SQLite');
}

beforeEach(() => {
  mockExecute.mockReset();
  mockExecute.mockResolvedValue({ rows: [], rowsAffected: 0 });
});

describe('runAsync', () => {
  it('reports the inserted id and affected rows under the names callers use', async () => {
    mockExecute.mockResolvedValue({ rows: [], rowsAffected: 3, insertId: 42 });
    expect(await db().runAsync('INSERT INTO t (a) VALUES (?)', 1)).toEqual({
      lastInsertRowId: 42,
      changes: 3,
    });
  });

  it('defaults both to 0 when the engine reports neither', async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    expect(await db().runAsync('UPDATE t SET a = 1')).toEqual({
      lastInsertRowId: 0,
      changes: 0,
    });
  });

  it('passes variadic params as one array', async () => {
    await db().runAsync('UPDATE t SET a = ? WHERE id = ?', 'x', 7);
    expect(mockExecute).toHaveBeenCalledWith('UPDATE t SET a = ? WHERE id = ?', ['x', 7]);
  });

  it('passes a single array argument straight through — an IN (?, ?) list', async () => {
    await db().runAsync('DELETE FROM t WHERE id IN (?, ?)', [1, 2] as never);
    expect(mockExecute).toHaveBeenCalledWith('DELETE FROM t WHERE id IN (?, ?)', [1, 2]);
  });
});

describe('reads', () => {
  it('getAllAsync returns the rows', async () => {
    mockExecute.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });
    expect(await db().getAllAsync('SELECT * FROM t')).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('getFirstAsync returns null rather than undefined when nothing matches', async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    expect(await db().getFirstAsync('SELECT * FROM t WHERE id = ?', 9)).toBeNull();
  });
});

describe('execAsync', () => {
  it('runs a multi-statement script one statement at a time', async () => {
    await db().execAsync('CREATE TABLE a (id INT);\nCREATE INDEX i ON a (id);');
    expect(mockExecute.mock.calls.map((c) => c[0])).toEqual([
      'CREATE TABLE a (id INT)',
      'CREATE INDEX i ON a (id)',
    ]);
  });
});

describe('withTransactionAsync', () => {
  it('commits on success', async () => {
    await db().withTransactionAsync(async () => {
      await Promise.resolve();
    });
    expect(mockExecute.mock.calls.map((c) => c[0])).toEqual(['BEGIN', 'COMMIT']);
  });

  it('rolls back and rethrows on failure', async () => {
    const boom = new Error('boom');
    await expect(
      db().withTransactionAsync(async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(mockExecute.mock.calls.map((c) => c[0])).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('joins an outer transaction instead of nesting a second BEGIN', async () => {
    const database = db();
    await database.withTransactionAsync(async () => {
      await database.withTransactionAsync(async () => {
        await database.runAsync('INSERT INTO t (a) VALUES (1)');
      });
    });
    expect(mockExecute.mock.calls.map((c) => c[0])).toEqual([
      'BEGIN',
      'INSERT INTO t (a) VALUES (1)',
      'COMMIT',
    ]);
  });

  it('starts a fresh transaction after one rolled back', async () => {
    const database = db();
    await expect(
      database.withTransactionAsync(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow();
    mockExecute.mockClear();
    await database.withTransactionAsync(async () => {
      await Promise.resolve();
    });
    expect(mockExecute.mock.calls.map((c) => c[0])).toEqual(['BEGIN', 'COMMIT']);
  });
});
