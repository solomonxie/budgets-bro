# Settings

`SettingsModal` is the routed entry point (opened from a corner button, not a tab) — it just wraps `SettingsScreen` in a full-screen `Modal`.

```
SettingsModal.tsx
┌───────────────────────────────┐
│ Header (title, Done)           │──→ inline (same file)
├───────────────────────────────┤
│ SettingsScreen                 │──→ ./SettingsScreen.tsx (below)
└───────────────────────────────┘

SettingsScreen.tsx
┌───────────────────────────────┐
│ PRIVACY BY DESIGN (static card) │──→ inline; offline-first, no publisher
│                                  │    server, data only to storage/AI the
│                                  │    user owns. First thing on the page —
│                                  │    BACKUP's ⓘ and BANK SYNC restate it
│                                  │    in detail where it's acted on.
├───────────────────────────────┤
│ Boards section                 │──→ inline; RowMenuButton from
│  (board rows, + New Board)      │    ../../components/ui/RowMenuButton.tsx
├───────────────────────────────┤
│ Appearance section (segmented)  │──→ inline
│ Language section (segmented)    │──→ inline
│ APP LOCK (segmented)            │──→ inline; Off · Passcode · Face ID.
│                                  │    Setting a passcode runs
│                                  │    ../../components/ui/PasscodeEntry.tsx
│                                  │    twice inside a CardModal; the gate
│                                  │    itself is ../lock/LockScreen.tsx
├───────────────────────────────┤
│ AI CONNECTIONS  ⓘ               │──→ inline; rows reorder, ⓘ explains
│  (rows, + Connect an AI)        │    bring-your-own-account and where to
│                                  │    register. The add form unfolds in
│                                  │    place: ../../components/ui/AiKeyForm.tsx
│                                  │    (was AiKeyModal, a bottom sheet that
│                                  │    covered the list it added to)
├───────────────────────────────┤
│ BACKUP                          │──→ ./BackupSection.tsx
├───────────────────────────────┤
│ DATA                            │──→ ./DataSection.tsx
├───────────────────────────────┤
│ Restored summary (after either) │──→ inline; both sections report through
│                                  │    one `onRestored`
├───────────────────────────────┤
│ BANK SYNC (static card)         │──→ inline; why there is no bank
│                                  │    automation — see
│                                  │    docs/DESIGN.md#no-bank-automation
├───────────────────────────────┤
│ About section (version row)     │──→ inline
├───────────────────────────────┤
│ PromptModal (new/rename)        │──→ ../../components/ui/PromptModal.tsx
└───────────────────────────────┘
```

## BackupSection

One list of destinations, each a bare switch: on means every change is backed
up there. Replaced three sections (AWS S3 · Local Backup · Cloud Sync) whose
global auto-sync switch and two full-width buttons sat a screen away from the
connections they acted on. The on-device destination is gone — same sandbox as
the database, so deleting the app took both.

```
BACKUP  ⓘ                                   → InfoButton: how a backup stays
Every sync writes a full copy of this board…  yours (no server, your storage,
                                              secrets excluded, full copies,
                                              restore is additive)

┌────────────────────────────────────────┐
│ iCloud Drive                      [on] │  tap → ICloudBrowserModal
│ In Files → iCloud Drive → Budgets Bro   │
├────────────────────────────────────────┤
│ my-bucket                         [on] │  tap → S3BrowserModal
│ s3://my-bucket/budget · 2 h ago         │
└────────────────────────────────────────┘
             + Add S3 Backup                 → S3ConfigModal
```

Both browsers are the same page over different storage (shared row list:
`../../components/ui/BackupFileList.tsx`):

```
┌── file listing ────────────────────────┐
│ 20260919-main.zip          Restore     │  → new board, switched to
│ before-ynab.zip            Restore     │
└────────────────────────────────────────┘
      + Back Up This Board Here             → PromptModal for the name
                                              (../../components/ui/BackupSaveLink.tsx)
```

- Restore never overwrites: the zip becomes a board of its own (`importAppExport`) and the app switches to it, via `onRestored(boardId)` → `useBoards().switchBoard`.
- "Back up here" is the manual counterpart to the dated automatic backup — a name you'll recognise later ("before the YNAB import"), landing in the S3 folder being browsed / the iCloud folder. Typed names are never pruned; pruning only matches the automatic shape (`sync/backupPath.ts`).
- Last synced rides the row's subtitle, so it's readable without opening anything.
- Adding a bucket kicks off its first sync immediately — otherwise it stays empty until the next change, which could be days.
- "Delete Connection" lives in the S3 browser's `⋯`, one level down from the switch: rare and destructive.

## DataSection

Three chevron rows in one group (export · import a backup · import from YNAB).
They're peers; as full-width buttons they read as three competing calls to
action in what is really just a list. YNAB's result table renders under the
group; a restore's summary goes up to `SettingsScreen` instead, since a restore
can also start from BackupSection.

## Payee management (removed)

Was a section here: search a payee, rename it, delete it. Renaming now lives
on the payee row of the transaction form's picker (its ✎), where you are
already looking at the name that's wrong — and renaming onto an existing name
merges the two (`payeesRepo.renameOrMergePayee`). Deleting was never a real
operation: a payee names money that did move, so there is nowhere for those
transactions to go except another payee, which is a rename. Payees nothing
points at are pruned automatically (`payeesRepo.pruneUnusedPayees`).
