# Cloud Sync

## Problem
Backup today is manual-only: "Export Board as .zip" hands a zip to the OS
share sheet; the S3 credential fields in Settings are wired to nothing. No
way to keep a board automatically backed up, or pull it onto a new device,
without remembering to export by hand.

## Goals
- Auto-backup the current board to cloud storage: on every data change
  (debounced) and whenever the app returns to the foreground.
- Support AWS S3 first (finishes the existing stub), then Google Drive.
- Manual "Sync Now" and "Restore Latest from Cloud" actions in Settings.
- Provider-agnostic core so a third provider is a new file, not a rewrite.

## Non-goals
- **Not bidirectional multi-device live sync.** No merge/conflict
  resolution across devices editing concurrently. This is one-way
  device→cloud backup, plus a manual pull that restores as a *new* board
  (same shape as today's "Import App Backup") — same limitation the app
  already has, just automated on the push side.
- **Not true background execution.** `expo-task-manager`/`expo-background-task`
  don't run in Expo Go (confirmed against the v57 docs) and this app has no
  custom dev client. "Auto" here means triggered while the app is open
  (foreground + on-save), not while closed or killed.
- Real iCloud Drive integration, either flavor:
  - A visible iCloud folder via native ubiquity-container APIs: no
    first-party Expo module; needs a native module, a dev-client build, and
    a paid Apple Developer account. Out of scope until the user decides to
    take on that infra.
  - A user-picked iCloud Drive folder via `Directory.pickDirectoryAsync()`
    (no native module needed for this one — Expo Go compatible): rejected
    anyway, because iOS only grants that folder access for the current app
    session (no persisted security-scoped bookmark in Expo's JS API), so it
    could only ever be a manual "pick folder, sync now" action re-prompted
    every cold start — not real auto-sync, and not worth the UI over just
    dragging the Local Backup file into iCloud Drive by hand. See Backlog
    in `docs/IMPLEMENTATION_PLAN.md`.
  - What's shipped instead (`sync/localProvider.ts`) piggybacks on the OS's
    own device backup — see Providers → Local below — which covers "back
    this up somewhere iCloud-ish" without any of that native infra.
- Encrypting the backup blob itself (S3/Drive both support transport TLS;
  provider credentials already never leave the device — see secureStore.ts).

## Architecture
```
src/sync/
  types.ts             CloudProvider interface + SyncSettings shape
  buildBackup.ts        zip-bytes builder, extracted from export/exportBoard.ts
  s3Provider.ts          SigV4-signed fetch, no AWS SDK
  localProvider.ts       writes to Paths.document — rides the OS device backup, no infra
  googleDriveProvider.ts expo-auth-session (PKCE) + Drive REST v3, appDataFolder scope
  cloudSync.ts            orchestrator: debounce + AppState trigger, calls each enabled provider
```

`CloudProvider`:
```ts
interface CloudProvider {
  id: 'aws-s3' | 'google-drive';
  isConfigured(): Promise<boolean>;
  upload(bytes: Uint8Array, fileName: string): Promise<void>;
  downloadLatest(): Promise<Uint8Array | null>; // for "Restore Latest from Cloud"
}
```

`export/exportBoard.ts` currently couples "build the zip" with "open the
share sheet". Split into `sync/buildBackup.ts` (pure, returns `Uint8Array`)
reused by both the share-sheet export and every `CloudProvider.upload()` —
no duplicated table-dump logic.

Restore side reuses `import/appExportImporter.ts` unchanged: cloud download
returns the same zip bytes shape as a picked file, so `pickAppExport.ts`'s
zip-parsing is extracted into a `parseBackupZip(bytes)` helper callable from
both the file-picker path and the cloud-download path.

## Providers

**S3** — raw `fetch` with an AWS Signature V4 header (`expo-crypto` for
SHA-256/HMAC; no SDK — the AWS JS SDK assumes Node APIs RN doesn't have). No
separate display name — the bucket name is the identifier. **Region** is
never typed by the user: S3 stamps the real region on the
`x-amz-bucket-region` response header for any request to the region-less
global endpoint, even an unauthenticated one that 403s, so
`testS3Connection` detects it automatically before running its checks
(store via `settingsRepo`, alongside access key ID/secret which stay in
`secureStore`). Optional **key prefix** nests backups under a folder, for a
bucket shared with other stuff — object key:
`<keyPrefix>/<YYYYMM>/<board-slug>-<YYYYMMDD>.zip` — readable straight out of
an S3 console (which board, taken when, without opening it) and browsable as
month folders. One object per board per day: syncing repeatedly in a day
replaces that day's file rather than piling up near-identical zips, so the
history stays a history without becoming noise.

**Local** — no credentials, no network: writes the same zip to
`Paths.document/backups/<YYYYMM>/<board-slug>-<YYYYMMDD>.zip`. Not off-device
protection —
expo-sqlite's own database already lives at `Documents/SQLite/`, the same
sandbox this zip sits in, so both disappear together on app deletion and
both get restored together by a full device restore either way. Its real
job is a rollback snapshot (undo a bad import, recover from DB corruption)
independent of whatever happened to the live file, plus a manually-
retrievable copy: the `expo-file-system` config plugin (`app.json`) sets
`UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` so a real
device build exposes it in the Files app under "On My iPhone" for the user
to copy elsewhere by hand — that flag only takes effect in a built
app/dev-client, not Expo Go. One toggle in Settings (no bucket/account
concept to manage, unlike S3/Drive).

**Google Drive** — OAuth via `expo-auth-session`'s PKCE flow (Expo Go
compatible, no native module) against scope **`drive.appdata`** specifically
(not full `drive` scope): stores the backup in the user's hidden per-app
`appDataFolder`, invisible in their normal Drive UI, and — practically
important — narrow enough that Google's consent screen works fine in
**Testing** mode with the user added as a test user, no verification review
needed for personal use. Refresh token stored in `secureStore`; access
token refreshed on demand.

User-side setup (Google Cloud Console, one-time): create an OAuth 2.0
Client ID (type: iOS), add the app's bundle ID (`com.solomonxie.buildyourownbudget`) and
a custom URL scheme for the redirect. Hand the Client ID back for
`app.json`'s scheme config — no client secret needed for the PKCE/installed
-app flow.

## Sync trigger
`cloudSync.ts` exposes `scheduleSync()`:
- Called from `bumpDataVersion()`'s call sites indirectly — simplest hook:
  subscribe to `useAppStore`'s `dataVersion` in one place (a root-level
  effect, e.g. `RootNavigator`) and debounce (~5s) before running.
- Also runs once on `AppState` transitioning to `active` (covers "left the
  app mid-edit, came back later").
- Skips silently if no provider is configured/enabled — not an error state.
- Failures are non-blocking (toast/inline Settings status only) — never
  interrupt the money-entry flow for a sync problem.

## Settings UI additions
- S3 section: add Bucket, Region fields next to the existing keys.
- New Google Drive section: "Connect"/"Disconnect", shows connected
  account email once linked.
- Per-provider: "Auto-sync" toggle (default on once configured), "Last
  synced: <relative time>", "Sync Now" button.
- "Restore Latest from Cloud" (per provider) — same confirmation/behavior
  as today's "Import App Backup": always creates a new board.

## Risks / open questions
- SigV4 signing by hand is easy to get subtly wrong (canonical request
  edge cases) — needs a real test against a live bucket before trusting it,
  not just unit tests against fixtures.
- Google's PKCE redirect on iOS needs a custom URL scheme registered in
  `app.json` — first Expo Go-compatible deep-link config in this app;
  confirm `expo-auth-session`'s Expo-Go proxy flow still works on SDK 57
  (docs should be re-checked at implementation time, not assumed).
- Debounce window (5s) is a guess — fine to tune after real use.
- "Last synced" timestamp storage: per-provider, per-board, in
  `settingsRepo` (small KV, already used for exactly this kind of thing).
