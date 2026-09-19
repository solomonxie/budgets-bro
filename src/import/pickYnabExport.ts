import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';
import JSZip from 'jszip';
import { readBytes } from '../files/fileStore';
import { Buffer } from 'buffer';

// The picker's own "user backed out" error, told apart from a real one.
function isCancel(e: unknown): boolean {
  return isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED;
}

export interface PickedYnabExport {
  registerCsv: string;
  planCsv: string;
}

function findEntry(zip: JSZip, match: (lowerName: string) => boolean) {
  return Object.values(zip.files).find((f) => match(f.name.toLowerCase()));
}

// YNAB's "Export" is a zip with two CSVs: "<budget name> - Register.csv" and
// "<budget name> - Plan.csv". Also accepts picking a lone Register CSV
// (Plan then comes back empty — budgeted amounts just won't be imported).
export async function pickYnabExport(): Promise<PickedYnabExport | null> {
  // Cancelling is a normal way to leave a picker, not a failure: the
  // library throws for it, and everything above here reads null as "never
  // mind" (see errorCodes.OPERATION_CANCELED).
  const [file] = await pick({
    type: [types.zip, types.csv],
    // Copies the file out of the provider's sandbox and hands back a path
    // this app can actually read — without it a file from iCloud Drive or
    // Files opens as an unreadable security-scoped url.
    mode: 'import',
  }).catch((e) => {
    if (isCancel(e)) return [];
    throw e;
  });
  if (!file) return null;

  const bytes = await readBytes(decodeURI(file.uri.replace('file://', '')));
  if (!bytes) throw new Error('That file could not be read.');

  if ((file.name ?? '').toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(bytes);
    const registerEntry = findEntry(zip, (n) => n.includes('register'));
    const planEntry = findEntry(zip, (n) => n.includes('plan'));
    if (!registerEntry) throw new Error('No Register CSV found inside the zip.');
    return {
      registerCsv: await registerEntry.async('string'),
      planCsv: planEntry ? await planEntry.async('string') : '',
    };
  }

  return { registerCsv: Buffer.from(bytes).toString('utf8'), planCsv: '' };
}
