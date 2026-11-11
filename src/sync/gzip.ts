import JSZip from 'jszip';
import type { Gzip } from '../../sync-core/types';

// Gzip through the JSZip already in the bundle, adding no bytes to it.
// Metro resolves jszip to its minified build, which carries its own pako
// but exposes none of it, and importing pako directly would ship a second
// copy (~45 KB). A gzip member and a zip entry hold the same raw DEFLATE
// stream and CRC-32, so this only rewraps the headers around it.

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

function put16(b: Uint8Array, o: number, v: number) {
  b[o] = v & 0xff;
  b[o + 1] = (v >>> 8) & 0xff;
}

function put32(b: Uint8Array, o: number, v: number) {
  put16(b, o, v & 0xffff);
  put16(b, o + 2, (v >>> 16) & 0xffff);
}

const NAME = 's';

// The empty DEFLATE stream; JSZip stores an empty file rather than deflating it.
const EMPTY_GZIP = new Uint8Array([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0xff, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length === 0) return EMPTY_GZIP.slice();
  const zip = await new JSZip()
    .file(NAME, bytes, { binary: true })
    .generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  if (u32(zip, 0) !== 0x04034b50 || u16(zip, 8) !== 8) throw new Error('gzip: unexpected zip entry');
  const crc = u32(zip, 14);
  const size = u32(zip, 18);
  const start = 30 + u16(zip, 26) + u16(zip, 28);
  const out = new Uint8Array(10 + size + 8);
  out.set([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0xff]);
  out.set(zip.subarray(start, start + size), 10);
  put32(out, 10 + size, crc);
  put32(out, 14 + size, bytes.length >>> 0);
  return out;
}

const FHCRC = 2;
const FEXTRA = 4;
const FNAME = 8;
const FCOMMENT = 16;

async function inflate(gz: Uint8Array): Promise<Uint8Array> {
  if (gz.length < 18 || gz[0] !== 0x1f || gz[1] !== 0x8b || gz[2] !== 8) throw new Error('gzip: not a gzip member');
  const flags = gz[3];
  let p = 10;
  if (flags & FEXTRA) p += 2 + u16(gz, p);
  if (flags & FNAME) while (gz[p++] !== 0);
  if (flags & FCOMMENT) while (gz[p++] !== 0);
  if (flags & FHCRC) p += 2;
  const data = gz.subarray(p, gz.length - 8);
  const crc = u32(gz, gz.length - 8);
  const size = u32(gz, gz.length - 4);

  const local = new Uint8Array(30 + NAME.length);
  put32(local, 0, 0x04034b50);
  put16(local, 4, 20);
  put16(local, 8, 8);
  put32(local, 14, crc);
  put32(local, 18, data.length);
  put32(local, 22, size);
  put16(local, 26, NAME.length);
  local[30] = NAME.charCodeAt(0);

  const central = new Uint8Array(46 + NAME.length);
  put32(central, 0, 0x02014b50);
  put16(central, 4, 20);
  put16(central, 6, 20);
  put16(central, 10, 8);
  put32(central, 16, crc);
  put32(central, 20, data.length);
  put32(central, 24, size);
  put16(central, 28, NAME.length);
  central[46] = NAME.charCodeAt(0);

  const end = new Uint8Array(22);
  put32(end, 0, 0x06054b50);
  put16(end, 8, 1);
  put16(end, 10, 1);
  put32(end, 12, central.length);
  put32(end, 16, local.length + data.length);

  const zip = new Uint8Array(local.length + data.length + central.length + end.length);
  zip.set(local, 0);
  zip.set(data, local.length);
  zip.set(central, local.length + data.length);
  zip.set(end, local.length + data.length + central.length);

  const loaded = await JSZip.loadAsync(zip, { checkCRC32: true });
  const file = loaded.file(NAME);
  if (!file) throw new Error('gzip: entry missing');
  return file.async('uint8array');
}

export const gzip: Gzip = { deflate, inflate };
