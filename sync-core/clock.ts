// Hybrid logical clock, `<wall:013d>-<counter:04d>`, ported from Photos
// Vault's extension/src/sync/hlc.ts. Fixed width, so it sorts as a string.

export interface Hlc {
  wall: number;
  counter: number;
}

export const zero: Hlc = { wall: 0, counter: 0 };

// Ops stamped further than this past their segment's LastModified are ignored.
export const maxSegmentLeadMs = 3_600_000;
// Ops further than this ahead of the receiver are rejected as a sync error.
export const maxReceiveLeadMs = 86_400_000;

const maxCounter = 9999;

export const parse = (s: string): Hlc => {
  const dash = s.indexOf('-');
  return { wall: Number(s.slice(0, dash)), counter: Number(s.slice(dash + 1)) };
};

export const format = (h: Hlc): string =>
  `${String(h.wall).padStart(13, '0')}-${String(h.counter).padStart(4, '0')}`;

export const compare = (a: Hlc, b: Hlc): number =>
  a.wall !== b.wall ? a.wall - b.wall : a.counter - b.counter;

// A bootstrap can stamp more than 10k ops inside one millisecond; past four
// digits the counter would stop sorting as a string, so the wall moves on.
export const tick = (last: Hlc, now: number): Hlc => {
  if (now > last.wall) return { wall: now, counter: 0 };
  if (last.counter >= maxCounter) return { wall: last.wall + 1, counter: 0 };
  return { wall: last.wall, counter: last.counter + 1 };
};

export const receive = (last: Hlc, seen: Hlc): Hlc => (compare(last, seen) >= 0 ? last : seen);

export const stamp = (h: Hlc | string, device: string): string =>
  `${typeof h === 'string' ? h : format(h)}@${device}`;

export const parseStamp = (s: string): { hlc: Hlc; device: string } => {
  const at = s.indexOf('@');
  return { hlc: parse(s.slice(0, at)), device: s.slice(at + 1) };
};

// Bucket time minus local time, from a response's `Date` header. Null when
// the header is missing or unparseable, so the caller keeps its last offset.
export const offsetFromDate = (dateHeader: string | null | undefined, localNow: number): number | null => {
  if (!dateHeader) return null;
  const bucket = Date.parse(dateHeader);
  return Number.isNaN(bucket) ? null : bucket - localNow;
};

export const beyondSegment = (h: Hlc, segmentLastModified: number): boolean =>
  h.wall > segmentLastModified + maxSegmentLeadMs;

export const tooFarAhead = (h: Hlc, now: number): boolean => h.wall > now + maxReceiveLeadMs;

// Local clock in bucket time. `now` injectable for tests.
export class Clock {
  last: Hlc;
  offset = 0;

  constructor(
    last: Hlc = zero,
    private readonly now: () => number = Date.now,
  ) {
    this.last = last;
  }

  bucketNow(): number {
    return this.now() + this.offset;
  }

  observeDate(dateHeader: string | null | undefined): void {
    const offset = offsetFromDate(dateHeader, this.now());
    if (offset !== null) this.offset = offset;
  }

  tick(): Hlc {
    this.last = tick(this.last, this.bucketNow());
    return this.last;
  }

  receive(seen: Hlc): void {
    this.last = receive(this.last, seen);
  }
}
