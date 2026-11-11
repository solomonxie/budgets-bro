import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bucket, ListedObject } from '../../sync-core/bucket';
import { parseS3ConfigText } from '../../sync-core/parseS3ConfigText';
import {
  type Connection,
  detectRegion,
  dropDraft,
  forgetConnection,
  keepDraft,
  loadConnection,
  loadDrafts,
  normalizePrefix,
  originsFor,
  saveConnection,
} from '../src/setup/connection';
import { probe } from '../src/setup/probe';

let area: Record<string, unknown>;
const local = {
  get: async (k: string) => (k in area ? { [k]: structuredClone(area[k]) } : {}),
  set: async (items: Record<string, unknown>) => void Object.assign(area, structuredClone(items)),
  remove: async (k: string) => void delete area[k],
};
const sync = { set: vi.fn() };
vi.stubGlobal('chrome', { storage: { local, sync } });

const conn = (over: Partial<Connection> = {}): Connection => ({
  bucket: 'my-bucket',
  region: 'us-west-2',
  keyPrefix: 'budgets-bro',
  accessKeyId: 'AKIAAAAAAAAAAAAAAAAA',
  secretAccessKey: 'secret',
  ...over,
});

beforeEach(() => {
  area = {};
  sync.set.mockClear();
});

describe('connection storage', () => {
  it('saves, loads and forgets, in local only', async () => {
    expect(await loadConnection()).toBeNull();
    await saveConnection(conn());
    expect(await loadConnection()).toEqual(conn());
    await forgetConnection();
    expect(await loadConnection()).toBeNull();
    expect(sync.set).not.toHaveBeenCalled();
  });

  it('keeps the latest five drafts, one per bucket + prefix + key id', async () => {
    for (let i = 0; i < 7; i++) await keepDraft(conn({ bucket: `b${i}` }));
    await keepDraft(conn({ bucket: 'b6', secretAccessKey: 'newer' }));
    const list = await loadDrafts();
    expect(list.map((d) => d.bucket)).toEqual(['b6', 'b5', 'b4', 'b3', 'b2']);
    expect(list[0]!.secretAccessKey).toBe('newer');
    await dropDraft(conn({ bucket: 'b5' }));
    expect((await loadDrafts()).map((d) => d.bucket)).toEqual(['b6', 'b4', 'b3', 'b2']);
  });
});

describe('helpers', () => {
  it('normalizes the prefix like the phone', () => {
    expect(normalizePrefix(' /budgets-bro/ ')).toBe('budgets-bro');
    expect(normalizePrefix('a/b/')).toBe('a/b');
    expect(normalizePrefix('/')).toBe('');
  });

  it('asks for this bucket only, regional host once known', () => {
    expect(originsFor({ bucket: 'b', region: '' })).toEqual(['https://b.s3.amazonaws.com/*']);
    expect(originsFor({ bucket: 'b', region: 'eu-west-1' })).toEqual([
      'https://b.s3.amazonaws.com/*',
      'https://b.s3.eu-west-1.amazonaws.com/*',
    ]);
  });

  it('detects the region from the header, null on failure', async () => {
    const ok = vi.fn(async () => new Response(null, { status: 403, headers: { 'x-amz-bucket-region': 'ca-central-1' } }));
    expect(await detectRegion('b', ok)).toBe('ca-central-1');
    expect(ok).toHaveBeenCalledWith('https://b.s3.amazonaws.com/', expect.objectContaining({ method: 'HEAD' }));
    expect(await detectRegion('b', async () => new Response(null, { status: 404 }))).toBeNull();
    expect(await detectRegion('b', async () => Promise.reject(new Error('offline')))).toBeNull();
  });

  it('parses a pasted block with the shared parser', () => {
    expect(parseS3ConfigText('bucket: my-bucket\nprefix: budgets-bro/\nexport AWS_SECRET_ACCESS_KEY="a/b=="')).toEqual({
      bucket: 'my-bucket',
      keyPrefix: 'budgets-bro/',
      secretAccessKey: 'a/b==',
    });
  });
});

describe('probe', () => {
  const bucketWith = (keys: string[]): Bucket => ({
    list: async (prefix, opts) =>
      keys
        .filter((k) => k.startsWith(prefix))
        .sort()
        .slice(0, opts?.max)
        .map((key): ListedObject => ({ key, size: 1, etag: '', lastModified: 0 })),
    get: async () => null,
    head: async () => null,
    put: async () => {},
    putOnce: async () => 'written',
  });

  it('is ready once a checkpoint exists', async () => {
    expect(await probe(bucketWith(['sync/checkpoints/d/1.ndjson.gz', 'sync/log/d/000000000001.ndjson.gz']))).toBe('ready');
  });

  it('waits on a started log or daily zips', async () => {
    expect(await probe(bucketWith(['sync/devices/d.json']))).toBe('waiting');
    expect(await probe(bucketWith(['20261110_daily_home.zip']))).toBe('waiting');
  });

  it('is empty with nothing of ours', async () => {
    expect(await probe(bucketWith([]))).toBe('empty');
    expect(await probe(bucketWith(['photos/a.jpg']))).toBe('empty');
  });
});
