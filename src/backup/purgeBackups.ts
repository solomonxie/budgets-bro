import type { SQLiteDatabase } from '../db/driver';
import ICloudDrive from '../../modules/icloud-drive';
import { deleteAllSnapshots } from '../db/preMigrationSnapshot';
import { createS3Providers, deleteS3Objects, listS3Configs } from '../sync/s3Provider';
import { deleteAllLocalBackups } from './localBackup';

// Wipes every backup this app has written, everywhere it can reach, so a
// dataset can be started over without years of stale zips shadowing it.
//
// Why this exists as one button: the four tiers are four different mechanisms
// in four places, and after a key-shape change the old files aren't pruned by
// anything — nothing matches them any more. "Start fresh" means all of it or
// none of it, and doing it by hand means four apps and a bucket console.
//
// Does not touch the live database, the change log, or saved credentials.
// Deleting backups is not deleting data.
export interface PurgeResult {
  localZips: number;
  snapshots: number;
  icloud: number;
  bucket: number;
  // A bucket that refuses DELETE is the expected case, not an error — say so
  // rather than reporting a clean sweep that didn't happen.
  bucketRefused: number;
  errors: string[];
}

export async function purgeAllBackups(db: SQLiteDatabase): Promise<PurgeResult> {
  const result: PurgeResult = { localZips: 0, snapshots: 0, icloud: 0, bucket: 0, bucketRefused: 0, errors: [] };

  // Each tier is attempted independently: iCloud being signed out must not
  // stop the local folder being cleared.
  try {
    result.localZips = await deleteAllLocalBackups();
  } catch (e) {
    result.errors.push(message(e));
  }

  try {
    result.snapshots = await deleteAllSnapshots();
  } catch (e) {
    result.errors.push(message(e));
  }

  try {
    if (ICloudDrive && (await ICloudDrive.getStatus()) === 'available') {
      for (const key of await ICloudDrive.list()) {
        await ICloudDrive.remove(key);
        result.icloud += 1;
      }
    }
  } catch (e) {
    result.errors.push(message(e));
  }

  try {
    const providers = await createS3Providers(db);
    for (const config of await listS3Configs(db)) {
      // Through the provider so the listing is already scoped to this
      // bucket's configured prefix — nothing outside it is ours to delete.
      const provider = providers.find((p) => p.id === `aws-s3:${config.id}`);
      if (!provider) continue;
      const { deleted, failed } = await deleteS3Objects(db, config.id, await provider.listKeys());
      result.bucket += deleted;
      result.bucketRefused += failed;
    }
  } catch (e) {
    result.errors.push(message(e));
  }

  return result;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
