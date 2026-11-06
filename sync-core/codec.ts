import { format, type Hlc } from './clock';
import { bytesToUtf8, utf8ToBytes } from './bytes';
import {
  type Checkpoint,
  type CheckpointEntity,
  type CheckpointHeader,
  type Group,
  type Gzip,
  NewerProtocol,
  type Op,
  protocolVersion,
  type Segment,
  type VersionVector,
  type WireOp,
} from './types';

export const segmentMaxOps = 200;
// Measured on the uncompressed op lines, so the cut is known before gzip.
export const segmentMaxBytes = 256 * 1024;

export const segmentKey = (d: string, seq: number) =>
  `sync/log/${d}/${String(seq).padStart(12, '0')}.ndjson.gz`;

export const seqOf = (key: string): number | null => {
  const m = /\/(\d{12})\.ndjson\.gz$/.exec(key);
  return m ? Number(m[1]) : null;
};

export const checkpointKey = (d: string, h: Hlc | string) =>
  `sync/checkpoints/${d}/${typeof h === 'string' ? h : format(h)}.ndjson.gz`;

export const hlcOfCheckpointKey = (key: string): string | null =>
  /\/(\d{13}-\d{4})\.ndjson\.gz$/.exec(key)?.[1] ?? null;

export const toWire = (op: WireOp): WireOp => {
  const w: WireOp = { h: op.h, e: op.e, id: op.id, o: op.o };
  if (op.f !== undefined) w.f = op.f;
  w.x = op.x ?? null;
  return w;
};

const lineBytes = (op: WireOp) => utf8ToBytes(JSON.stringify(toWire(op))).length + 1;

// Cuts only between groups; a group past either cap goes alone, uncapped.
export function cutSegments(
  groups: Group[],
  maxOps = segmentMaxOps,
  maxBytes = segmentMaxBytes,
): WireOp[][] {
  const out: WireOp[][] = [];
  let cur: WireOp[] = [];
  let bytes = 0;
  for (const g of groups) {
    if (g.length === 0) continue;
    const gBytes = g.reduce((n, op) => n + lineBytes(op), 0);
    if (cur.length > 0 && (cur.length + g.length > maxOps || bytes + gBytes > maxBytes)) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(...g);
    bytes += gBytes;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

const encodeLines = (gz: Gzip, lines: string[]) => gz.deflate(utf8ToBytes(lines.join('\n')));

const decodeLines = async (gz: Gzip, bytes: Uint8Array) =>
  bytesToUtf8(await gz.inflate(bytes))
    .split('\n')
    .filter((l) => l.length > 0);

export const encodeSegment = (gz: Gzip, d: string, seq: number, vv: VersionVector, ops: WireOp[]) =>
  encodeLines(gz, [
    JSON.stringify({ v: protocolVersion, d, seq, vv, n: ops.length }),
    ...ops.map((op) => JSON.stringify(toWire(op))),
  ]);

export async function decodeSegment(gz: Gzip, bytes: Uint8Array, lastModified: number): Promise<Segment> {
  const lines = await decodeLines(gz, bytes);
  const head = JSON.parse(lines[0] ?? '{}') as { v: number; d: string; seq: number; vv: VersionVector; n: number };
  if (head.v > protocolVersion) throw new NewerProtocol(head.v);
  const ops: Op[] = lines.slice(1).map((l) => ({
    ...(JSON.parse(l) as WireOp),
    d: head.d,
    seq: head.seq,
    vv: head.vv,
  }));
  if (ops.length !== head.n) throw new Error(`segment ${head.d}/${head.seq}: ${ops.length} of ${head.n} ops`);
  return { d: head.d, seq: head.seq, vv: head.vv, ops, lastModified };
}

export const encodeCheckpoint = (
  gz: Gzip,
  header: Omit<CheckpointHeader, 'v'>,
  entities: Iterable<CheckpointEntity>,
) => {
  const lines = [JSON.stringify({ v: protocolVersion, d: header.d, h: header.h, vv: header.vv })];
  for (const ent of entities) {
    lines.push(JSON.stringify({ e: ent.e, id: ent.id, exists: ent.exists, f: ent.f, heads: ent.heads }));
  }
  return encodeLines(gz, lines);
};

export async function decodeCheckpoint(gz: Gzip, bytes: Uint8Array): Promise<Checkpoint> {
  const lines = await decodeLines(gz, bytes);
  const header = JSON.parse(lines[0] ?? '{}') as CheckpointHeader;
  if (header.v > protocolVersion) throw new NewerProtocol(header.v);
  return { header, entities: lines.slice(1).map((l) => JSON.parse(l) as CheckpointEntity) };
}
