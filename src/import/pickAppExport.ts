import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';
import { readBytes } from '../files/fileStore';
import { parseBackupZip } from '../sync/parseBackupZip';
import type { PickedAppExport } from '../sync/parseBackupZip';

export type { PickedAppExport };

// This app's own "Export Board as .zip" (see sync/buildBackup.ts) — picked
// from the filesystem here; sync/*Provider.ts's "Restore Latest from
// Cloud" feeds the same parseBackupZip from a downloaded byte array instead.
export async function pickAppExport(): Promise<PickedAppExport | null> {
  // `import` mode copies the file somewhere readable first — a zip sitting
  // in iCloud Drive is not something this app may open in place.
  const [file] = await pick({ type: [types.zip], mode: 'import' }).catch(
    (e) => {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED)
        return [];
      throw e;
    },
  );
  if (!file) return null;
  const bytes = await readBytes(decodeURI(file.uri.replace('file://', '')));
  if (!bytes) throw new Error('That file could not be read.');
  return parseBackupZip(bytes);
}
