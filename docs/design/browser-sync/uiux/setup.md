# Setup

First page on first run; later from ⚙ in the sidebar. Same fields and paste
rules as the phone's `S3ConfigModal` / `parseS3ConfigText` (shared parser
copied into the extension, same tests).

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║          Budgets Bro                                                     ║
║          Your budget, from your own bucket.                              ║
║                                                                          ║
║     S3 BUCKET                              ( Paste info to add )         ║ ← swaps fields for
║     ┌──────────────────────────────────────────────┐                     ║   a paste box in place
║     │ Bucket                                       │                     ║
║     └──────────────────────────────────────────────┘                     ║
║     ┌──────────────────────────────────────────────┐                     ║
║     │ Access Key ID                                │                     ║
║     └──────────────────────────────────────────────┘                     ║
║     ┌──────────────────────────────────────────────┐                     ║
║     │ ••••••••••••••••••••••••••••••••••••••   👁  │                     ║
║     └──────────────────────────────────────────────┘                     ║
║     18 characters — this key is usually 20.                              ║ ← same sanity hint
║     ┌──────────────────────────────────────────────┐                     ║
║     │ Folder (key prefix), e.g. byo-budget/        │                     ║ ← must match the
║     └──────────────────────────────────────────────┘                     ║   phone's sync bucket
║                                                                          ║
║     Stored only in this Chrome profile, never synced to your Google      ║
║     account. Use a key limited to this one bucket.                       ║
║                                                     [[ Connect ]]        ║
╚══════════════════════════════════════════════════════════════════════════╝
```

Reached from: toolbar icon with no connection · ⚙ → Connection.
Region auto-detected, never asked.

## Paste mode
```
║     S3 BUCKET                                    ( Back to fields )      ║
║     ┌──────────────────────────────────────────────┐                     ║
║     │ bucket: my-bucket                            │                     ║ ← parsed on every change;
║     │ prefix: byo-budget/                          │                     ║   a real paste snaps back
║     │ access_key_id: AKIA4…                        │                     ║   to filled fields
║     │ secret_access_key: wJal…                     │                     ║
║     └──────────────────────────────────────────────┘                     ║
║     Shown unmasked so a bad paste is visible.                            ║
```

## States
```
saving    ⟳ Asking Chrome for access to my-bucket…    ← Chrome's own host-permission prompt
          ⟳ Detecting region…
          ⟳ Checking bucket access…
fail      ⚠ AccessDenied: Access Denied                fields kept, Connect re-enabled
          This key can't list my-bucket/byo-budget/. Its policy needs s3:ListBucket.
no data   ⚠ No Budgets Bro data in my-bucket/byo-budget/
          Check the folder matches the bucket synced on your phone.  ( Use it anyway )
denied    ⚠ Chrome access to the bucket was declined.      [ Try again ]
draft     Recent attempts                                   ← keyed bucket+prefix+key id
          my-bucket/byo-budget/ · AKIA4…            Fill   ✕
```
`no data` = no `sync/` and no daily backup zips under the prefix. A prefix
with zips but no `sync/` goes straight to Waiting.

## Waiting for phone
```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║          ⟳                                                               ║
║          Waiting for your phone                                          ║
║          Open Budgets Bro on your iPhone, go to Settings › Backup        ║
║          and turn on Sync with browser under my-bucket. Your boards      ║
║          appear here as soon as the phone has published them.           ║
║                                                                          ║
║          Checking every 10 s.                  ( Change connection )     ║
╚══════════════════════════════════════════════════════════════════════════╝
```
Polls only while the tab is visible.

## First download
```
║          ⟳ Downloading your budget… 1.2 of 3.4 MB                        ║
║          [██████░░░░░░░░░░] 35%                                          ║
```
Once only; after that every open is from cache.

## Edit connection (⚙)
Same form, filled, secret masked. Extra row at the bottom:
```
║     ( Disconnect this browser )!                                         ║
║     ⇒ Disconnect?  Removes the key and the cached budget from this       ║
║       browser. 2 unsent changes will be lost.   ( Cancel ) [[ Disconnect ]]
```
The unsent-count clause only when > 0.

## Copy
| Key | String |
|---|---|
| `setup.title` | Budgets Bro |
| `setup.subtitle` | Your budget, from your own bucket. |
| `setup.paste` / `setup.backToFields` | Paste info to add / Back to fields |
| `setup.connect` | Connect |
| `setup.scopeHint` | Stored only in this Chrome profile, never synced to your Google account. Use a key limited to this one bucket. |
| `setup.noData` | No Budgets Bro data in {bucket}/{prefix} |
| `setup.noDataHint` | Check the folder matches the bucket synced on your phone. |
| `setup.denied` | Chrome access to the bucket was declined. |
| `waiting.title` | Waiting for your phone |
| `waiting.body` | Open Budgets Bro on your iPhone, go to Settings › Backup and turn on Sync with browser under {bucket}. Your boards appear here as soon as the phone has published them. |
| `download.progress` | Downloading your budget… {done} of {total} |
| `setup.disconnect` | Disconnect this browser |
| `setup.disconnectBody` | Removes the key and the cached budget from this browser. |
| `setup.disconnectUnsent` | {count} unsent changes will be lost. |
