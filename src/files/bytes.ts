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

// Hermes has no TextDecoder, and the escape/unescape trick mangles anything
// outside Latin-1 — a YNAB export with a Chinese payee in it, for instance.
// Continuation bytes are masked rather than validated: this reads files the
// app itself wrote or a bank exported, not untrusted input.
export function bytesToUtf8(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const byte = bytes[i];
    let code: number;
    if (byte < 0x80) {
      code = byte;
      i += 1;
    } else if (byte < 0xe0) {
      code = ((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      i += 2;
    } else if (byte < 0xf0) {
      code =
        ((byte & 0x0f) << 12) |
        ((bytes[i + 1] & 0x3f) << 6) |
        (bytes[i + 2] & 0x3f);
      i += 3;
    } else {
      code =
        ((byte & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      i += 4;
    }
    // Astral planes arrive as a surrogate pair — an emoji in a memo is one
    // code point here and two JavaScript characters.
    if (code > 0xffff) {
      const shifted = code - 0x10000;
      out += String.fromCharCode(0xd800 + (shifted >> 10), 0xdc00 + (shifted & 0x3ff));
    } else {
      out += String.fromCharCode(code);
    }
  }
  return out;
}
