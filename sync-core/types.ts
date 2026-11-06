export const protocolVersion = 1;

export type Scalar = string | number | null;
export type VersionVector = Record<string, number>;
export type OpKind = 'add' | 'set';

// One op line as written in a segment; `d`, `seq`, `vv` come from the header.
export interface WireOp {
  h: string;
  e: string;
  id: string;
  o: OpKind;
  f?: string;
  x?: Scalar | Record<string, Scalar>;
}

export interface Op extends WireOp {
  d: string;
  seq: number;
  vv: VersionVector;
}

// One local transaction: every op shares one hlc (PROTOCOL.md "one tick per group").
export type Group = WireOp[];

export interface Segment {
  d: string;
  seq: number;
  vv: VersionVector;
  ops: Op[];
  // Server time the object landed; 0 until read back from the bucket.
  lastModified: number;
}

export interface CheckpointHeader {
  v: number;
  d: string;
  h: string;
  vv: VersionVector;
}

export interface FieldValue {
  x: Scalar;
  s: string;
}

export interface HeadValue {
  x: Scalar;
  s: string;
  seq: number;
  vv: VersionVector;
}

export interface CheckpointEntity {
  e: string;
  id: string;
  exists: boolean;
  f: Record<string, FieldValue>;
  heads: Record<string, HeadValue[]>;
}

export interface Checkpoint {
  header: CheckpointHeader;
  entities: CheckpointEntity[];
}

// Written by a newer app: stop writing, keep pulling read-only.
export class NewerProtocol extends Error {
  constructor(readonly v: number) {
    super(`sync protocol ${v} is newer than ${protocolVersion}`);
  }
}

export interface Gzip {
  deflate(bytes: Uint8Array): Promise<Uint8Array>;
  inflate(bytes: Uint8Array): Promise<Uint8Array>;
}

export const stampOf = (op: Pick<Op, 'h' | 'd'>): string => `${op.h}@${op.d}`;
