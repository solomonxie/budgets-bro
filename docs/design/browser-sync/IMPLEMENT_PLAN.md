# Browser sync — implementation plan

Why: `DESIGN.md` · Screens: `UIUX_DESIGN.md`.
Release device build only; measure app size and bundle before/after Phase 3
(`docs/DESIGN.md` "Size and speed budget").

## Phase 1: Protocol and shared core
Everything else speaks this format. Pure TS with no RN or DOM imports, so it
runs under jest (app) and vitest (extension) against the same vectors before
any storage exists.

- [x] T1.1 Write `PROTOCOL.md` — PV v1 adapted: entity table per synced table (fields, text fields, FK fields as gids), natural-key rules, alias op, atomic group marker — see `docs/design/browser-sync/` + `photos-vault/docs/design/cloud-sync/PROTOCOL.md` — depends: none
- [x] T1.2 `sync-core/` package skeleton — tsconfig, no deps, imported by `src/` (metro) and `extension/` (esbuild) via relative path — see `sync-core/` — depends: none
- [x] T1.3 HLC + stamps + bucket-time offset — see `sync-core/clock.ts` — depends: T1.2
- [ ] T1.4 Segment + checkpoint codec (ndjson, header, size caps, gzip via injected deflate/inflate) — see `sync-core/codec.ts` — depends: T1.1, T1.2
- [ ] T1.5 Merge engine: per-field LWW, text heads/conflicts, seen-by-vv, parked dangling refs, natural-key alias — see `sync-core/merge.ts` — depends: T1.1, T1.3
- [ ] T1.6 Vectors + permutation runner (every per-device-ordered interleaving, duplicates) incl. transfer pair, payee alias with attached transactions, delete vs edit, undo — see `sync-core/vectors/` — depends: T1.4, T1.5
- [x] T1.7 Bucket client interface (list/get/put-once/head + MD5 check) over existing SigV4 — move `src/sync/sigv4.ts` + `sha256.ts` into `sync-core/` and re-export — see `sync-core/bucket.ts` — depends: T1.2

## Phase 2: Phone identity
The phone holds the only real data, so gids must exist and survive
backup/restore before any op is written.

- [ ] T2.1 Migration 046: `gid` + unique index on every synced table, UUID backfill, derived gid for `budget_entries`; change-log triggers for `boards`, `houses`, `community_prices`, `house_prices`; `rebuildChangeLogTriggers` — see `databases/migrations/` — depends: T1.1
- [ ] T2.2 Repos assign gid on insert (one helper, every insert path incl. import, seed, scheduled posting) — see `src/db/repositories/` — depends: T2.1
- [ ] T2.3 Backup zip + restore carry gids; restore of an old zip backfills; restore takes a new device id — see `src/sync/buildBackup.ts`, `src/import/` — depends: T2.1
- [ ] T2.4 `sync_*` tables (device, hlc, vv, outbox cursor, remote seq ranges, parked, conflicts, aliases) — see `databases/migrations/` — depends: T2.1

## Phase 3: Phone sync engine
Push before pull: the bootstrap checkpoint is what unblocks the extension.

- [ ] T3.1 Outbox builder: `change_log` rows past cursor, minus remote ranges → ops (id→gid, FK→gid, diff→sets), grouped by local transaction — see `src/sync/outbox.ts` — depends: T1.5, T2.2, T2.4
- [ ] T3.2 Pusher: seal segment, put-once, device file, flush on 2 s quiet / 200 ops / background — see `src/sync/push.ts` — depends: T1.7, T3.1
- [ ] T3.3 Bootstrap: every row of every board as `add`, then checkpoint; join-existing path adopts cloud checkpoint — see `src/sync/bootstrap.ts` — depends: T3.2
- [ ] T3.4 Applier: pull per device prefix, merge, write rows in one transaction (gid→id, alias remap, delete/undelete), record remote seq range — see `src/sync/apply.ts` — depends: T1.5, T2.4
- [ ] T3.5 Triggers: pull on foreground and after own push; no timers; skipped in demo mode — see `src/sync/cloudSync.ts`, `App.tsx` — depends: T3.2, T3.4
- [ ] T3.6 Daily checkpoint publisher (most ops since last) — see `src/sync/checkpoint.ts` — depends: T3.3, T3.4
- [ ] T3.7 Device perf check: apply 2k ops on a Release build without a dropped frame; bundle + app size vs budget — see `docs/DESIGN.md` — depends: T3.5

## Phase 4: Phone UI
Thin: a switch, devices, conflicts. Comes after the engine so it binds real state.

- [ ] T4.1 Settings > Backup: "Sync with browser" on the S3 row, device list, status — see `src/screens/settings/BackupSection.tsx` — depends: T3.5
- [ ] T4.2 "Edited elsewhere" conflict UI on text fields — see `src/screens/transactions/`, `src/components/ui/` — depends: T3.4
- [ ] T4.3 i18n strings for T4.1–T4.2 — see `src/i18n/` — depends: T4.1, T4.2

## Phase 5: Extension shell and data
Needs the phone's checkpoint (T3.3) to have anything to show.

- [ ] T5.1 Scaffold `extension/`: manifest v3, esbuild, tsc, vitest running `sync-core/vectors` — see `photos-vault/extension/` — depends: T1.6
- [ ] T5.2 Connection setup: paste/parse S3 config (reuse `parseS3ConfigText`), host permission, `chrome.storage.local` — see `extension/src/setup/` — depends: T5.1, T1.7
- [ ] T5.3 IndexedDB store: materialised rows by gid + outbox in one transaction; indexes per page query — see `extension/src/store/` — depends: T5.1
- [ ] T5.4 Sync loop: load checkpoint, pull, merge, push; on open/focus and after edits — see `extension/src/sync/` — depends: T5.2, T5.3, T3.3
- [ ] T5.5 Derived values port: balances, available, Ready to Assign (shared from `src/domain/` where pure, else moved to `sync-core/`) — see `src/domain/` — depends: T5.3

## Phase 6: Extension pages
Each page is disjoint, so these run in parallel once data and derived values exist.

- [ ] T6.1 Board switcher + sync status bar + conflicts — see `extension/src/ui/shell/` — depends: T5.4
- [ ] T6.2 Budget page (month grid, inline assign) — see `extension/src/ui/budget/` — depends: T5.4, T5.5
- [ ] T6.3 Transactions page (list, add/edit/delete, pickers, transfers as one atomic group) — see `extension/src/ui/transactions/` — depends: T5.4, T5.5
- [ ] T6.4 Accounts page (balances, open/closed) — see `extension/src/ui/accounts/` — depends: T5.4, T5.5

## Phase 7: End-to-end and release
- [ ] T7.1 Two-device test against a real bucket: phone + browser edits interleaved, airplane mode, killed app, reinstall — see `docs/design/browser-sync/` — depends: T4.3, T6.1–T6.4
- [ ] T7.2 Update docs: `docs/design/cloud-sync/DESIGN.md` non-goal, `docs/DESIGN.md` storage section, README — depends: T7.1
- [ ] T7.3 Chrome Web Store package + listing (`chrome-extension` skill) — see `extension/` — depends: T7.1
