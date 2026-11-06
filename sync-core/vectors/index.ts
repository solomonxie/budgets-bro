import type { Scalar, VersionVector, WireOp } from '../types';

import budgetEntryDerivedGid from './budget-entry-derived-gid.json';
import clockFarAheadIgnored from './clock-far-ahead-ignored.json';
import concurrentTextSet from './concurrent-text-set.json';
import deadNotNullRefHides from './dead-not-null-ref-hides.json';
import deadNullableRefNulls from './dead-nullable-ref-nulls.json';
import deadRefRestored from './dead-ref-restored.json';
import deleteVsConcurrentEdit from './delete-vs-concurrent-edit.json';
import groupTickTransferPair from './group-tick-transfer-pair.json';
import importIdCollision from './import-id-collision.json';
import lwwPerField from './lww-per-field.json';
import opsBeforeAdd from './ops-before-add.json';
import parkedTargetMissing from './parked-target-missing.json';
import parkedThenTargetArrives from './parked-then-target-arrives.json';
import payeeAliasThenRenameSplit from './payee-alias-then-rename-split.json';
import payeeAlias from './payee-alias.json';
import reAddMergesPerField from './re-add-merges-per-field.json';
import sameStampTiebreakByDevice from './same-stamp-tiebreak-by-device.json';
import sequentialTextSet from './sequential-text-set.json';
import threeWayConflictOpen from './three-way-conflict-open.json';
import threeWayConflictThenResolve from './three-way-conflict-then-resolve.json';
import undoAfterDelete from './undo-after-delete.json';

export interface VectorSegment {
  d: string;
  seq: number;
  vv: VersionVector;
  lastModified: number;
  ops: WireOp[];
}

export interface Vector {
  name: string;
  note?: string;
  segments: VectorSegment[];
  expect: {
    entities: Record<string, { fields: Record<string, Scalar> }>;
    conflicts: { e: string; id: string; f: string; x: Scalar; d: string }[];
    aliases?: Record<string, string>;
    hidden?: string[];
    // Materialised row per key (FKs resolved), null = no row. Only keys listed are checked.
    rows?: Record<string, Record<string, Scalar> | null>;
  };
}

export const vectors = [
  budgetEntryDerivedGid,
  clockFarAheadIgnored,
  concurrentTextSet,
  deadNotNullRefHides,
  deadNullableRefNulls,
  deadRefRestored,
  deleteVsConcurrentEdit,
  groupTickTransferPair,
  importIdCollision,
  lwwPerField,
  opsBeforeAdd,
  parkedTargetMissing,
  parkedThenTargetArrives,
  payeeAliasThenRenameSplit,
  payeeAlias,
  reAddMergesPerField,
  sameStampTiebreakByDevice,
  sequentialTextSet,
  threeWayConflictOpen,
  threeWayConflictThenResolve,
  undoAfterDelete,
] as Vector[];
