import { fromByteArray, toByteArray } from 'base64-js';

// Byte/text conversions, in place of Node's Buffer — which was 57 KB of
// bundle for three call sites, all of them one of these three lines.
// `base64-js` is React Native's own dependency (Libraries/Utilities/
// binaryToBase64 uses it), so it is already in the bundle either way.

export function bytesToBase64(bytes: Uint8Array): string {
  return fromByteArray(bytes);
}

export function base64ToBytes(base64: string): Uint8Array {
  return toByteArray(base64);
}

export { bytesToHex, bytesToUtf8, utf8ToBytes } from '../../sync-core/bytes';
