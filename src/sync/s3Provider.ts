import type { SQLiteDatabase } from 'expo-sqlite';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { secureStore } from '../secure/secureStore';
import * as settingsRepo from '../db/repositories/settingsRepo';
import type { CloudProvider } from './types';

const CONFIGS_KEY = 'sync_s3_configs';

// Pre-fills the config form's key-prefix field — matches app.json's slug.
// Keeps backups namespaced if the bucket is ever shared with another app,
// without the user having to think one up. Per-sync dated filenames were
// considered too (a history instead of one rolling latest.zip) but that's
// what S3 bucket versioning is for — see DESIGN.md's object-key note —
// doing it here would mean hand-rolling ListObjectsV2 pagination just to
// find "latest".
export const DEFAULT_S3_KEY_PREFIX = 'yet-another-money-app';

// Bucket identifies the config (no separate display name) — region is
// auto-detected (see detectBucketRegion), never typed by the user. keyPrefix
// is optional: an object-key folder to nest backups under, for buckets
// shared with other stuff. Access key + secret live in secureStore instead,
// keyed by `id` — see secureStore.getS3Credentials.
export interface S3ConfigMeta {
  id: string;
  bucket: string;
  region: string;
  keyPrefix?: string;
}

// What testS3Connection needs before a region is known.
export interface S3ConnectionInput {
  bucket: string;
  keyPrefix?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface S3ConfigInput extends S3ConnectionInput {
  region: string;
}

interface S3Config extends S3ConfigMeta {
  accessKeyId: string;
  secretAccessKey: string;
}

function newConfigId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Strips slashes off both ends so callers can type "backups", "backups/",
// or "/backups/" and get the same one clean segment prepended to object
// keys — see joinKey below.
function normalizePrefix(keyPrefix: string | undefined): string | undefined {
  const trimmed = keyPrefix?.trim().replace(/^\/+|\/+$/g, '');
  return trimmed || undefined;
}

function joinKey(keyPrefix: string | undefined, key: string): string {
  return keyPrefix ? `${keyPrefix}/${key}` : key;
}

export async function listS3Configs(db: SQLiteDatabase): Promise<S3ConfigMeta[]> {
  return settingsRepo.getJsonSetting<S3ConfigMeta[]>(db, CONFIGS_KEY, []);
}

// Saves the config — call testS3Connection first if the caller wants to
// reject bad credentials (and get the auto-detected region) before they're
// persisted (Settings' "Add S3 Backup" form does).
export async function addS3Config(db: SQLiteDatabase, input: S3ConfigInput): Promise<string> {
  const id = newConfigId();
  const configs = await listS3Configs(db);
  await settingsRepo.setJsonSetting(db, CONFIGS_KEY, [
    ...configs,
    { id, bucket: input.bucket.trim(), region: input.region.trim(), keyPrefix: normalizePrefix(input.keyPrefix) },
  ]);
  await secureStore.setS3Credentials(id, input.accessKeyId.trim(), input.secretAccessKey.trim());
  return id;
}

export async function removeS3Config(db: SQLiteDatabase, id: string): Promise<void> {
  const configs = await listS3Configs(db);
  await settingsRepo.setJsonSetting(
    db,
    CONFIGS_KEY,
    configs.filter((c) => c.id !== id),
  );
  await secureStore.clearS3Credentials(id);
}

async function resolveConfig(meta: S3ConfigMeta): Promise<S3Config | null> {
  const creds = await secureStore.getS3Credentials(meta.id);
  return creds ? { ...meta, ...creds } : null;
}

// AWS Signature Version 4 — hand-rolled because the AWS SDK assumes Node
// APIs React Native doesn't have. `expo-crypto` has no HMAC primitive (only
// plain digests), hence @noble/hashes for the HMAC-SHA256 chain.
function hmacBytes(key: Uint8Array, msg: string): Uint8Array {
  return hmac(sha256, key, utf8ToBytes(msg));
}

function signingKey(secretAccessKey: string, dateStamp: string, region: string): Uint8Array {
  const kDate = hmacBytes(utf8ToBytes(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = hmacBytes(kDate, region);
  const kService = hmacBytes(kRegion, 's3');
  return hmacBytes(kService, 'aws4_request');
}

// Object keys in this app are always ASCII (board ids, a fixed test-object
// name) — skipping AWS's per-segment URI-encoding rules is safe here.
// `objectKey: ''` addresses the bucket itself (path "/"), used by the
// validation checks below. `subresource` signs a bucket sub-resource query
// (e.g. `publicAccessBlock`) — SigV4 requires it in the canonical query
// string as `name=` even though the actual request URL omits the `=`.
async function signRequest(
  config: S3Config,
  method: 'PUT' | 'GET' | 'DELETE' | 'HEAD',
  objectKey: string,
  body: Uint8Array | null,
  subresource?: string,
): Promise<{ url: string; headers: Record<string, string> }> {
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = bytesToHex(sha256(body ?? new Uint8Array(0)));
  const path = objectKey ? `/${objectKey}` : '/';
  const canonicalQuery = subresource ? `${subresource}=` : '';

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [method, path, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    bytesToHex(sha256(utf8ToBytes(canonicalRequest))),
  ].join('\n');

  const signature = bytesToHex(hmacBytes(signingKey(config.secretAccessKey, dateStamp, config.region), stringToSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${host}${path}${subresource ? `?${subresource}` : ''}`,
    // `host` isn't set here — fetch derives it from the URL itself, and it's
    // already accounted for in the signature via canonicalHeaders above.
    headers: { 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, Authorization: authorization },
  };
}

async function put(config: S3Config, objectKey: string, body: Uint8Array): Promise<void> {
  const { url, headers } = await signRequest(config, 'PUT', objectKey, body);
  // body.slice() copies into a fresh, exactly-sized buffer first — body's
  // own backing ArrayBuffer can be a different byte range than the view
  // (offset/length), which would send different bytes than what was hashed
  // into the signature. Confirmed against a live bucket: identical signing
  // logic sending body.buffer directly (no slice) triggered
  // SignatureDoesNotMatch from inside the RN app.
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/octet-stream' },
    body: body.slice().buffer as ArrayBuffer,
  });
  if (!res.ok) throw new Error(`S3 PUT failed: ${res.status} ${await res.text()}`);
}

async function del(config: S3Config, objectKey: string): Promise<void> {
  const { url, headers } = await signRequest(config, 'DELETE', objectKey, null);
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE failed: ${res.status} ${await res.text()}`);
}

async function get(config: S3Config, objectKey: string): Promise<Uint8Array | null> {
  const { url, headers } = await signRequest(config, 'GET', objectKey, null);
  const res = await fetch(url, { method: 'GET', headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`S3 GET failed: ${res.status} ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}

// Each check below throws its own specific, user-facing message — fail
// closed: a check that can't be confirmed (e.g. missing permission to read
// it) is treated the same as a check that failed outright.

async function checkReachable(config: S3Config): Promise<void> {
  let res: Response;
  try {
    const { url, headers } = await signRequest(config, 'HEAD', '', null);
    res = await fetch(url, { method: 'HEAD', headers });
  } catch (e) {
    throw new Error(`Bucket unreachable — ${e instanceof Error ? e.message : String(e)}`);
  }
  if (res.status === 404) throw new Error('Bucket unreachable — bucket not found');
}

async function checkNotPublic(config: S3Config): Promise<void> {
  const { url, headers } = await signRequest(config, 'GET', '', null, 'publicAccessBlock');
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    throw new Error(
      'Could not confirm the bucket blocks public access — enable "Block all public access" on it, and grant this key s3:GetBucketPublicAccessBlock',
    );
  }
  const xml = await res.text();
  const allBlocked = ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'].every((tag) =>
    new RegExp(`<${tag}>true</${tag}>`).test(xml),
  );
  if (!allBlocked) throw new Error('Bucket does not have "Block all public access" fully enabled');
}

// Repeats the reachability check unsigned (no credentials at all) — this
// one must fail, proving the bucket isn't world-readable regardless of what
// this app's own key can do.
async function checkNoAnonymousAccess(config: S3Config): Promise<void> {
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const res = await fetch(`https://${host}/`, { method: 'HEAD' });
  if (res.ok) throw new Error('Bucket allows anonymous (unsigned) access — restrict its bucket policy/ACLs');
}

// S3 stamps the bucket's real region on the `x-amz-bucket-region` response
// header for any request to the region-less global endpoint — even an
// unauthenticated one that 403s — so the user never has to look up or type
// their bucket's region. Standard trick AWS's own SDKs/CLI use.
async function detectBucketRegion(bucket: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`https://${bucket}.s3.amazonaws.com/`, { method: 'HEAD' });
  } catch (e) {
    throw new Error(`Bucket unreachable — ${e instanceof Error ? e.message : String(e)}`);
  }
  const region = res.headers.get('x-amz-bucket-region');
  if (region) return region;
  if (res.status === 404) throw new Error('Bucket unreachable — bucket not found');
  throw new Error("Could not determine the bucket's region — check the bucket name.");
}

// Proves the credentials can actually write, read, and clean up after
// themselves in this bucket (not just reach it), and that the bucket isn't
// publicly exposed. Thrown message is shown as-is in the config form.
// Returns the auto-detected region so the caller can persist it — see
// detectBucketRegion.
export async function testS3Connection(input: S3ConnectionInput): Promise<string> {
  const bucket = input.bucket.trim();
  const keyPrefix = normalizePrefix(input.keyPrefix);
  const region = await detectBucketRegion(bucket);
  const config: S3Config = { id: '_test_', bucket, region, accessKeyId: input.accessKeyId.trim(), secretAccessKey: input.secretAccessKey.trim() };
  await checkReachable(config);

  const key = joinKey(keyPrefix, `.yet-another-money-app-connection-test-${Date.now()}`);
  const marker = utf8ToBytes('ok');
  await put(config, key, marker);
  try {
    const readBack = await get(config, key);
    if (!readBack || bytesToHex(readBack) !== bytesToHex(marker)) {
      throw new Error('Wrote a test object but could not read the same bytes back');
    }
  } finally {
    await del(config, key);
  }

  await checkNotPublic(config);
  await checkNoAnonymousAccess(config);
  return region;
}

function toProvider(meta: S3ConfigMeta): CloudProvider {
  return {
    id: `aws-s3:${meta.id}`,
    async upload(bytes, fileName) {
      const config = await resolveConfig(meta);
      if (!config) throw new Error(`S3 config "${meta.bucket}" is missing its credentials`);
      await put(config, joinKey(meta.keyPrefix, fileName), bytes);
    },
    async downloadLatest(fileName) {
      const config = await resolveConfig(meta);
      if (!config) return null;
      return get(config, joinKey(meta.keyPrefix, fileName));
    },
  };
}

// One CloudProvider per saved bucket — cloudSync.ts fans a backup out to
// every one of them concurrently (Promise.all), same as any other provider.
export async function createS3Providers(db: SQLiteDatabase): Promise<CloudProvider[]> {
  const configs = await listS3Configs(db);
  return configs.map(toProvider);
}
