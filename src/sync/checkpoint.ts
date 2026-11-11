import type { SQLiteDatabase } from '../db/driver';
import * as syncState from '../db/repositories/syncStateRepo';
import type { Bucket } from '../../sync-core/bucket';
import { checkpointDue, checkpointPublisher, newestCheckpointHlc } from '../../sync-core/checkpointPolicy';
import type { Gzip } from '../../sync-core/types';
import { publishCheckpoint } from './bootstrap';
import { gzip as phoneGzip } from './gzip';

export type CheckpointOutcome = 'published' | 'notDue' | 'notMine' | 'unsent' | 'failed';

// At most daily, by the device with the most writes since the newest
// checkpoint (sync-core/checkpointPolicy.ts). Costs one list when not due.
export async function maybePublishCheckpoint(
  db: SQLiteDatabase,
  bucket: Bucket,
  bucketNow: number,
  gz: Gzip = phoneGzip,
): Promise<CheckpointOutcome> {
  try {
    const device = await syncState.getMeta(db, 'device');
    if (!device) return 'notMine';
    const newest = newestCheckpointHlc((await bucket.list('sync/checkpoints/')).map((o) => o.key));
    if (!checkpointDue(newest, bucketNow)) return 'notDue';
    if ((await syncState.listSealed(db)).length > 0) return 'unsent';
    if (checkpointPublisher(await syncState.loadEntities(db), newest) !== device) return 'notMine';
    return (await publishCheckpoint(db, bucket, gz)) ? 'published' : 'failed';
  } catch {
    return 'failed';
  }
}
