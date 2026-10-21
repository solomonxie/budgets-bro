import ReceiptScanner from '../../../modules/receipt-scanner';
import { matchKnownNames, parseReceipt, receiptRows } from '../../domain/receipt';
import type { Receipt } from '../../domain/receipt';

// Null when the user backed out of the camera or picker. Read entirely on
// the device.
export async function scanReceipt(
  source: 'camera' | 'library',
  { knownNames }: { knownNames: string[] },
): Promise<Receipt | null> {
  const texts = await ReceiptScanner.scan(source);
  if (!texts) return null;
  const receipt = parseReceipt(receiptRows(texts));
  return { ...receipt, items: matchKnownNames(receipt.items, knownNames) };
}
