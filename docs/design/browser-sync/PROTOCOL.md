# Sync protocol v1

What the phone (`src/sync/`) and the extension (`extension/src/sync/`) must
agree on exactly. Both import one implementation, `sync-core/`, and run the
fixtures in `sync-core/vectors/`. A change here bumps `v` and adds vectors.
Derived from Photos Vault's v1 (`photos-vault/docs/design/cloud-sync/PROTOCOL.md`);
differences are marked **BB**.

## Bucket layout (home S3 config, under its prefix)

```text
sync/
├── devices/<device>.json                 {device, name, kind: phone|browser, created, lastSeen}
├── log/<device>/<seq:012d>.ndjson.gz     immutable segment, seq from 1, no gaps
└── checkpoints/<device>/<hlc>.ndjson.gz  full merge state + version vector
```

- `<device>`: UUID v4, lowercase. One per install / browser profile.
- **Write-once**: every segment and checkpoint PUT carries `If-None-Match: *`.
  - 412/409 → GET it, compare SHA-256 (segments ≤ 256 KB). Equal: an earlier try landed (done).
    Different: collision → fatal, the device stops writing.
  - A segment's bytes are sealed locally before the first PUT, never rebuilt.
- Before its first write a device lists `sync/log/<device>/` and must find it
  empty.

## Clock and stamps

```text
hlc    = "<wall:013d>-<counter:04d>"     fixed width, sorts as a string
stamp  = "<hlc>@<device>"                total order = string order
wall   = local ms + offset to the bucket's `Date` response header (refreshed each pull)
tick:     wall' = max(now, last.wall); counter = wall'==last.wall ? last.counter+1 : 0
          counter past 9999 → wall' += 1, counter = 0 (bootstrap can stamp >10k ops in 1 ms)
receive:  last = max(last, op.hlc) before the next tick
bound:    op wall > its segment's LastModified + 1h → ignored by every reader
local:    a pulled op > 24h ahead of the receiver's wall → shown as a sync error
```

**BB — one tick per group.** All ops of one local transaction (a group) share
one hlc. Within a group `(e, id, f)` is unique (later writes to the same field
collapse into one op). So every pair of groups compares the same way on every
field they share: a transfer's two legs, or a cascade, never end up half from
one device and half from another.

## Op (one JSON line; `d` and `seq` come from the segment)

```json
{"h":"1793414025123-0003","e":"transactions","id":"5b1e…","o":"set","f":"memo","x":"Groceries"}
```

| `o` | Meaning | Fields |
|---|---|---|
| `add` | the entity exists; each field in `x` is set as if by `set` with this stamp | `x`: full field map, incl. `deleted: null` |
| `set` | LWW one field | `f`, `x` (JSON scalar or null) |

`madd`/`mrem` (OR-sets) are reserved, unused in v1: no synced column is a set.

Values: money and counts as JSON integers, booleans as `0`/`1`, dates and
months as the stored strings (`YYYY-MM-DD`, `YYYY-MM`), FK fields as the
target's gid (string) or null.

**BB — delete is a field.** `deleted` = ms of the delete, or null.
- Local `DELETE` → `set deleted <ms>`. No erase op.
- Undo (History) re-inserts the row with its old gid → `add` with
  `deleted: null`; re-add merges per field.
- Entity listed = an `add` for it has been applied.

## Mapping local writes to ops (phone)

Source: `change_log` rows past the outbox cursor, minus seq ranges the applier
wrote. One `change_log` transaction = one group.

| `change_log.op` | op |
|---|---|
| insert | `add`, every synced field |
| update | one `set` per synced field whose value changed |
| delete | `set deleted <now ms>` |

Local ids → gids for `id` and every FK field. Fields not listed below never
leave the device.

## Entities (v1)

`e` = table name. `id` = the row's `gid`. Every entity also has `deleted`.
Never synced on any table: `id`, `gid`, `updated_at`.

| `e` | FK fields → target `e` | text fields (conflict-tracked) | LWW fields |
|---|---|---|---|
| `boards` | — | `name` | `created_at` |
| `accounts` | `board_id`→boards, `loan_payment_category_id`→categories | `name`, `note` | `type`, `on_budget`, `currency`, `opening_balance_cents`, `archived_at`, `created_at`, `interest_rate_bps`, `term_months`, `original_principal_cents`, `origination_date`, `original_house_price_cents`, `tracking_kind`, `sort_order` |
| `category_groups` | `board_id`→boards | `name` | `sort_order`, `archived_at` |
| `categories` | `board_id`→boards, `group_id`→category_groups, `linked_account_id`→accounts | `name` | `icon`, `sort_order`, `archived_at` |
| `budget_entries` | `board_id`→boards, `category_id`→categories | — | `month`, `assigned_cents` |
| `payees` | `board_id`→boards, `linked_account_id`→accounts | `name`, `review_note` | `review_on`, `review_mode` |
| `transactions` | `board_id`→boards, `account_id`→accounts, `category_id`→categories, `payee_id`→payees, `transfer_account_id`→accounts | `memo` | `amount_cents`, `date`, `import_id`, `purchase_items`, `created_at` |
| `scheduled_transactions` | `board_id`→boards, `account_id`→accounts, `category_id`→categories, `payee_id`→payees | `memo`, `review_note` | `amount_cents`, `frequency`, `interval_n`, `next_date`, `end_date`, `days_of_week_mask`, `review_on`, `review_ignored`, `created_at` |
| `custom_goals` | `board_id`→boards, `linked_account_id`→accounts | `name` | `target_cents`, `manual_progress_cents`, `sort_order`, `created_at` |
| `payment_decisions` | `board_id`→boards, `scheduled_transaction_id`→scheduled_transactions, `payee_id`→payees | `name`, `note` | `cadence`, `amount_cents`, `decision`, `decided_on`, `due_on`, `done_on` |
| `account_value_history` | `account_id`→accounts | `note` | `value_cents`, `effective_date`, `kind`, `created_at` |
| `account_rate_history` | `account_id`→accounts | `note` | `rate_bps`, `effective_date`, `created_at` |
| `houses` | `board_id`→boards | `name`, `notes`, `pros`, `cons`, `issues`, `renovations` | every other column (address … `grocery_distance_m`, `checklist`, `created_at`) |
| `community_prices` | `board_id`→boards | `note` | `city`, `community`, `property_type`, `as_of_month`, `benchmark_price_cents`, `created_at` |
| `house_prices` | `house_id`→houses | — | `date`, `price_cents` |

- `purchase_items`, `checklist`: one TEXT each, whole-field LWW.
- Amounts, dates, categories: LWW, no conflict card (decided in `DESIGN.md`).
- A column added later joins its entity in a new protocol version; an older
  reader ignores unknown fields in `add` and unknown `f` in `set`.

## Identity

- gid: UUID v4, lowercase, assigned on insert (any device).
- **BB — derived gid for `budget_entries`**:
  `"be:" + lowercase hex(SHA-256(utf8("<category gid>|<month>")))[0:32]`,
  month `YYYY-MM`. Two devices assigning the same cell write the same entity;
  LWW decides `assigned_cents`.

## Natural keys (BB)

Keys: `payees (board_id, name)`, `transactions (board_id, import_id)` where
`import_id` is not null. Exact byte comparison, as SQLite's UNIQUE.

- **Derived at merge, never sent.** A key group = live (`deleted` null)
  entities with equal key values in the merged state. Canonical = smallest gid
  (string order). The others are aliases of it.
- Why derived: it is a pure function of the merged state, which is already
  order-independent; an alias op would need its own merge rules.
- Materialisation: only the canonical row exists locally. FK fields pointing
  at an alias resolve to the canonical's local id.
- Ops keep their original gids. If a rename or delete dissolves the key
  group, the alias becomes a row again and its referrers point back at it.
- An edit made through the merged row targets the canonical gid.
- Edits to an alias still merge into its own state; they show only if the
  group dissolves.
- Membership uses only `exists` and `deleted` null, never parked/hidden. A
  parked canonical keeps the aliases' referrers parked too.

## Dangling and dead references (BB)

Merge state is complete regardless; these rules govern only what gets
materialised (into SQLite / IndexedDB rows):

```text
FK target not listed yet          → referrer parked (not materialised) until it is
FK target deleted, column nullable → materialise with that FK = null
FK target deleted, NOT NULL column → referrer hidden while the target is deleted
target restored / arrives          → referrer materialised again, from merge state
```

Resolution order: alias → canonical first, then status. A parked target
parks its referrer; a hidden target counts as deleted. Reference cycles get
the same status whichever row is checked first.

NOT NULL FKs: `categories.group_id`, `budget_entries.category_id`,
`transactions.account_id`, `scheduled_transactions.account_id`,
`account_*_history.account_id`, `house_prices.house_id`, every `board_id`.

## Merge (order-independent, unchanged from PV)

**Seen.** Op `a` has seen op `b` when:
- `a.d == b.d` and `a.stamp > b.stamp`, or
- `a.vv[b.d] >= b.seq` (`vv` = `a`'s segment's version vector). Transitive.

```text
field value  = x of the op with the greatest stamp among (e, id, f)   (`add` counts per field)
text heads   = ops on (e, id, f) not seen by any other op on it
conflicts    = text heads − winner        (both values kept)
op before its add → kept, applied as it arrives; same result in any order
```

Incremental heads, for an arriving op `n`: if some head saw `n`, drop `n`;
else remove the heads `n` saw, then add `n`. Winner = max of the heads.
Resolving a conflict = a new `set` after seeing every head.

## Segments

```text
line 1: {"v":1,"d":"<device>","seq":42,"vv":{"<device>":<seq>,…},"n":<ops>}
then n op lines. gzip. ≤ 200 ops or 256 KB of uncompressed UTF-8 op lines (cut point known before gzip, same on every device).
```

- `vv` = highest contiguous seq applied per other device.
- **Seal the outbox before applying any pulled segment.** An unsealed local
  op merges locally as `seq = next seq`, `vv = current vv`.
- **BB — groups never split.** A segment is cut only between groups. A group
  bigger than the cap goes alone in one segment, uncapped.
- Flush: 2 s of quiet, 200 ops, or app backgrounded / page hidden.

## Checkpoint

```text
line 1: {"v":1,"d":"<device>","h":"<hlc>","vv":{…all devices incl. own…}}
then one line per entity:
  {"e","id","exists":bool,
   "f":{field:{"x":…,"s":"<stamp>"}},
   "heads":{textField:[{"x","s","seq","vv"}…]}}
```

- Load = newest checkpoint by `h` across devices, then per device the
  segments with `seq > vv[device]`. Loading + applying the rest = applying
  everything.
- Written at most daily, by the device with the most ops since the last one.

**Bootstrap.** The phone's first sync queues every row of every board (demo
board never) as `add` through the ordinary log, then publishes a checkpoint.
- Bootstrap ops need no grouping: each row may be its own group.
- A phone joining an existing log adopts the newest checkpoint, keeps cloud
  values for every shared gid, and adds only what the cloud lacks.
- A device with no state loaded never edits. The browser waits for the first
  checkpoint.

## Pull

```text
per device prefix under sync/log/: ListObjectsV2 start-after=<last applied key>
apply in seq order; a gap → stop for that device, retry next pull
apply in one local transaction, then advance vv; a crash mid-apply → reapply (idempotent)
phone: record the change_log seq range the apply wrote, so the outbox skips it
header v > supported → stop writing, keep pulling read-only
```

## Fixtures: `sync-core/vectors/*.json`

```json
{"name":"…","now":"<hlc>",
 "segments":[{"d":"a","seq":1,"vv":{},"lastModified":1793414025000,"ops":[…]}],
 "expect":{"entities":{"transactions/<gid>":{"fields":{…}}},
           "conflicts":[{"e":"transactions","id":"<gid>","f":"memo","x":"…","d":"b"}],
           "aliases":{"payees/<loser gid>":"payees/<canonical gid>"},
           "hidden":["transactions/<gid>"]}}
```

- Runners apply segments in **every permutation** that keeps each device's
  seq order, each segment also repeated. Every run must equal `expect`.
- `fields` lists every field with an op, nulls included.
- `conflicts` sorted by `(e, id, f, stamp)`.
- `aliases`: every non-canonical member of a key group. `hidden`: parked or
  dead-referenced entities, sorted. Both omitted when empty.
