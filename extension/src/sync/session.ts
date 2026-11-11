import { S3Bucket } from '../../../sync-core/bucket';
import { Clock } from '../../../sync-core/clock';
import type { Connection } from '../setup/connection';
import { Store } from '../store/store';
import { SyncEngine } from './engine';
import { startTriggers } from './triggers';

export interface Session {
  store: Store;
  engine: SyncEngine;
  close(): void;
}

// One open page's sync: store, engine and its triggers, over this connection.
export async function openSession(c: Connection): Promise<Session> {
  const clock = new Clock();
  const bucket = new S3Bucket(c, {
    fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }),
    onDate: (date) => clock.observeDate(date),
  });
  const store = await Store.open();
  const engine = await SyncEngine.open({ store, bucket, clock });
  const stop = startTriggers(engine);
  return {
    store,
    engine,
    close() {
      stop();
      store.close();
    },
  };
}
