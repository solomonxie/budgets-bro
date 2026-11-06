# Browser sync + Chrome extension: UI/UX

Why and scope: `DESIGN.md`. Drawings: `uiux/` (map in `uiux/README.md`).
House rules: `docs/UIUX-DESIGN.md` (dark, one accent, "Unassigned" not
YNAB terms, money colours, errors inline). Patterns from the `uiux` skill:
`cloud-bucket-sync.md` (form, save proves access), `paste-to-fill.md`,
`credentials.md` (local-only secret, scoped key). Mirrors Photos Vault's
`docs/design/cloud-sync/uiux/`.

## Stories → scenarios

| # | Story | Trigger → result | Edge / failure |
|---|---|---|---|
| S1 | As the owner, I want my budget on my computer, so I can do the monthly review on a big screen | toolbar icon → tab opens on Budget from cache < 300 ms, quiet refresh | no connection → Setup · no checkpoint → Waiting-for-phone · offline → cache + `Offline` chip |
| S2 | I want to connect by pasting my bucket note | Setup → paste → Connect → access proved → first download | bad key → provider error verbatim, fields kept · wrong prefix → "No Budgets Bro data here" · Chrome permission declined |
| S3 | I want to assign money to categories with the keyboard | click Assigned → type → Enter / Tab | over Unassigned → inline red hint, still saves (same as phone) |
| S4 | I want to enter and fix transactions from receipts on my desk | `N` or `+ Add transaction` → inline row → Enter | transfer → payee picker's TRANSFERS group · deleted by mistake → Undo toast |
| S5 | I want my phone to show browser edits with no action | phone foregrounds → pulls → screens patch | many ops → applied in one transaction, no spinner |
| S6 | I want to know sync is healthy | chip in the extension, subtitle on the phone's S3 row | error names cause + fix · newer protocol → read-only, edits kept |
| S7 | I don't want a concurrent edit silently lost | both edited a memo/name → "Edited in two places" card, pick one | resolved on one side clears on both |
| S8 | I want to see and forget old computers | phone S3 row → Devices sheet | forgetting doesn't revoke the key — sheet says so |

## Screens & surfaces

```text
EXTENSION (one tab, sidebar layout)               PHONE (existing app)
Setup ............. page      S2                  S3 row › Sync with browser ── row toggle  S6
Waiting-for-phone . page      S1                  Devices ................. half sheet     S8
Budget ............ page      S1 S3               Edited in two places .... half sheet     S7
Transactions ...... page      S4                  Conflict card ........... in the editor  S7
Accounts .......... page      S1                  Conflict ⚠ on rows ...... Transactions   S7
Board switcher .... menu from sidebar header
Sync panel ........ popover from chip   S6 S7
Conflict card ..... inline under the field  S7
Undo toast ........ bottom-center       S4
```

Not in extension v1 (data still syncs, phone-only to view/edit): Insights,
finance tools, Homes, scheduled transactions, purchase items, account
setup/creation, category/account add/delete, import/export, board
create/delete. Transactions show `3 items` read-only.

## Flows

```text
toolbar icon ─▶ connection? ─no─▶ Setup ─ok─▶ checkpoint? ─no─▶ Waiting (polls 10 s)
                   │yes                          │yes
                   ▼                             ▼
           Budget (cache) ◀──────────── first download ⟳ (MB progress)
                   │ pull: tab visible + every 30 s while visible
                   ▼
 edit ─▶ IndexedDB + outbox (one tx) ─2 s quiet─▶ segment PUT ─▶ chip ✓
                                 └─ offline ─▶ "↑ 3 waiting" ─online─▶ PUT

PHONE  foreground ─▶ pull ─▶ apply (one SQLite tx) ─▶ screens refresh
       local write ─▶ outbox ─2 s quiet─▶ PUT ─▶ pull
```

## States
Drawn per screen in `uiux/`. Every extension page has: first load, cached,
offline, empty, error (provider code verbatim), read-only (sync stopped).
Phone: off, on, syncing (subtitle only), error, demo (unavailable).
No spinner for anything local, either side.

## Components & copy
`uiux/components.md`: sidebar, status chip, money cell, inline editor row,
picker, conflict card, toast, empty state. Copy keys sit with each screen.
Extension: `chrome.i18n`, `_locales/en` + `_locales/zh_CN`, same strings as
the app where the concept is shared. Phone: new keys in `src/i18n/en.ts` +
`zh.ts` under `browserSync.*`.

## Deviations from the `uiux` skill
- No sync-frequency setting. Pull on visible/foreground is one cheap
  listing; a "manual" mode would only add stale data.
- No queue page. Ops are tiny and flush in ~2 s; the chip count is enough.
- Desktop table editing (Tab/Enter across cells) instead of the phone's
  tap-to-sheet, since the extension's reason to exist is the keyboard.
