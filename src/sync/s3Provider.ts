import type { SQLiteDatabase } from 'expo-sqlite';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { secureStore } from '../secure/secureStore';
import * as settingsRepo from '../db/repositories/settingsRepo';
import type { CloudProvider } from './types';

const CONFIGS_KEY = 'sync_s3_configs';

// Bucket/region/name are plain settings; access key + secret live in
// secureStore instead, keyed by `id` — see secureStore.getS3Credentials.
export interface S3ConfigMeta {
  id: string;
  name: string;
  bucket: string;
  region: string;
}

export interface S3ConfigInput {
  name: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

interface S3Config extends S3ConfigMeta {
  accessKeyId: string;
  secretAccessKey: string;
}

function newConfigId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function listS3Configs(db: SQLiteDatabase): Promise<S3ConfigMeta[]> {
  return settingsRepo.getJsonSetting<S3ConfigMeta[]>(db, CONFIGS_KEY, []);
}

// Saves the config — call testS3Connection first if the caller wants to
// reject bad credentials before they're persisted (Settings' "Add S3
// Backup" form does).
export async function addS3Config(db: SQLiteDatabase, input: S3ConfigInput): Promise<string> {
  const id = newConfigId();
  const configs = await listS3Configs(db);
  await settingsRepo.setJsonSetting(db, CONFIGS_KEY, [
    ...configs,
    { id, name: input.name.trim() || input.bucket.trim(), bucket: input.bucket.trim(), region: input.region.trim() },
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
async function signRequest(
  config: S3Config,
  method: 'PUT' | 'GET' | 'DELETE',
  objectKey: string,
  body: Uint8Array | null,
): Promise<{ url: string; headers: Record<string, string> }> {
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = bytesToHex(sha256(body ?? new Uint8Array(0)));

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [method, `/${objectKey}`, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

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
    url: `https://${host}/${objectKey}`,
    // `host` isn't set here — fetch derives it from the URL itself, and it's
    // already accounted for in the signature via canonicalHeaders above.
    headers: { 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, Authorization: authorization },
  };
}

async function put(config: S3Config, objectKey: string, body: Uint8Array): Promise<void> {
  const { url, headers } = await signRequest(config, 'PUT', objectKey, body);
  const res = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: body.buffer as ArrayBuffer });
  if (!res.ok) throw new Error(`S3 PUT failed: ${res.status} ${await res.text()}`);
}

async function del(config: S3Config, objectKey: string): Promise<void> {
  const { url, headers } = await signRequest(config, 'DELETE', objectKey, null);
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE failed: ${res.status} ${await res.text()}`);
}

// Proves the credentials can actually write to (and clean up after
// themselves in) this bucket — a marker object round-trip, not just a
// reachability check. Thrown message is shown as-is in the config form.
export async function testS3Connection(input: S3ConfigInput): Promise<void> {
  const config: S3Config = { id: '_test_', name: input.name, bucket: input.bucket.trim(), region: input.region.trim(), accessKeyId: input.accessKeyId.trim(), secretAccessKey: input.secretAccessKey.trim() };
  const key = `.yet-another-money-app-connection-test-${Date.now()}`;
  await put(config, key, utf8ToBytes('ok'));
  await del(config, key);
}

function toProvider(meta: S3ConfigMeta): CloudProvider {
  return {
    id: `aws-s3:${meta.id}`,
    async upload(bytes, fileName) {
      const config = await resolveConfig(meta);
      if (!config) throw new Error(`S3 config "${meta.name}" is missing its credentials`);
      await put(config, fileName, bytes);
    },
    async downloadLatest(fileName) {
      const config = await resolveConfig(meta);
      if (!config) return null;
      const { url, headers } = await signRequest(config, 'GET', fileName, null);
      const res = await fetch(url, { method: 'GET', headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`S3 download failed: ${res.status} ${await res.text()}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

// One CloudProvider per saved bucket — cloudSync.ts fans a backup out to
// every one of them concurrently (Promise.all), same as any other provider.
export async function createS3Providers(db: SQLiteDatabase): Promise<CloudProvider[]> {
  const configs = await listS3Configs(db);
  return configs.map(toProvider);
}
