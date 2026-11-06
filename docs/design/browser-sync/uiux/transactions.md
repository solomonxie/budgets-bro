# Transactions (extension)

All accounts by default; a sidebar account, an Activity cell or an
Accounts row arrives filtered. Most recent first; future-dated rows hidden,
as on the phone.

```
╔══════════════════════════════════════════════════════════════════════════╗
║ Personal Budget ▾ │ Transactions · All accounts               ↑ 2 waiting║
║───────────────────│──────────────────────────────────────────────────────║
║                   │ 🔍 Search payee or memo     Category ▾  Month ▾      ║
║                   │                                [ + Add transaction ] ║
║                   │ [ ] DATE    PAYEE         CATEGORY     MEMO     AMOUNT
║                   │ [ ] Sep 17  Whole Foods   🛒 Groceries weekly…  −$42.50
║                   │ [ ] Sep 16  Target        🏠 Househo…  3 items  −$86.20 ║ ← items: phone-only
║                   │ [ ] Sep 15  ⇄ Savings     —            move     −$500.00║ ← transfer
║                   │ [ ] Sep 14  Paycheck      Income       ⚠ Sept…+$3,200.00║ ← green; ⚠ = conflict
║                   │                                                      ║
║                   │ 124 transactions · −$1,904.20                        ║ ← footer: filtered count + sum
╚══════════════════════════════════════════════════════════════════════════╝
```
Filtered to one account: an ACCOUNT column drops, title becomes
`Transactions · Checking`, footer shows the account balance instead.

## Inline editor (new or click a row)
```
 [ ] ┌Sep 17 ┐┌Whole Fo▌      ┐┌🛒 Groceries ▾┐┌memo      ┐┌ −42.50 ┐
     └───────┘└──────────────┘└──────────────┘└──────────┘└────────┘
     ┌Checking ▾┐                                     ( Cancel ) [[ Save ]]
```
- New row opens at the top, date = today, account = filter or last used.
- Amount: `-42.50` or `42.50` outflow by default; `+` prefix = inflow.
- Enter saves and opens a fresh new row (batch entry); Esc cancels.
- Payee typed that matches nothing → created on save.

## Payee picker
```
 ┌──────────────────────────────┐
 │ Who▌                         │
 │ ＋ New payee "Who"           │ ← first when no exact match
 │ Whole Foods                  │
 │ ─ TRANSFERS ──────────────── │
 │ ⇄ Savings                    │ ← picking one makes it a transfer
 │ ⇄ Visa                       │
 └──────────────────────────────┘
```
Transfer between two budget accounts → category disabled (`—`); to a
tracking/loan account → category stays, as on the phone.

## Category picker
Typeahead over `Group › Category`, Income first. No create.

## Delete
```
select ↓  [x] Whole Foods   [x] Target
          [ Delete 2 ]!              ← appears above the table while selected
⇒ ⌐ 2 transactions deleted     ( Undo ) ¬     6 s
```
No confirm dialog: Undo replaces it (a delete is a synced op; Undo is a new
op restoring the row).

## States
```
empty board    No transactions yet.     [ + Add transaction ]
no match       No transactions match "costco".
offline        editable, chip "Offline"
read-only      editor disabled, "+ Add" hidden
```

## Copy
| Key | String |
|---|---|
| `tx.title.all` / `tx.title.account` | Transactions · All accounts / Transactions · {account} |
| `tx.add` | Add transaction |
| `tx.search` | Search payee or memo |
| `tx.items` | {count} items |
| `tx.newPayee` | New payee "{name}" |
| `tx.transfers` | Transfers |
| `tx.delete` | Delete {count} |
| `tx.deleted` | {count} transactions deleted |
| `tx.undo` | Undo |
| `tx.empty` | No transactions yet. |
| `tx.noMatch` | No transactions match "{query}". |
| `tx.footer` | {count} transactions · {sum} |
