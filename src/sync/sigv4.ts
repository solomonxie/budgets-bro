import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

// AWS Signature Version 4, the ~60 lines of it this app actually needs.
//
// This used to be @smithy/signature-v4 + @smithy/protocol-http +
// @aws-crypto/sha256-js — AWS's own signer, and 341 KB of bundle for four
// S3 calls, on an app whose first rule is that it stays small. The HMAC
// chain below is the whole algorithm; @noble/hashes was already here.
// Every expectation in sigv4.test.ts was produced by the AWS signer this
// replaced, so the output is checked against AWS's, not against itself.
//
// Header-based signing only (no presigned URLs), no session token, and
// SHA-256 of the body in `x-amz-content-sha256` — which S3 requires on
// every request.

export interface SignInput {
  method: string;
  hostname: string;
  // Already in the form it will be requested at: this signer does not
  // re-escape it, matching the real S3 client's `uriEscapePath: false`.
  path: string;
  query: Record<string, string>;
  body: Uint8Array | null;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  // Injectable so a test is not signing "now".
  date?: Date;
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

const ALGORITHM = 'AWS4-HMAC-SHA256';

function hex(bytes: Uint8Array): string {
  return bytesToHex(bytes);
}

function hashHex(data: Uint8Array): string {
  return hex(sha256(data));
}

function sign(key: Uint8Array, data: string): Uint8Array {
  return hmac(sha256, key, utf8ToBytes(data));
}

// encodeURIComponent leaves these alone; AWS expects them escaped.
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

// Sorted by key, each name and value escaped. A subresource carries an
// empty value (`publicAccessBlock=`), which is exactly what S3 signs.
function canonicalQuery(query: Record<string, string>): string {
  return Object.keys(query)
    .sort()
    .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(query[key])}`)
    .join('&');
}

function amzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

export function signS3Request(input: SignInput): SignedRequest {
  const date = input.date ?? new Date();
  const timestamp = amzDate(date);
  const day = timestamp.slice(0, 8);
  const scope = `${day}/${input.region}/${input.service}/aws4_request`;
  const payloadHash = hashHex(input.body ?? new Uint8Array(0));

  // The three headers S3 signs. Kept sorted here because the canonical
  // request and the SignedHeaders list must agree on the order.
  const signedHeaders: Record<string, string> = {
    host: input.hostname,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': timestamp,
  };
  const headerNames = Object.keys(signedHeaders).sort();
  const canonicalHeaders = headerNames
    .map((name) => `${name}:${signedHeaders[name].trim()}\n`)
    .join('');
  const signedHeaderList = headerNames.join(';');

  const canonicalRequest = [
    input.method,
    input.path,
    canonicalQuery(input.query),
    canonicalHeaders,
    signedHeaderList,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    ALGORITHM,
    timestamp,
    scope,
    hashHex(utf8ToBytes(canonicalRequest)),
  ].join('\n');

  const signingKey = ['aws4_request'].reduce(
    (key, part) => sign(key, part),
    [input.region, input.service].reduce(
      (key, part) => sign(key, part),
      sign(utf8ToBytes(`AWS4${input.secretAccessKey}`), day),
    ),
  );
  const signature = hex(sign(signingKey, stringToSign));

  return {
    // `host` is left out: fetch derives it from the URL and refuses it as a
    // manually set header, and it is signed either way.
    headers: {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': timestamp,
      authorization: `${ALGORITHM} Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaderList}, Signature=${signature}`,
    },
    url: `https://${input.hostname}${input.path}?${canonicalQuery(input.query)}`,
  };
}
