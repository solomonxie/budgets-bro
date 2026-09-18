// `aws-s3:<configId>` for S3 (one saved bucket can be many providers),
// plain ids for anything that's inherently singular (a future OAuth
// provider with one connected account).
export type CloudProviderId = string;

// One-way device→cloud backup, not live multi-device sync — see
// docs/design/cloud-sync/DESIGN.md (Non-goals). `downloadLatest` exists only
// for the manual "Restore Latest from Cloud" pull, not automatic merging.
//
// Each provider module exports a `create<X>Provider(db)` factory (not part
// of this interface) that resolves stored credentials and returns `null`
// when unconfigured — callers never see a half-usable CloudProvider, so
// there's no separate `isConfigured()` to remember to check first.
export interface CloudProvider {
  id: CloudProviderId;
  // Where this destination wants today's backup written — a dated key for a
  // bucket that keeps history, a single overwritten one for iCloud. See
  // backupPath.ts.
  keyFor(boardName: string, dateIso: string): string;
  upload(bytes: Uint8Array, key: string): Promise<void>;
  // Every backup key this provider holds, relative to its own root (an S3
  // config's keyPrefix, the iCloud container's Documents folder). Restore
  // reads the list rather than a fixed name because a destination's keys may
  // be dated, and may be left over from an older key layout.
  listKeys(): Promise<string[]>;
  download(key: string): Promise<Uint8Array | null>;
}
