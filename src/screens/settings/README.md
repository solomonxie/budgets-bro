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
│ Boards section                 │──→ inline; RowMenuButton from
│  (board rows, + New Board)      │    ../../components/ui/RowMenuButton.tsx
├───────────────────────────────┤
│ Payees section                 │──→ inline; SearchableDropdownField from
│  (search/select, rename/delete) │    ../../components/ui/SearchableDropdownField.tsx
├───────────────────────────────┤
│ Appearance section (segmented)  │──→ inline
│ Language section (segmented)    │──→ inline
├───────────────────────────────┤
│ AI keys section                 │──→ inline; AiKeyModal from
│  (reorderable rows, + Add Key)  │    ../../components/ui/AiKeyModal.tsx
├───────────────────────────────┤
│ BACKUP                          │──→ ./BackupSection.tsx
├───────────────────────────────┤
│ DATA                            │──→ ./DataSection.tsx
├───────────────────────────────┤
│ Restored summary (after either) │──→ inline; both sections report through
│                                  │    one `onRestored`
├───────────────────────────────┤
│ About section (version row)     │──→ inline
├───────────────────────────────┤
│ PromptModal (new/rename)        │──→ ../../components/ui/PromptModal.tsx
└───────────────────────────────┘
```

## BackupSection

One list of destinations, each with its own `⋯`. Replaced three separate
sections (AWS S3 · Local Backup · Cloud Sync) whose global auto-sync switch and
two full-width buttons sat a screen away from the connections they acted on.

```
BACKUP
Every sync writes a full copy of this board…

┌────────────────────────────────────────┐
│ my-bucket                           ⋯  │  tap → S3BrowserModal
│ s3://my-bucket/budget · 2 h ago         │
├────────────────────────────────────────┤
│ This device                         ⋯  │
│ In the app's own files · Off            │
└────────────────────────────────────────┘
             + Add S3 Backup                 → S3ConfigModal

  ⋯  ✓ Auto-sync          per destination, not one global switch
     Sync Now             this destination only; ignores Auto-sync
     Restore Latest       confirms, then a NEW board
     ─────────────
     Delete Connection    S3 only, red, last
```

- Last synced rides the row's subtitle, so it's readable without opening the menu.
- Adding a bucket kicks off its first sync immediately — otherwise it stays empty until the next change, which could be days.
- Row-level spinner and inline error; a manual sync never fails silently.
- The local row's own menu carries "Keep a copy here" — being off is a state of that destination, not a separate section.

## DataSection

Three chevron rows in one group (export · import a backup · import from YNAB).
They're peers; as full-width buttons they read as three competing calls to
action in what is really just a list. YNAB's result table renders under the
group; a restore's summary goes up to `SettingsScreen` instead, since a restore
can also start from BackupSection.
