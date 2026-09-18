import ICloudDrive from '../../modules/icloud-drive';
import type { ICloudStatus } from '../../modules/icloud-drive';
import type { CloudProvider } from './types';

export const ICLOUD_PROVIDER_ID = 'icloud';

// Ten days of history, give or take — enough to notice a bad import a week
// late, not enough to be felt in a 5 GB iCloud plan.
const ICLOUD_KEEP_LATEST = 10;

// The destination that survives deleting the app: the board's zip written
// into the app's own iCloud Drive folder (visible in Files, syncs to their
// other devices, outlives the phone). An on-device copy used to sit beside
// it and was removed — it shared the database's sandbox, so it protected
// against nothing a reinstall could do.
//
// One dated file per board per day, the newest ten kept and the rest pruned:
// this is storage the user pays for, so a count is what bounds the bill. It
// used to be a single overwritten `-latest.zip`, which made "get me
// yesterday's, before I did that" impossible from the one destination the
// user can actually open in Files.
//
// Needs the iCloud entitlement from app.json and therefore a real build: the
// native module is absent (Android, web), where `ICloudDrive` is null.
export function isICloudSupported(): boolean {
  return ICloudDrive != null;
}

// Unusable for one of two reasons the UI must not confuse — see the Swift
// side, which reads the embedded provisioning profile to tell them apart.
export async function getICloudStatus(): Promise<ICloudStatus> {
  return (await ICloudDrive?.getStatus()) ?? 'notEntitled';
}

export async function getICloudPath(): Promise<string | null> {
  return (await ICloudDrive?.getContainerPath()) ?? null;
}

function toProvider(drive: NonNullable<typeof ICloudDrive>): CloudProvider {
  return {
    id: ICLOUD_PROVIDER_ID,
    keepLatest: ICLOUD_KEEP_LATEST,
    upload: (bytes, key) => drive.write(key, bytes),
    remove: (key) => drive.remove(key),
    listKeys: () => drive.list(),
    download: (key) => drive.read(key),
  };
}

export async function createICloudProviders(): Promise<CloudProvider[]> {
  if (!ICloudDrive) return [];
  // Unavailable is not a failed sync — no provider means syncNow skips this
  // destination silently, the same as an unconfigured bucket.
  if ((await ICloudDrive.getStatus()) !== 'available') return [];
  return [toProvider(ICloudDrive)];
}

export type { ICloudStatus };
