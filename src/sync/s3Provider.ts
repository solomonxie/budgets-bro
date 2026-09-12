import type { SQLiteDatabase } from 'expo-sqlite';
import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { Sha256 } from '@aws-crypto/sha256-js';
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

// One row per past "Save" attempt in the Add S3 Backup form, success or
// failure — so a retry (or adding a second bucket with the same keys) never
// has to retype anything. Credentials live in secureStore keyed by the
// draft's own id, same as a real config's (see secureStore.getS3Credentials)
// — never in the plain settings JSON below.
export interface S3DraftMeta {
  id: string;
  bucket: string;
  keyPrefix?: string;
  accessKeyId: string;
  savedAt: number;
}

const DRAFTS_KEY = 'sync_s3_drafts';

function newDraftId(): string {
  return `s3draft_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function listS3Drafts(db: SQLiteDatabase): Promise<S3DraftMeta[]> {
  return settingsRepo.getJsonSetting<S3DraftMeta[]>(db, DRAFTS_KEY, []);
}

// Same bucket+prefix+accessKeyId overwrites its earlier draft (and bumps it
// to the top) instead of piling up duplicates on every retry. Returns the
// draft's id so a caller can remove it once the attempt actually succeeds.
export async function saveS3Draft(db: SQLiteDatabase, input: S3ConnectionInput): Promise<string> {
  const bucket = input.bucket.trim();
  const keyPrefix = normalizePrefix(input.keyPrefix);
  const accessKeyId = input.accessKeyId.trim();
  const drafts = await listS3Drafts(db);
  const existing = drafts.find((d) => d.bucket === bucket && d.keyPrefix === keyPrefix && d.accessKeyId === accessKeyId);
  const id = existing?.id ?? newDraftId();
  const meta: S3DraftMeta = { id, bucket, keyPrefix, accessKeyId, savedAt: Date.now() };
  await settingsRepo.setJsonSetting(db, DRAFTS_KEY, [meta, ...drafts.filter((d) => d.id !== id)]);
  await secureStore.setS3Credentials(id, accessKeyId, input.secretAccessKey.trim());
  return id;
}

export async function getS3Draft(db: SQLiteDatabase, id: string): Promise<S3ConnectionInput | null> {
  const drafts = await listS3Drafts(db);
  const meta = drafts.find((d) => d.id === id);
  if (!meta) return null;
  const creds = await secureStore.getS3Credentials(id);
  if (!creds) return null;
  return { bucket: meta.bucket, keyPrefix: meta.keyPrefix, ...creds };
}

export async function removeS3Draft(db: SQLiteDatabase, id: string): Promise<void> {
  const drafts = await listS3Drafts(db);
  await settingsRepo.setJsonSetting(db, DRAFTS_KEY, drafts.filter((d) => d.id !== id));
  await secureStore.clearS3Credentials(id);
}

async function resolveConfig(meta: S3ConfigMeta): Promise<S3Config | null> {
  const creds = await secureStore.getS3Credentials(meta.id);
  return creds ? { ...meta, ...creds } : null;
}

// AWS Signature Version 4 — signed via AWS's own @smithy/signature-v4 (the
// same signer every AWS SDK uses internally) instead of a hand-rolled HMAC
// chain, using @aws-crypto/sha256-js (pure JS, no Node/Web Crypto) so it
// still runs inside Expo Go. `uriEscapePath: false` matches what the real
// S3 client does — S3's virtual-hosted-style paths aren't re-escaped.
function signerFor(config: S3Config): SignatureV4 {
  return new SignatureV4({
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    region: config.region,
    service: 's3',
    sha256: Sha256,
    uriEscapePath: false,
  });
}

function nonce(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// `objectKey: ''` addresses the bucket itself (path "/"), used by the
// validation checks below. `subresource` signs a bucket sub-resource query
// (e.g. `publicAccessBlock`) — SigV4 requires it in the canonical query
// string as `name=` even though the actual request URL omits the `=`.
//
// Every request also gets a unique `x-yama-nonce` query param, signed like
// any other. Without it, iOS's URLSession (which fetch sits on top of)
// caches responses by URL and can transparently attach a conditional
// revalidation header (If-Modified-Since/If-None-Match) to a *later*
// request that happens to reuse the exact same URL — even across different
// HTTP methods. Observed in practice: a DELETE right after a GET to the
// same object key came back `501 NotImplemented, Header: If-Modified-
// Since` (S3 doesn't support conditional headers on DELETE — and wouldn't
// on PUT either, so a normal upload following a "Restore Latest" GET to
// the same key could hit the same wall). `fetch`'s own `cache` option
// can't fix this — React Native's fetch polyfill only special-cases
// GET/HEAD for it, and does so by *rewriting the URL after this function
// returns*, which would invalidate the signature. A per-request nonce
// baked into the signed query string sidesteps the whole problem: no two
// requests ever share a URL, so there's never a stale cache entry to
// revalidate against, and it incidentally guarantees GET never serves a
// stale cached copy on restore either.
async function signRequest(
  config: S3Config,
  method: 'PUT' | 'GET' | 'DELETE' | 'HEAD',
  objectKey: string,
  body: Uint8Array | null,
  subresource?: string,
): Promise<{ url: string; headers: Record<string, string> }> {
  const hostname = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const path = objectKey ? `/${objectKey}` : '/';
  const query: Record<string, string> = { 'x-yama-nonce': nonce() };
  if (subresource) query[subresource] = '';

  const request = new HttpRequest({
    method,
    protocol: 'https:',
    hostname,
    path,
    query,
    headers: { host: hostname },
    body: body ?? undefined,
  });

  const signed = await signerFor(config).sign(request);
  const queryString = Object.entries(signed.query as Record<string, string>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  // `host` is excluded here — fetch derives it from the URL itself (it's a
  // forbidden header name to set manually), and it's already accounted for
  // in the signature since it was part of the signed request above.
  const { host: _host, ...headers } = signed.headers as Record<string, string>;

  return { url: `https://${hostname}${path}?${queryString}`, headers };
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
  if (!res.ok) throw new Error(`Bucket unreachable — ${res.status} ${await res.text()}`);
}

// Repeats the reachability check unsigned (no credentials at all) — this
// one must fail, proving the bucket root isn't world-listable regardless of
// what this app's own key can do.
async function checkNoAnonymousAccess(config: S3Config): Promise<void> {
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const res = await fetch(`https://${host}/`, { method: 'HEAD', cache: 'no-store' });
  if (res.ok) throw new Error('Bucket allows anonymous (unsigned) access — restrict its bucket policy/ACLs');
}

// Tries to read back the actual test object with no credentials at all —
// must fail. Deliberately not GetBucketPublicAccessBlock: that reads an
// abstract config flag and needs a permission (s3:GetBucketPublicAccessBlock)
// that a reasonably locked-down IAM policy (just List/Get/Put/DeleteObject)
// won't have, which would force every user to widen their bucket's IAM
// policy just to pass this app's own test. Testing the real object
// unauthenticated needs no permission at all (it's anonymous) and is more
// directly relevant anyway: it answers "can a stranger actually read this
// backup", covering both Block Public Access being off *and* a public-read
// bucket policy/ACL on individual objects that checkNoAnonymousAccess's
// bucket-root probe wouldn't catch (ListBucket and GetObject are separate
// grants — a bucket can reject anonymous listing while still serving
// individual public objects).
async function checkObjectNotPublic(config: S3Config, objectKey: string): Promise<void> {
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const res = await fetch(`https://${host}/${objectKey}`, { method: 'GET', cache: 'no-store' });
  if (res.ok) {
    throw new Error(
      'This bucket allows anonymous (unsigned) reads of objects — enable "Block all public access", or remove any public-read bucket policy/ACL',
    );
  }
}

// S3 stamps the bucket's real region on the `x-amz-bucket-region` response
// header for any request to the region-less global endpoint — even an
// unauthenticated one that 403s — so the user never has to look up or type
// their bucket's region. Standard trick AWS's own SDKs/CLI use.
async function detectBucketRegion(bucket: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`https://${bucket}.s3.amazonaws.com/`, { method: 'HEAD', cache: 'no-store' });
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
// publicly exposed — the latter two checks (checkObjectNotPublic,
// checkNoAnonymousAccess) are both unauthenticated, so this whole test only
// ever needs List/Get/Put/DeleteObject on the bucket, nothing broader.
// Thrown message is shown as-is in the config form. Returns the
// auto-detected region so the caller can persist it — see
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
    // Must run before cleanup below — it needs the object to still exist.
    await checkObjectNotPublic(config, key);
  } finally {
    await del(config, key);
  }

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
