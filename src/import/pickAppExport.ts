import { File } from 'expo-file-system';
import { parseBackupZip } from '../sync/parseBackupZip';
import type { PickedAppExport } from '../sync/parseBackupZip';

export type { PickedAppExport };

// This app's own "Export Board as .zip" (see sync/buildBackup.ts) — picked
// from the filesystem here; sync/*Provider.ts's "Restore Latest from
// Cloud" feeds the same parseBackupZip from a downloaded byte array instead.
export async function pickAppExport(): Promise<PickedAppExport | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/zip'] });
  if (picked.canceled) return null;
  const buffer = await picked.result.arrayBuffer();
  return parseBackupZip(buffer);
}
