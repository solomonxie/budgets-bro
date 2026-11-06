import { BucketError, S3Bucket, parseList } from './bucket';
import { bytesToUtf8, utf8ToBytes } from './bytes';

interface Call {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body?: Uint8Array;
}

function fakeS3(initial: Record<string, Uint8Array> = {}) {
  const objects = new Map(Object.entries(initial));
  const calls: Call[] = [];
  const respond = (status: number, body: Uint8Array | string = '', headers: Record<string, string> = {}) => {
    const bytes = typeof body === 'string' ? utf8ToBytes(body) : body;
    const all: Record<string, string> = { date: 'Fri, 06 Nov 2026 10:00:00 GMT', ...headers };
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      headers: { get: (n: string) => all[n.toLowerCase()] ?? null },
      text: async () => bytesToUtf8(bytes),
      arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer,
    };
  };
  const fetch = async (raw: string, init: { method: string; headers: Record<string, string>; body?: ArrayBuffer }) => {
    const url = new URL(raw);
    const body = init.body ? new Uint8Array(init.body) : undefined;
    calls.push({ url, method: init.method, headers: init.headers, body });
    const key = decodeURIComponent(url.pathname.slice(1));
    if (init.method === 'GET' && key === '') {
      const prefix = url.searchParams.get('prefix') ?? '';
      const after = url.searchParams.get('start-after') ?? '';
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix) && k > after).sort();
      const xml = `<ListBucketResult><IsTruncated>false</IsTruncated>${keys
        .map(
          (k) =>
            `<Contents><Key>${k}</Key><Size>${objects.get(k)!.length}</Size><ETag>&quot;e&quot;</ETag><LastModified>2026-11-06T10:00:00.000Z</LastModified></Contents>`,
        )
        .join('')}</ListBucketResult>`;
      return respond(200, xml);
    }
    const there = objects.get(key);
    if (init.method === 'GET') return there ? respond(200, there) : respond(404);
    if (init.method === 'HEAD')
      return there
        ? respond(200, '', { 'content-length': String(there.length), etag: '"abc"', 'last-modified': 'Fri, 06 Nov 2026 09:00:00 GMT' })
        : respond(404);
    if (init.headers['if-none-match'] === '*' && there) return respond(412, '<Error><Code>PreconditionFailed</Code></Error>');
    objects.set(key, body!);
    return respond(200);
  };
  return { fetch, objects, calls };
}

const conn = { bucket: 'b', region: 'us-east-1', keyPrefix: '/budgets-bro/', accessKeyId: 'AK', secretAccessKey: 'SK' };

describe('S3Bucket', () => {
  it('keys are relative to the prefix, lists start after a key', async () => {
    const s3 = fakeS3({
      'budgets-bro/sync/log/a/000000000001.ndjson.gz': utf8ToBytes('1'),
      'budgets-bro/sync/log/a/000000000002.ndjson.gz': utf8ToBytes('2'),
      'other/x': utf8ToBytes('x'),
    });
    const bucket = new S3Bucket(conn, { fetch: s3.fetch });
    const listed = await bucket.list('sync/log/a/', { startAfter: 'sync/log/a/000000000001.ndjson.gz' });
    expect(listed.map((o) => o.key)).toEqual(['sync/log/a/000000000002.ndjson.gz']);
    expect(listed[0].etag).toBe('e');
    expect(listed[0].lastModified).toBe(Date.parse('2026-11-06T10:00:00Z'));
    expect(await bucket.get('sync/log/a/000000000001.ndjson.gz')).toEqual(utf8ToBytes('1'));
    expect(await bucket.get('missing')).toBeNull();
  });

  it('putOnce: written, then landed for the same bytes, collision for others', async () => {
    const s3 = fakeS3();
    const bucket = new S3Bucket(conn, { fetch: s3.fetch });
    expect(await bucket.putOnce('sync/log/a/1', utf8ToBytes('seg'))).toBe('written');
    expect(s3.calls[0].headers['if-none-match']).toBe('*');
    expect(await bucket.putOnce('sync/log/a/1', utf8ToBytes('seg'))).toBe('landed');
    expect(await bucket.putOnce('sync/log/a/1', utf8ToBytes('other'))).toBe('collision');
    expect(s3.objects.get('budgets-bro/sync/log/a/1')).toEqual(utf8ToBytes('seg'));
  });

  it('sends exactly the viewed bytes of a sliced buffer', async () => {
    const s3 = fakeS3();
    const bucket = new S3Bucket(conn, { fetch: s3.fetch });
    const backing = utf8ToBytes('xxhelloxx');
    await bucket.put('k', backing.subarray(2, 7));
    expect(s3.objects.get('budgets-bro/k')).toEqual(utf8ToBytes('hello'));
  });

  it('head, signed requests, and the server Date', async () => {
    const dates: (string | null)[] = [];
    const s3 = fakeS3({ 'budgets-bro/k': utf8ToBytes('abc') });
    const bucket = new S3Bucket(conn, { fetch: s3.fetch, onDate: (d) => dates.push(d) });
    expect(await bucket.head('k')).toEqual({ size: 3, etag: 'abc', lastModified: Date.parse('Fri, 06 Nov 2026 09:00:00 GMT') });
    expect(await bucket.head('nope')).toBeNull();
    expect(dates).toEqual(['Fri, 06 Nov 2026 10:00:00 GMT', 'Fri, 06 Nov 2026 10:00:00 GMT']);
    expect(s3.calls[0].headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AK\//);
    expect(s3.calls[0].url.host).toBe('b.s3.us-east-1.amazonaws.com');
    expect(s3.calls[0].url.searchParams.get('x-budgetsbro-nonce')).not.toBe(s3.calls[1].url.searchParams.get('x-budgetsbro-nonce'));
  });

  it('errors carry the S3 code', async () => {
    const bucket = new S3Bucket(conn, {
      fetch: async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: { get: () => null },
        text: async () => '<Error><Code>AccessDenied</Code><Message>no</Message></Error>',
        arrayBuffer: async () => new ArrayBuffer(0),
      }),
    });
    await expect(bucket.get('k')).rejects.toEqual(new BucketError(403, 'AccessDenied', 'no'));
  });

  it('parseList unescapes keys', () => {
    const page = parseList('<Contents><Key>a&amp;b</Key><Size>1</Size></Contents><IsTruncated>true</IsTruncated><NextContinuationToken>t</NextContinuationToken>');
    expect(page.objects[0].key).toBe('a&b');
    expect(page).toMatchObject({ truncated: true, next: 't' });
  });
});
