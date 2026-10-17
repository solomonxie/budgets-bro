import ReceiptScanner from '../../../modules/receipt-scanner';
import { runWithAiKeys } from '../../ai/aiKeys';
import { buildReceiptMessages } from '../../ai/prompts';
import { getDb } from '../../db/client';
import {
  matchKnownNames,
  parseReceipt,
  receiptFromAiReply,
  receiptRows,
} from '../../domain/receipt';
import type { Receipt } from '../../domain/receipt';

// Null when the user backed out of the camera or picker. The AI, when asked
// for, only sees the text, and its answer is discarded for the on-device
// reading if it fails or makes no sense.
export async function scanReceipt(
  source: 'camera' | 'library',
  {
    useAi,
    knownNames,
    language,
  }: { useAi: boolean; knownNames: string[]; language: 'en' | 'zh' },
): Promise<Receipt | null> {
  const texts = await ReceiptScanner.scan(source);
  if (!texts) return null;
  const rows = receiptRows(texts);
  const local = parseReceipt(rows);
  let receipt = local;
  if (useAi && rows.length > 0) {
    try {
      const reply = await runWithAiKeys(await getDb(), buildReceiptMessages(rows, knownNames, language));
      const fromAi = receiptFromAiReply(reply);
      if (fromAi && fromAi.items.length > 0)
        receipt = { items: fromAi.items, totalCents: fromAi.totalCents ?? local.totalCents };
    } catch {
      // On-device reading stands.
    }
  }
  return { ...receipt, items: matchKnownNames(receipt.items, knownNames) };
}
