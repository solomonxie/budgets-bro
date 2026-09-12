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
│ OpenAI key section              │──→ inline; TextField from
│                                  │    ../../components/ui/TextField.tsx
├───────────────────────────────┤
│ S3 backup section               │──→ inline; S3ConfigModal from
│  (config rows, + Add S3 Backup) │    ../../components/ui/S3ConfigModal.tsx
├───────────────────────────────┤
│ Local backup toggle             │──→ inline (Switch)
│ Cloud sync toggle + actions     │──→ inline (Switch, Sync Now, Restore)
├───────────────────────────────┤
│ Data section                    │──→ inline (Import YNAB, Import/Export
│  (import/export buttons +        │    app backup, result rows)
│   result summaries)              │
├───────────────────────────────┤
│ About section (version row)     │──→ inline
├───────────────────────────────┤
│ PromptModal (new/rename)        │──→ ../../components/ui/PromptModal.tsx
└───────────────────────────────┘
```
