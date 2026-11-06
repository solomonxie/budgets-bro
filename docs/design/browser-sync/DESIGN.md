# Browser sync + Chrome extension

Interface: `UIUX_DESIGN.md` · Build: `IMPLEMENT_PLAN.md` · Wire format: `PROTOCOL.md` (T1.1)
Pattern source: `photos-vault/docs/design/cloud-sync/` (same op log, adapted).

## Problem
The ledger lives only in the phone's SQLite. The bucket gets a daily per-board
zip: good for restore, useless for a second device. Entering a month of
transactions or reworking a budget on a phone keyboard is slow, and there is
no way to do it from a computer.

## Goals
- **The bucket is the source of truth** for the ledger. Phone and browser are
  both caches of it.
- Chrome extension (`extension/`): a full page over the bucket. Only setup is
  one S3 connection.
- From the browser: switch boards, budget a month, browse/add/edit/delete
  transactions (incl. transfers), see accounts and balances.
- Phone picks up browser edits with no action: on foreground and after its
  own writes.
- **No lost data under any interleaving**: concurrent edits, two tabs, killed
  app, half-sent segment, clock skew, reinstall.
- Phone stays as fast as today. Zero new native dependencies; JS growth
  measured against the 4 MB bytecode budget.

## Non-goals (v1)
- Settings, credentials, app lock, AI history, `income_detail_history`,
  `change_log` itself: never leave the phone.
- In the extension: Insights, finance tools, Homes, YNAB import, receipt
  scan, scheduled transactions, purchase items, creating/deleting boards,
  accounts and categories. Their tables still sync, so v2 is UI only.
- iCloud as sync home: Chrome can't read it. S3 only; iCloud keeps getting
  the daily zip.
- Background sync while the app is closed, or polling while open (AGENTS.md:
  no timers).
- Multiple users / sharing a board. One owner, a few devices.
- Firefox/Safari.

## Options considered
- **Shared snapshot + compare-and-swap**: rewrites the whole board per edit;
  conditional writes differ across S3-compatibles. → rejected.
- **Server in the middle** (Lambda, Supabase): no backend exists, the user's
  bucket is the product. → rejected.
- **Per-device append-only op log** (Photos Vault protocol) → **chosen**.
  Proven in the sibling app, no coordinator, write-once objects.
- Identity: rewrite every INTEGER PK to UUID (every repo, FK, screen, backup,
  restore) vs **add a `gid` column, keep local ids** → **gid**. Local code and
  queries stay untouched; ids are translated only at the sync boundary.
- Outbox source: hook every repo write vs **derive from `change_log`
  triggers** → **triggers**. They already capture every write, migrations and
  repairs included, with before/after JSON.
- Extension stack: RN-web/React (hundreds of KB) vs **plain TS + esbuild**.
- Protocol code: port twice (as PV did, Dart + TS) vs **one shared TS core**
  (`sync-core/`) imported by app and extension. Both sides are TypeScript, so
  one implementation, one set of vectors.

## Decision
Photos Vault's protocol v1, specialised for a relational ledger:

- **Bucket**: `sync/devices/`, `sync/log/<device>/<seq>.ndjson.gz`,
  `sync/checkpoints/<device>/<hlc>.ndjson.gz` under the home S3 config's
  prefix. Write-once segments, HLC stamps, version vectors, seal-before-apply,
  checkpoints: unchanged from PV.
- **Identity**: every synced table gets `gid TEXT NOT NULL UNIQUE` (UUID v4,
  backfilled by migration). Ops carry gids; FK fields (`account_id`,
  `category_id`, `payee_id`, `transfer_account_id`, `board_id`, …) are sent as
  the referenced row's gid and mapped back to local ids on apply.
- **Natural keys** (`budget_entries(category_id, month)`, `payees(board_id,
  name)`, `transactions(board_id, import_id)`):
  - `budget_entries.gid` is derived (`hash(category gid + month)`), so two
    devices assigning the same cell write the same entity and LWW decides.
  - Payee/import collisions on apply: the row with the smaller gid wins on
    every device; the other gid becomes an alias of it. Deterministic, so
    phone and browser converge.
- **Ops**: insert → `add` (all fields), update → one `set` per changed field,
  delete → `set deleted <ms>`. Undo from History → `set deleted null`, same
  gid. Delete is an LWW field like any other, never an erase.
- **Merge**: per-field LWW. Free-text fields (`memo`, names, `notes`) are
  conflict-tracked: the loser is kept and shown as "Edited elsewhere".
  Multi-value columns stored as one TEXT (`purchase_items`, `checklist`) are
  whole-field LWW, as the app already treats them.
- **Atomic groups**: a transfer pair, or a delete that cascades, is written by
  one local transaction and must land in one segment, so no device ever sees
  half a transfer.
- **Dangling refs**: an op whose referenced gid hasn't arrived is parked and
  applied when it does; order-independent per PV.
- **Echo**: ops the applier writes also fire the triggers. The applier records
  the `change_log` seq range it produced; the outbox skips it.
- **Derived values** (balances, available, Ready to Assign, loan principal)
  are never synced. Each side recomputes from rows.
- **Bootstrap**: the phone queues every row of every board as `add`, then
  publishes a checkpoint. The extension waits for it.
- **Demo mode**: no sync at all, as with backups today.
- **Device id**: UUID per install / browser profile, stored in the DB (not
  keychain). A restored backup takes a fresh id.

## Data & integrations
- **Phone DB**: migration adds `gid` + unique index to synced tables, and
  `sync_*` tables (outbox cursor, vv, HLC, device id, parked ops, conflicts,
  gid aliases). Backup zip carries gids so a restore keeps identity.
- **Synced tables**: `boards`, `accounts`, `category_groups`, `categories`,
  `budget_entries`, `payees`, `transactions`, `scheduled_transactions`,
  `custom_goals`, `payment_decisions`, `account_value_history`,
  `account_rate_history`, `houses`, `community_prices`, `house_prices`.
  `boards`, `houses`, `community_prices`, `house_prices` have no change-log
  triggers today; they get them.
- **Extension**: connection in `chrome.storage.local` (never `.sync`);
  ledger state + outbox in IndexedDB; host permission for the bucket endpoint
  requested at setup (extension pages skip CORS).
- **gzip**: reuse pako already inside JSZip on the phone; `CompressionStream`
  in Chrome. No new dependency unless measured cheaper.
- **Cost**: one `ListObjectsV2` per device prefix per pull; one PUT per
  segment (2 s quiet or 200 ops); checkpoint at most daily. Cents a month.

## Risks / open questions
- **Ledger readable on the computer**: IndexedDB is unencrypted, no lock in
  the extension. v1 relies on the computer's login; a passcode can come later.
- **Concurrent edits to amounts/dates/categories**: last edit wins, no
  conflict card (decided). History on the phone can still undo it.
- **Natural-key alias** after both devices already attached transactions to
  the losing payee: those FKs are remapped on apply. Needs vectors.
- **Old phone build meets newer op version**: stops writing, pulls read-only.
- **Far-future wall clock**: ops > 24 h ahead rejected and shown as an error.
- **Log growth**: never trimmed in v1 (~100 B per op).
- Supersedes the "not bidirectional multi-device sync" non-goal in
  `docs/design/cloud-sync/DESIGN.md` for S3; that doc keeps describing the
  daily zip, which stays.
