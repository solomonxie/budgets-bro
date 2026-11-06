# Sync status: extension and phone

## Extension chip (top-right, every page)
```
✓ Synced            outbox empty, pulled < 1 min ago
⟳ Syncing…          pull or flush in flight > 500 ms (never for local saves)
↑ 3 waiting         ops sealed, not yet in the bucket
⚠ 1 edited twice    open conflict(s) → panel
⚠ Sync stopped      fatal: collision / newer protocol / clock rejected
Offline             navigator.onLine false or last request failed on network
```

## Sync panel (click the chip)
```
                     ┌─────────────────────────────────────────────┐
                     │ my-bucket/byo-budget/                       │
                     │ Last synced   just now                      │
                     │ This browser  Chrome on Mac · 0 waiting     │
                     ├─────────────────────────────────────────────┤
                     │ DEVICES                                     │
                     │ iPhone 13          last seen 2 min ago      │
                     ├─────────────────────────────────────────────┤
                     │ EDITED IN TWO PLACES (1)                    │
                     │ Paycheck · Sep 14 · memo                 ›  │ ← jumps to the row,
                     ├─────────────────────────────────────────────┤   card open
                     │ ( Sync now )                                │
                     └─────────────────────────────────────────────┘
```

## Fatal states (panel top, chip `⚠ Sync stopped`)
```
version   ⚠ This extension is older than your budget data (protocol 2).
          Update it to keep syncing. Viewing still works.
clock     ⚠ Your phone's changes are dated 3 days ahead of this computer.
          Check the date and time on both, then Sync now.
collision ⚠ Another browser is using this one's identity.
          Disconnect and connect again to give it a new one.   ( Disconnect )
auth      ⚠ AccessDenied: the bucket key stopped working.       ( Fix connection )
```
Edits made before the stop stay in the outbox and go up once fixed.
`version` and `collision` make the page read-only; `clock` and `auth` don't.

## Conflict card (under the field, both apps)
Text fields only: memo, payee/category/group/account names.
```
 Sep 14  Paycheck      Income       ⚠ Sept…   +$3,200.00
 ╭────────────────────────────────────────────────────────────╮
 │ ⚠ Memo edited in two places                                │
 │ This browser:           September salary                   │
 │ iPhone · 2 min ago:     Sept pay + bonus                   │
 │              ( Keep this )   ( Use iPhone's )              │
 ╰────────────────────────────────────────────────────────────╯
```
Either button = a new edit after both → clears on every device.
Amounts, dates, categories: last edit wins, no card (DESIGN.md).

---

## Phone: Settings › Backup, the S3 row
Width 60. Toggle sits under the bucket's own row, not a new section.
```
 BACKUP
 Each switch backs this board up automatically…
 iCloud Drive                                        ─●
 In Files → iCloud Drive → Budgets Bro · 2 h ago
 my-bucket                                           ─●
 s3://my-bucket/byo-budget/ · 2 h ago
    Sync with browser                                ─●   ← indented sub-row
    Synced just now                                       ← or "Publishing your boards…",
    Devices                                       (2) ›     "3 waiting", the error
    Edited in two places                          (1) ›   ← only when > 0
                  ( + Add S3 Backup )
```
- Off: only the `Sync with browser ○─` line, subtitle
  `Edit this budget from Chrome too`.
- Two buckets: one sync bucket. The other's toggle is disabled with
  `Browser sync uses my-bucket`.
- Turning it on the first time publishes all boards; subtitle counts up.
- Turning it off pauses network only; edits keep queuing.
- Backup switch off doesn't touch sync, and vice versa.

## Phone: Devices (half sheet)
```
 ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
 Devices                                      ( Done )
 This iPhone                         now
 Chrome on Mac                       2 min ago     ⋯ → Forget
 Chrome on Windows                   Oct 30        ⋯ → Forget
 Forgetting removes it from this list. To stop a
 computer syncing, change the bucket key.
```
Forget = delete `sync/devices/<id>.json`; its past edits stay.

## Phone: conflicts
```
 Edited in two places (sheet)           Transactions list          Add/Edit transaction
 Paycheck · Sep 14 · memo      ›        Paycheck      +$3,200.00    MEMO
 Groceries · name              ›        Income · Checking   ⚠       Sept pay + bonus
                                                                   ╭ ⚠ Memo edited in two places ╮
                                                                   │ This iPhone: Sept pay + bonus│
                                                                   │ Chrome · 2 min ago:          │
                                                                   │   September salary           │
                                                                   │ ( Keep this ) ( Use Chrome's )│
                                                                   ╰──────────────────────────────╯
```
Name conflicts open the rename prompt with the same card above the field.

## Phone states
```
syncing   subtitle only, no spinner anywhere
error     subtitle = provider error verbatim, red   e.g. "AccessDenied: Access Denied"
stopped   "Sync stopped: update the app to keep syncing"   (newer protocol)
demo      Sync with browser                    ·  ○─
          Not available on the demo board        ← no destination exists in demo mode
```

## Copy
| Key | String |
|---|---|
| `chip.synced` / `.syncing` / `.waiting` / `.conflicts` / `.stopped` / `.offline` | Synced / Syncing… / {count} waiting / {count} edited twice / Sync stopped / Offline |
| `panel.lastSynced` / `.thisBrowser` / `.devices` / `.conflicts` / `.syncNow` | Last synced / This browser / Devices / Edited in two places ({count}) / Sync now |
| `fatal.version` | This extension is older than your budget data (protocol {v}). Update it to keep syncing. Viewing still works. |
| `fatal.clock` | Your phone's changes are dated {ahead} ahead of this computer. Check the date and time on both, then Sync now. |
| `fatal.collision` | Another browser is using this one's identity. Disconnect and connect again to give it a new one. |
| `conflict.title` | {field} edited in two places |
| `conflict.keep` / `conflict.use` | Keep this / Use {device}'s |
| `browserSync.toggle` (phone) | Sync with browser |
| `browserSync.offHint` | Edit this budget from Chrome too |
| `browserSync.synced` | Synced {time} |
| `browserSync.publishing` | Publishing your boards… {count} |
| `browserSync.waiting` | {count} waiting |
| `browserSync.otherBucket` | Browser sync uses {bucket} |
| `browserSync.devices` | Devices |
| `browserSync.forget` | Forget |
| `browserSync.forgetHint` | Forgetting removes it from this list. To stop a computer syncing, change the bucket key. |
| `browserSync.conflicts` | Edited in two places |
| `browserSync.stopped` | Sync stopped: update the app to keep syncing |
| `browserSync.demo` | Not available on the demo board |
