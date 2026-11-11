// The few IndexedDB calls the store needs, as promises. Ported from Photos Vault.

export const request = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

// One transaction over `names`; resolves once it has committed, never before.
export const tx = <T>(
  db: IDBDatabase,
  names: string[],
  mode: IDBTransactionMode,
  body: (t: IDBTransaction) => T,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = db.transaction(names, mode);
    let result: T;
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('transaction aborted'));
    try {
      result = body(t);
    } catch (e) {
      t.abort();
      reject(e);
    }
  });

// Values from `index` over `range`, in `direction`, at most `limit`.
export const collect = <T>(
  index: IDBIndex | IDBObjectStore,
  range: IDBKeyRange,
  direction: IDBCursorDirection = 'next',
  limit = Infinity,
): Promise<T[]> =>
  new Promise((resolve, reject) => {
    const out: T[] = [];
    const r = index.openCursor(range, direction);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const cursor = r.result;
      if (!cursor || out.length >= limit) return resolve(out);
      out.push(cursor.value as T);
      cursor.continue();
    };
  });
