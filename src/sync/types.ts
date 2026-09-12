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
  upload(bytes: Uint8Array, fileName: string): Promise<void>;
  downloadLatest(fileName: string): Promise<Uint8Array | null>;
}
