import { base64ToBytes, bytesToBase64, bytesToUtf8 } from './bytes';

describe('bytes', () => {
  it('round-trips base64', () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('matches known base64 encodings', () => {
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe('aGk=');
    expect([...base64ToBytes('aGk=')]).toEqual([104, 105]);
  });

  it('decodes utf-8 beyond Latin-1', () => {
    for (const text of ['hi', 'café', '超市 购物', 'emoji 🧾 receipt', '']) {
      const encoded = new Uint8Array(
        // A reference encoder, so the decoder is checked against something
        // other than itself.
        [...text].flatMap((ch) => {
          const code = ch.codePointAt(0)!;
          if (code < 0x80) return [code];
          if (code < 0x800) return [0xc0 | (code >> 6), 0x80 | (code & 0x3f)];
          if (code < 0x10000)
            return [0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f)];
          return [
            0xf0 | (code >> 18),
            0x80 | ((code >> 12) & 0x3f),
            0x80 | ((code >> 6) & 0x3f),
            0x80 | (code & 0x3f),
          ];
        }),
      );
      expect(bytesToUtf8(encoded)).toBe(text);
    }
  });
});
