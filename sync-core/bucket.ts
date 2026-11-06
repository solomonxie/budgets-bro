import { sha256 } from './sha256';
import { signS3Request } from './sigv4';
import { bytesToHex } from './bytes';

// The bucket as the sync log sees it: keys relative to the connection's
// prefix, write-once PUTs, and the server's clock. Ported from Photos
// Vault's extension/src/bucket/client.ts, over this app's signer.

export interface ListedObject {
  key: string;
  size: number;
  etag: string;
  lastModified: number;
}

export interface HeadResult {
  size: number;
  etag: string;
  lastModified: number;
}

// 'landed': the key held these exact bytes already (an earlier try).
// 'collision': another writer's bytes — fatal for the writing device.
export type PutOnceResult = 'written' | 'landed' | 'collision';

export interface Bucket {
  list(prefix: string, opts?: { startAfter?: string; max?: number }): Promise<ListedObject[]>;
  get(key: string): Promise<Uint8Array | null>;
  head(key: string): Promise<HeadResult | null>;
  put(key: string, body: Uint8Array, contentType?: string): Promise<void>;
  putOnce(key: string, body: Uint8Array): Promise<PutOnceResult>;
}

export class BucketError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(`${code || status}: ${message}`);
  }
}

export interface S3Connection {
  bucket: string;
  region: string;
  keyPrefix?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body?: ArrayBuffer }) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export interface S3BucketOptions {
  fetch: Fetch;
  // Every response's `Date` header, for Clock.observeDate.
  onDate?: (dateHeader: string | null) => void;
  now?: () => Date;
}

const tag = (xml: string, name: string) => new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml)?.[1];
const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const unquote = (etag: string | null | undefined) => (etag ?? '').replace(/"/g, '');

export const parseList = (xml: string) => ({
  objects: [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(
    ([, c]): ListedObject => ({
      key: unescapeXml(tag(c, 'Key') ?? ''),
      size: Number(tag(c, 'Size') ?? 0),
      etag: unquote(unescapeXml(tag(c, 'ETag') ?? '')),
      lastModified: Date.parse(tag(c, 'LastModified') ?? ''),
    }),
  ),
  truncated: tag(xml, 'IsTruncated') === 'true',
  next: tag(xml, 'NextContinuationToken'),
});

const sameBytes = (a: Uint8Array, b: Uint8Array) => bytesToHex(sha256(a)) === bytesToHex(sha256(b));

export class S3Bucket implements Bucket {
  private readonly root: string;

  constructor(
    private readonly c: S3Connection,
    private readonly opts: S3BucketOptions,
  ) {
    const trimmed = c.keyPrefix?.trim().replace(/^\/+|\/+$/g, '');
    this.root = trimmed ? `${trimmed}/` : '';
  }

  // A per-request nonce keeps iOS's URL cache from attaching a conditional
  // header to a later request on the same URL; see src/sync/s3Provider.ts.
  private async send(
    method: 'GET' | 'PUT' | 'HEAD',
    key: string,
    opts: { query?: Record<string, string>; body?: Uint8Array; headers?: Record<string, string> } = {},
  ) {
    const query = { 'x-budgetsbro-nonce': nonce(), ...opts.query };
    const signed = signS3Request({
      method,
      hostname: `${this.c.bucket}.s3.${this.c.region}.amazonaws.com`,
      path: key ? `/${key}` : '/',
      query,
      body: opts.body ?? null,
      accessKeyId: this.c.accessKeyId,
      secretAccessKey: this.c.secretAccessKey,
      region: this.c.region,
      service: 's3',
      date: this.opts.now?.(),
    });
    const res = await this.opts.fetch(signed.url, {
      method,
      headers: { ...signed.headers, ...opts.headers },
      // A view's backing buffer can span more than the view; send exactly
      // the bytes that were hashed.
      body: opts.body ? (opts.body.slice().buffer as ArrayBuffer) : undefined,
    });
    this.opts.onDate?.(res.headers.get('date'));
    return res;
  }

  private async fail(res: Awaited<ReturnType<Fetch>>): Promise<never> {
    const body = await res.text().catch(() => '');
    throw new BucketError(res.status, tag(body, 'Code') ?? '', tag(body, 'Message') ?? res.statusText);
  }

  async list(prefix: string, opts: { startAfter?: string; max?: number } = {}): Promise<ListedObject[]> {
    const out: ListedObject[] = [];
    let token: string | undefined;
    do {
      const query: Record<string, string> = { 'list-type': '2', prefix: this.root + prefix };
      if (opts.startAfter) query['start-after'] = this.root + opts.startAfter;
      if (token) query['continuation-token'] = token;
      const res = await this.send('GET', '', { query });
      if (!res.ok) await this.fail(res);
      const page = parseList(await res.text());
      out.push(...page.objects.map((o) => ({ ...o, key: o.key.slice(this.root.length) })));
      token = page.truncated ? page.next : undefined;
    } while (token && (opts.max === undefined || out.length < opts.max));
    return opts.max === undefined ? out : out.slice(0, opts.max);
  }

  async get(key: string): Promise<Uint8Array | null> {
    const res = await this.send('GET', this.root + key);
    if (res.status === 404) return null;
    if (!res.ok) await this.fail(res);
    return new Uint8Array(await res.arrayBuffer());
  }

  async head(key: string): Promise<HeadResult | null> {
    const res = await this.send('HEAD', this.root + key);
    if (res.status === 404) return null;
    if (!res.ok) throw new BucketError(res.status, '', res.statusText);
    return {
      size: Number(res.headers.get('content-length') ?? 0),
      etag: unquote(res.headers.get('etag')),
      lastModified: Date.parse(res.headers.get('last-modified') ?? ''),
    };
  }

  async put(key: string, body: Uint8Array, contentType = 'application/octet-stream'): Promise<void> {
    const res = await this.send('PUT', this.root + key, { body, headers: { 'content-type': contentType } });
    if (!res.ok) await this.fail(res);
  }

  // Compared by reading the object back rather than by ETag: a segment is
  // at most 256 KB, and this needs no MD5.
  async putOnce(key: string, body: Uint8Array): Promise<PutOnceResult> {
    const res = await this.send('PUT', this.root + key, {
      body,
      headers: { 'if-none-match': '*', 'content-type': 'application/gzip' },
    });
    if (res.ok) return 'written';
    if (res.status !== 412 && res.status !== 409) await this.fail(res);
    const there = await this.get(key);
    return there && sameBytes(there, body) ? 'landed' : 'collision';
  }
}

function nonce(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
