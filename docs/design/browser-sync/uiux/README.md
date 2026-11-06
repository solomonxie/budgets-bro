# Extension + phone: screen map

Extension width 78 cols, phone 60. Glyphs: `uiux` skill `notation.md`.

```text
   toolbar icon
        │
        ▼
   ┌ Setup ┐──connect ok──▶ Waiting-for-phone ──checkpoint appears──┐
   └───────┘                                                        ▼
            ┌──────────────── sidebar (always) ─────────────────────────┐
            │ Board ▾   Budget   Transactions   Accounts   ⚙   chip     │
            └───┬─────────┬──────────┬─────────────┬─────────┬────┬─────┘
                ▼         ▼          ▼             ▼         ▼    ▼
         Board menu    Budget   Transactions   Accounts   Setup  Sync panel
                          │          ▲  ▲          │      (edit)    │
                          │          │  └─account──┘                │
                          └─Activity─┘                 conflict ────┘─▶ owning field

   PHONE  Settings › BACKUP › S3 row ─▶ Sync with browser ─●
                                     ├─▶ Devices (2) ›         half sheet
                                     └─▶ Edited in two places (1) ›  ─▶ editor + card
```

| File | Covers |
|---|---|
| `setup.md` | Setup, paste mode, Waiting-for-phone, edit connection |
| `shell.md` | Sidebar, board menu, keyboard map |
| `budget.md` | Budget month grid, inline assign, rename |
| `transactions.md` | Transaction table, inline editor, pickers, transfers, delete |
| `accounts.md` | Accounts list |
| `sync.md` | Chip, Sync panel, conflict card, fatal states; phone S3 row, Devices, conflicts, demo |
| `components.md` | Reusable parts |
