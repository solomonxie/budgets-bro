import type { S3Connection } from '../../../sync-core/bucket';

// The bucket connection, in chrome.storage.local only: `.sync` would carry
// the secret to every machine signed in to the same Google account.

export type Connection = S3Connection & { keyPrefix: string };

// The phone's default (src/sync/s3Provider.ts DEFAULT_S3_KEY_PREFIX).
export const DEFAULT_PREFIX = 'budgets-bro';
export const ACCESS_KEY_LENGTH = 20;
export const SECRET_KEY_LENGTH = 40;

const key = 'connection';
const draftsKey = 'drafts';

export const loadConnection = async (): Promise<Connection | null> =>
  ((await chrome.storage.local.get(key))[key] as Connection | undefined) ?? null;

export const saveConnection = (c: Connection) => chrome.storage.local.set({ [key]: c });

export const forgetConnection = () => chrome.storage.local.remove(key);

// Same as the phone: no leading or trailing slash, empty for the bucket root.
export const normalizePrefix = (p: string) => p.trim().replace(/^\/+|\/+$/g, '');

// Host access for this one bucket, not all of S3. The global host answers
// where a bucket lives; the regional one is only known after that.
export const originsFor = (c: Pick<Connection, 'bucket' | 'region'>) => [
  `https://${c.bucket}.s3.amazonaws.com/*`,
  ...(c.region ? [`https://${c.bucket}.s3.${c.region}.amazonaws.com/*`] : []),
];

// Every attempt, keyed by bucket + prefix + key id, so a failed Connect never
// means retyping a secret. Dropped once one succeeds.
export type Draft = Connection;

const draftId = (d: Draft) => `${d.bucket}|${d.keyPrefix}|${d.accessKeyId}`;

export const loadDrafts = async (): Promise<Draft[]> =>
  ((await chrome.storage.local.get(draftsKey))[draftsKey] as Draft[] | undefined) ?? [];

export async function keepDraft(d: Draft) {
  const rest = (await loadDrafts()).filter((x) => draftId(x) !== draftId(d));
  await chrome.storage.local.set({ [draftsKey]: [d, ...rest].slice(0, 5) });
}

export async function dropDraft(d: Draft) {
  await chrome.storage.local.set({ [draftsKey]: (await loadDrafts()).filter((x) => draftId(x) !== draftId(d)) });
}

// S3 names a bucket's region on an unsigned HEAD, even one it refuses.
export async function detectRegion(bucket: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchFn(`https://${bucket}.s3.amazonaws.com/`, { method: 'HEAD', cache: 'no-store' });
    return res.headers.get('x-amz-bucket-region');
  } catch {
    return null;
  }
}
