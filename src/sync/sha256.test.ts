import { hmacSha256, sha256 } from './sha256';
import { bytesToHex, utf8ToBytes } from '../files/bytes';

const hex = (text: string) => bytesToHex(sha256(utf8ToBytes(text)));
const fromHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((b) => parseInt(b, 16)));

describe('sha256', () => {
  it('matches the NIST vectors', () => {
    expect(hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
    expect(hex('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  });

  it('encodes non-ASCII as UTF-8', () => {
    expect(hex('中')).toBe(bytesToHex(sha256(Uint8Array.from([0xe4, 0xb8, 0xad]))));
  });
});

describe('hmacSha256', () => {
  it('matches RFC 4231', () => {
    expect(bytesToHex(hmacSha256(fromHex('0b'.repeat(20)), utf8ToBytes('Hi There')))).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    );
    expect(bytesToHex(hmacSha256(utf8ToBytes('Jefe'), utf8ToBytes('what do ya want for nothing?')))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
    expect(
      bytesToHex(
        hmacSha256(
          fromHex('aa'.repeat(131)),
          utf8ToBytes('Test Using Larger Than Block-Size Key - Hash Key First'),
        ),
      ),
    ).toBe('60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54');
  });
});
