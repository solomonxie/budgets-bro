# Accounts (extension)

Read-only list, phone's grouping and order. Rename only.

```
╔══════════════════════════════════════════════════════════════════════════╗
║ Personal Budget ▾ │ Accounts                                  ✓ Synced   ║
║───────────────────│──────────────────────────────────────────────────────║
║                   │ NET WORTH                                            ║
║                   │ $184,210.55     Assets $312,400.00  Debts $128,189.45║
║                   │                                                      ║
║                   │ Cash                                       $1,204.10 ║
║                   │   Wallet                                     $204.10 ║ ← click → Transactions
║                   │   Checking                                 $1,000.00 ║
║                   │ Credit                                      −$820.45 ║ ← red
║                   │   Visa                                      −$820.45 ║
║                   │ Loan                                    −$127,369.00 ║
║                   │   Mortgage                              −$127,369.00 ║ ← principal-derived, as phone
║                   │ Tracking                                   $2,196.00 ║
║                   │   401(k)                                   $2,196.00 ║
║                   │ › Closed (2)                                         ║ ← collapsed by default
╚══════════════════════════════════════════════════════════════════════════╝
```
Balances computed from rows already in IndexedDB, memoized per board.
Value history, rate history, loan details: phone only.

## States
```
empty     No accounts yet. Add them on your phone.
closed    › Closed (2) expands to the same rows, greyed
```

## Copy
| Key | String |
|---|---|
| `accounts.netWorth` | Net worth |
| `accounts.assets` / `accounts.debts` | Assets {amount} / Debts {amount} |
| `accounts.closed` | Closed ({count}) |
| `accounts.empty` | No accounts yet. Add them on your phone. |
