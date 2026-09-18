import { requireOptionalNativeModule } from 'expo';

// Keys are relative paths inside the app's own folder in iCloud Drive — one
// `<board-slug>-latest.zip` per board, overwritten (src/sync/backupPath.ts).
// Only `icloudOff` is the user's to fix. `notEntitled` is the build's doing
// and no action in iOS Settings changes it; `notReady` is a container Apple
// hasn't finished provisioning, which fixes itself.
export type ICloudStatus =
  'available' | 'icloudOff' | 'notEntitled' | 'notReady';

export interface ICloudDriveModule {
  // Asked, not caught: none of these are errors.
  getStatus(): Promise<ICloudStatus>;
  getContainerPath(): Promise<string | null>;
  write(key: string, data: Uint8Array): Promise<void>;
  list(): Promise<string[]>;
  read(key: string): Promise<Uint8Array | null>;
}

// Optional, not required: this module is Apple-only and exists only in a real
// build carrying the iCloud entitlement, so Android, web and Expo Go get null
// instead of a crash at import time.
export default requireOptionalNativeModule<ICloudDriveModule>('ICloudDrive');
