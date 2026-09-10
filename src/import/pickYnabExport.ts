import { File } from 'expo-file-system';
import JSZip from 'jszip';

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
  const picked = await File.pickFileAsync({ mimeTypes: ['application/zip', 'text/csv', 'text/comma-separated-values'] });
  if (picked.canceled) return null;
  const file = picked.result;

  if (file.name.toLowerCase().endsWith('.zip')) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const registerEntry = findEntry(zip, (n) => n.includes('register'));
    const planEntry = findEntry(zip, (n) => n.includes('plan'));
    if (!registerEntry) throw new Error('No Register CSV found inside the zip.');
    return {
      registerCsv: await registerEntry.async('string'),
      planCsv: planEntry ? await planEntry.async('string') : '',
    };
  }

  const text = await file.text();
  return { registerCsv: text, planCsv: '' };
}
