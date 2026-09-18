import ICloudDrive from '../../modules/icloud-drive';
import type { ICloudStatus } from '../../modules/icloud-drive';
import type { CloudProvider } from './types';
import { rollingBackupKey } from './backupPath';

export const ICLOUD_PROVIDER_ID = 'icloud';

// The destination that survives deleting the app: the board's zip written
// into the app's own iCloud Drive folder (visible in Files, syncs to their
// other devices, outlives the phone). An on-device copy used to sit beside
// it and was removed — it shared the database's sandbox, so it protected
// against nothing a reinstall could do.
//
// One file per board, `<board-slug>-latest.zip`, overwritten every sync.
// Surviving a reinstall is the whole job here, and only the current copy
// does that job — a history would be someone's iCloud storage spent on
// backups they'll never open. Buckets, which are cheap and browsable, keep
// the dated history instead (backupPath.ts).
//
// Needs the iCloud entitlement from app.json and therefore a real build: the
// native module is absent in Expo Go, where `ICloudDrive` is null.
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
    keyFor: rollingBackupKey,
    upload: (bytes, key) => drive.write(key, bytes),
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
