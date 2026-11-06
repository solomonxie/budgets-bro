# Shell: sidebar, board menu, keys

Frame around every page after setup. Min width 960 px; below that the
sidebar collapses to icons.

```
╔══════════════════════════════════════════════════════════════════════════╗
║ Personal Budget ▾ │  September 2026                          ✓ Synced   ║ ← chip: sync.md
║───────────────────│──────────────────────────────────────────────────────║
║ ▸ Budget          │                                                      ║
║   Transactions    │                (page content)                        ║
║   Accounts        │                                                      ║
║                   │                                                      ║
║ ACCOUNTS          │                                                      ║
║ Checking  $1,000  │ ← click → Transactions filtered to it                ║
║ Wallet      $204  │                                                      ║
║ Visa       −$820  │ ← red when negative                                  ║
║                   │                                                      ║
║ ⚙ Connection      │                                                      ║
╚══════════════════════════════════════════════════════════════════════════╝
```
Sidebar account list: open on-budget accounts only, in the phone's sort
order. Tracking, loans, closed → Accounts page.

## Board menu
```
 Personal Budget ▾
 ┌──────────────────────────┐
 │ ✓ Personal Budget        │
 │   Rental property        │
 └──────────────────────────┘
```
Boards created or deleted on the phone only. One board → no ▾, plain title.
The open board is remembered per browser.

## Keyboard
| Key | Where | Does |
|---|---|---|
| `N` | anywhere | new transaction (Transactions, inline row; preset to the filtered account) |
| `/` | Transactions | focus search |
| `[` `]` | Budget | previous / next month |
| `Enter` / `Tab` / `Shift+Tab` | editing a cell | save · save + next · save + previous |
| `Esc` | editing | cancel, value restored |
| `⌫` | rows selected | delete (toast with Undo) |

## States
```
offline     chip "Offline"; everything editable, edits queue
read-only   chip "⚠ Sync stopped"; editors disabled with tooltip   ⌐ Sync stopped — see the status ¬
```

## Copy
| Key | String |
|---|---|
| `nav.budget` / `nav.transactions` / `nav.accounts` | Budget / Transactions / Accounts |
| `nav.accountsHeader` | Accounts |
| `nav.connection` | Connection |
| `readOnly.tooltip` | Sync stopped — see the status |
