import { NativeModules } from 'react-native';
import { Buffer } from 'buffer';

// Keys are relative paths inside the app's own folder in iCloud Drive —
// `<YYYYMMDD>-<board-slug>.zip`, one per board per day (src/sync/backupPath.ts).
// Only `icloudOff` is the user's to fix. `notEntitled` is the build's doing
// and no action in iOS Settings changes it; `notReady` is a container Apple
// hasn't finished provisioning, which fixes itself.
export type ICloudStatus =
  | 'available'
  | 'icloudOff'
  | 'notEntitled'
  | 'notReady';

export interface ICloudDriveModule {
  // Asked, not caught: none of these are errors.
  getStatus(): Promise<ICloudStatus>;
  getContainerPath(): Promise<string | null>;
  write(key: string, data: Uint8Array): Promise<void>;
  list(): Promise<string[]>;
  read(key: string): Promise<Uint8Array | null>;
  // Deleting a key that isn't there succeeds — see the Swift side.
  remove(key: string): Promise<void>;
}

// The native side speaks base64, because a plain bridge module has no
// Uint8Array to pass. Callers keep bytes; the conversion lives here rather
// than at every call site.
interface NativeICloudDrive {
  getStatus(): Promise<ICloudStatus>;
  getContainerPath(): Promise<string | null>;
  write(key: string, base64: string): Promise<void>;
  list(): Promise<string[]>;
  read(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
}

// Absent rather than required: this module is Apple-only and exists only in
// a real build carrying the iCloud entitlement, so anything else gets null
// instead of a crash at import time.
const native: NativeICloudDrive | undefined = NativeModules.ICloudDrive;

const wrapped: ICloudDriveModule | null = native
  ? {
      getStatus: () => native.getStatus(),
      getContainerPath: () => native.getContainerPath(),
      write: (key, data) =>
        native.write(key, Buffer.from(data).toString('base64')),
      list: () => native.list(),
      read: async (key) => {
        const base64 = await native.read(key);
        return base64 == null ? null : new Uint8Array(Buffer.from(base64, 'base64'));
      },
      remove: (key) => native.remove(key),
    }
  : null;

export default wrapped;
