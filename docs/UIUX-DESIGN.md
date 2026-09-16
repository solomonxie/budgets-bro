# UI/UX Design

Screen-by-screen spec for ByoBudget (Expo/React Native, dark-only, YNAB-style envelope budgeting), plus the conventions behind it. Product/domain decisions live in `DESIGN.md`; task breakdown in `IMPLEMENTATION_PLAN.md`.

Every rule here was paid for by something that shipped wrong first — the reasons are kept in place, not trimmed.


## Overall style

Apple minimalist style, modern, simple, intuitive, clear...

Reuse an existing box before adding a screen. Reuse the platform's proven widget before hand-rolling one — a custom scroll wheel failed twice against "must scroll reliably inside a confirm sheet" before the native spinner just worked.

One home per control: anything scoped to an object lives in that object's own menu/page, never mirrored as a second section elsewhere.


## Languages

Support multi-languages since day1.

Copy:
- Plain contextual wording, never bracket plurals (`account(s)`). Write the real label: "Emergency fund accounts", "Categories for giving".
- Don't borrow another product's proprietary term ("Unassigned Cash", not YNAB's "Ready to Assign").
- If a label style forces uppercase, spell abbreviations out — "12-Mo Avg" renders as "12-MO AVG".
- A caption that names a number should show it: "Spent $316 of $400", not "Fully spent".


## Navigation & information architecture

```
 ⚙︎  Budget                        History      ← native header
────────────────────────────────────────────
              (screen content)
────────────────────────────────────────────
 Budget   ✛ Spend   Accounts   Insights       ← flush tabs, explicit bg
```

- Tabs are destinations only. No hidden tab reachable only from a header button; Settings lives as a gear in the native header, same row as the screen's own action, identical on every screen.
- One action tab (`✛ Spend`) intercepts its own press and opens the sheet instead of navigating — flush in the bar, never raised above it.
- No FAB. One global entry point beats two buttons with different behavior, even when the per-screen one could prefill context. (Android elevation also refuses to follow a rounded pill's shape — the shadow renders as a rectangular smudge.)
- Give the tab bar an explicit background/border; iOS's translucent blur reads as a stray dark bar against a near-black theme.
- Don't keep a one-screen navigator alive just to host a screen that has no sub-routes — make it a modal.


## UI Components

### Theme

Dark by default, near-black (`#0D0D0D`) page, surface `#1C1C1E`, one accent (teal) — not pure black, not stock blue.


### Pop up window

if something / some options aren't many, don't jump to another page, but use propor sized dropdown menu or pop up window instead.

Half-height sheet is the default for pickers and short forms; full page only when the form truly needs the room.

```
        ▁▁▁▁▁▁▁                 ← drag handle; drag anywhere dismisses
┌──────────────────────────┐      (only once the list is scrolled to top)
│ Cancel     Payee         │    ← Cancel stays a real button
│ ┌──────────────────────┐ │
│ │ 🔍 search (sticky)   │ │    ← fuzzy, typo-tolerant
│ ├──────────────────────┤ │
│ │ row                  │ │    ← list height PINNED, so narrowing
│ │ row                  │ │      results can't shrink the sheet
│ └──────────────────────┘ │      behind the keyboard
└──────────────────────────┘
        [ keyboard ]
```

- Full-screen picker labels its dismiss "‹ Back", not "Cancel".
- A sheet renders on its own native surface and gets no automatic keyboard resize — slide the whole sheet clear of it.
- First tap on a row under an open keyboard must both dismiss and register (`keyboardShouldPersistTaps`); every field and button dismisses the keyboard, not just blank space.
- Defer autofocus one frame so it doesn't compete with the open animation — otherwise the popup "takes a beat".
- Render a picker's modal as a **sibling** of the layout, not a child: a layout swap remounts it and reads as the sheet closing and instantly reopening.
- No discard path? Ship one auto-saving "Done" — backdrop tap and hardware back commit too.

```
┌────────────────────────────┐   ← upper third, not centered: the amount
│         Groceries          │     field autofocuses, so the keyboard is
│          $400.00           │     already up and centering leaves no gap
│    Unassigned: $120.40     │
│    Carried over: $35.00    │
│ ⋯                    Done  │   ⋯ = rename / move / delete / history
└────────────────────────────┘
        [ keyboard ]
```


### Menus

- `⋯` per object, in a corner — don't let secondary actions compete with the primary buttons in the same row (primary centered, `⋯` bottom-left/right).
- Destructive action inside the object's own menu, red, last. Never a second tap target beside a row's chevron.
- A menu item that opens another modal or alert must wait for the menu's own dismiss animation to finish — stacking two native modal transitions can wedge iOS's presentation state (screen looks fine, touches stop landing, no crash).
- An item that renames or deletes the object the popup is showing closes that popup first.


### Diagrams

Trend graphs: stacked area/line, not stacked bars — reads as a continuous stack while keeping "total at a glance" on the top edge. Each series is a band between the running total before and after it, filled ~55% with a solid top edge.

```
$ │                                    ╱▔▔╲
  │        ╱▔╲        ╱▔╲     ╱▔▔╲    ╱    ╲
  ├╌╌╌╌╌╌╌╱╌╌╌╲╌╌╌╌╌╌╱╌╌╌╲╌╌╌╱╌╌╌╌╲╌╌╱╌╌╌╌╌╌  avg   ← dashed, full width
  │  ╱▔╲ ╱     ╲    ╱     ╲ ╱      ╲╱
  └──────────────────────────────────────────→ scrolls horizontally
    Apr   May   Jun   Jul   Aug   Sep
```

- The baseline must sit on the same scale as what's actually plotted (average the visible top-N series, not a separate full-ledger figure), dashed across the full width so it survives scrolling, labelled in the fixed Y-axis column.
- Average over median for a user-facing benchmark: "12 Months Avg" explains itself, median needs a footnote.
- Never ship a misleading delta. A partial month against a finished one always reads "down" — show "% reached" (pace), not a red/green ▲▼ verdict.


### Buttons

Sometimes text link style look better than big button, depends on the usage.

- Primary Save: big, full-width, in the form's normal scroll flow right after the last field — not a small header link, and not pinned to a detached bottom bar (reads disconnected from the form).
- Add action at the bottom of a group: centered accent text link (`+ Add S3 Backup`), not a filled button.
- Row-level status/action: right-aligned pill matching the row's rhythm, not a leading checkbox.


### Forms

```
┌──── Add Transaction ──────────── ✓ Repeating ─┐   ← mode as a header pill,
│               − $42.10   [Outflow│Inflow]     │     not a full-width row
│  Payee            │  Category                 │   ← pairs side by side,
│  Sep 12           │  Chequing                 │     no label rows
│  Memo                                         │
│          [          Save          ]           │
└───────────────────────────────────────────────┘
```

- Pair short fields side by side to shorten a form rather than dropping fields.
- Drop persistent label rows; rely on placeholder or the picked value. Add a small caption only where a compact field is genuinely ambiguous, and give every field a meaningful empty-state placeholder.
- Field order follows the real-world sequence of the decision (date before account).
- Hide a field that can't apply to the current mode, clear its value on switch, and defend against a stale value at save.
- Default a required field to the last-used (or only) value instead of blank, and drop the now-impossible "None" option.
- Short date format ("Sep 12") where the year is noise; full format where old dates are the point.
- Keep a draft of any failed form attempt — retyping a secret from a password manager after every failure is the pain to remove.


### Date, month & wheel pickers

```
  Sep 12  ──tap──▶  ┌─────── confirm sheet ───────┐
  (field)           │      Sep  │  12  │  2026    │  ← the OS's own spinner
                    │                             │
                    │          [  Done  ]         │
                    └─────────────────────────────┘

  ‹   September 2026   ›     ← arrows step; the LABEL ITSELF opens the
      ▲ tappable               same picker to jump anywhere
```

- Dates open the OS spinner from a tap on the field, inside a confirm sheet. Never an inline wheel: nested inside a sheet's own draggable ScrollView it fights the drag-to-dismiss gesture, and a hand-rolled wheel failed twice on "must scroll reliably inside a modal" before the native one just worked.
- Neither platform has a month-only mode. Reuse the same date spinner and discard the day on Done — a custom year+month wheel would match exactly, but isn't worth re-fighting the scroll problem for.
- Any numeric field that's a choice rather than typing (a repeat interval) uses the same tapped-open native wheel, not a keyboard field.
- Month navigation is arrows **plus** a tappable label — stepping one at a time is not a way to reach last March.
- Date defaults to today. Short format ("Sep 12") where the year is noise, full format where old dates are the point — opt in per field, never globally.
- Recurrence picker: show the frequency + interval + weekday builder directly, one view. A preset list (Daily/Weekly/…/Custom) just makes the real builder something you pick "Custom" to reach. Model it on Apple Reminders' shape, and use the one shared component everywhere a schedule is created.


### Lists and rows

```
CASH
┌────────────────────────────────────┐
│ Chequing                  $1,204.55│  ← name truncates to ONE line so
│ Savings                   $8,000.00│    heights align with the balance
└────────────────────────────────────┘
                                        ← extra gap between kind groups
SAVINGS · INCOME · CREDIT …
```

- Secondary info as a smaller muted line under the title (memo, `region · prefix`) — that subtitle is what tells near-duplicate rows apart.
- Group by kind with a subtotal on the header and extra spacing between groups.
- Secondary content (future/scheduled items) as a collapsed-by-default box, count in its header, rows visually muted, tappable into the same edit flow as real ones:

```
┌ Scheduled (3) ─────────────────── ⌄ ┐
│  Rent          Next: Oct 1  [Approve]│
│  Netflix       Next: Oct 4        ⋯  │
└──────────────────────────────────────┘
```


### Feedback & errors

- A manual action must never be a silent no-op — if nothing is configured, say so where the button is.
- Show progress inline where the action was taken (the row's own spinner, a status line), not a blocking overlay.
- Don't render a fast local stat above the slow network list it describes — hold both until the list resolves, or it looks like an empty folder with stats attached.
- Errors inline next to what failed; alerts reserved for confirmations.
- Confirm before anything that creates or replaces a whole board/dataset, restating what it does at the point of action.
- Nothing commits money on its own. Due items surface as a badge + approval queue; a bare tap on a scheduled row opens its detail, never posts it.


### Numbers & money

```
┌──────────────────────────────────────────┐
│ SPENT THIS MONTH        12 MONTHS AVG    │
│ $2,431.90               $2,180.00        │  ← both columns same type scale
│ Unassigned $120.40      112% reached     │
└──────────────────────────────────────────┘
```

- Primary number big, secondary small, in the same card. Colour by meaning (green positive / red negative / amber partial).
- Keep the same concept the same size across screens.
- Never show a raw near-zero ledger balance where a meaningful aggregate ("$8,400 this year") is what the user means.


### Empty state & demo data

- Every "coming soon" screen uses one shared stub component styled as a real card in the app's own card language — not plain left-aligned text.
- Seed a demo board once on install: realistic, deletable, re-creatable from a row `⋯`. Names auto-increment ("Demo", "Demo 2") so re-seeding never produces duplicates.
- Demo data must look lived-in: real payee names on every leg (blank ones render as "No Payee"), itemized purchases rather than only value snapshots, balances that never print negative.


### Local backup

must natively support backup all configs and app data to mobile local storage, and can import from it.

- State the real protection scope in the hint: an on-device snapshot survives a bad import or corruption, **not** a lost phone.
- Say where the file lands (visible in Files app under "On My iPhone" on a real device build) so it can be copied off manually.
- Keep a manual "Restore Latest" reachable whenever local is the only destination — auto-writing the snapshot covers the save side, but restore must never depend on a file picker.


### Cloud Bucket Backup

Add connection:
- Ask for bucket + folder + key + secret, one section. Nothing else — no endpoint/S3-compatible fields until asked for.
- Relabel raw service terms: "Key Prefix" → "Folder (key prefix)".
- Auto-detect the region; never make the user type it. Validate credentials against the real service before saving (upload + delete a marker), fail closed.
- Every attempt (success or failure) is saved as a draft keyed by bucket+prefix+key, listed under the form: tap to refill all fields including the secret, ✕ to drop one, auto-removed once it succeeds.
- Kick off a first sync immediately on save, so the bucket isn't empty until the next run.
- Secrets to secure store per connection (and per draft), never in the DB or any export — and say so under the field.

Browse (tap a connection) — one level at a time, the same screen pushing itself, no separate detail screen:

```
┌─────────────────────────────────────────┐
│ ‹ Back          bucket-name         (⋯) │  Back = up one level,
├─────────────────────────────────────────┤  closes at root. No breadcrumb
│ 📁  202609                          ›   │  strip, no ".." row.
│ 📄  household-20260915.zip            │
│                       4.2 MB · Sep 15   │
├─────────────────────────────────────────┤
│ 3 backups · 12.4 MB          ⟳ Syncing… │  ← one-line footer, scoped to
└─────────────────────────────────────────┘    this folder, counted
                                               recursively; spinner rides
                                               the same line, never its own row
```

- Can never navigate above the connection's configured prefix — that prefix is the connection.
- Hold the footer back until the listing resolves; if stats fail, hide the line rather than showing an error banner.
- File row is read-only unless the file is genuinely actionable — then a tap does that thing directly rather than opening an info-only sheet.

`⋯` — same menu at every level, acting on the connection, not the folder:

```
✓ Auto-sync
  Last synced: 2 hours ago      (info row, not tappable)
  Sync Now
  Restore Latest from Cloud
  ──────────
  Delete Connection             (red, last)
```

- Auto-sync is **per connection**, not one global switch — and no separate "Cloud Sync" section survives in Settings once this menu exists.
- Sync Now / Restore Latest target this connection only.
- Restore confirms first when it creates a new board and switches to it; its result renders wherever import results already render.
- Deleting from any depth dismisses every level of that connection's browser.
- Only expose sync intervals a real scheduler honors. With no registered OS background task, "auto" means "while the app is open" — say that, and prefer a plain Auto on/off over a frequency list nothing obeys.
- Skip the sync queue entirely for single-blob backup (one zip up, one zip down); it's only meaningful when sync is per-file jobs.


### AI Intelligence

- Vendor from a real dropdown of every supported vendor, not a hardcoded segmented control. Masked key-format hint under the field, plus a link out to that vendor's own key-creation page.
- Validate by making one real request at save time — no separate "Test Connection" button.
- Keys as a reorderable list (↑/↓), each row showing vendor + running request count, delete in the row's own menu.
- Fallback strategy as an accent text control on the section heading row (`Sequential ▾` / `Round Robin ▾`), shown next to the feature it affects, only once there are 2+ keys.
- Disclose under the field what leaves the device, when, to whom — and that the key itself never does, including in backups.
- Expensive analysis is opt-in per run, never automatic.


## Core UI — the screens

Reference: real YNAB's screenshots — reuse the interaction patterns that carry the core budgeting workflow; goal-tracking and cosmetic extras stay out.

**Budget screen**
```
 ⚙︎   Budget                              History
┌──────────────────────────────────────────────┐
│ SPENT THIS MONTH          12 MONTHS AVG      │
│ $2,431.90                 $2,180.00          │
│ Unassigned $120.40        112% reached       │
│ ⚑ 2 scheduled awaiting approval              │
└──────────────────────────────────────────────┘
 ⌄ Everyday Expenses                    ‹ month ›
   🍎 Groceries      ▇▇▇▇▇▁▁▁    $84 left
      Spent $316 of $400
```
- Unassigned cash is secondary to spent-this-month, colour-coded, never the sole big number.
- Category groups collapse on a tap of the group header (one rotated chevron glyph, not two different characters).
- Category row: optional emoji + name, availability badge (green funded / amber partial / red overspent), thin spent-vs-assigned bar, one-line caption naming both numbers.
- Tapping a category opens the assign popup with the amount already focused — no second tap into the field.
- Month via prev/next **and** a tappable label.

**Transaction entry/edit sheet** — see Forms above for the layout. Large amount field with a numeric keypad and a Done bar; Outflow/Inflow toggle sets the sign; payee/category/account/date/memo; category hidden for income and for tracking accounts; income requires an income stream; "Mark to repeat" as a header pill that swaps Date → Starts and reveals the repeat builder.

**Transactions list** — grouped by date, most recent first. Row: payee, category tag, coloured amount, account, truncated one-line memo. Search + multi-select for bulk edit/delete. Future-dated rows never appear here; they live in the account's Scheduled box.

**Accounts screen** — Net Worth card on top, then groups by kind (Cash / Savings / Credit / Loan / Asset / Tracking / Income last) with subtotals and extra spacing between groups. Row: name (one line, truncated) + balance, red when negative. Income rows show "$X this year", not a near-zero ledger balance. Account detail carries a computed balance trend for cash/savings/credit (credit cards overlay monthly spend, or a paid-off card reads flat), a manual value-history chart for asset/tracking, loan details and the amortization tool inline in the balance box — not as separate cards.

**Insights** — on-device only, distinct from the AI analysis feature; needs no key and sends nothing off-device. Month picker; spending breakdown with the same number scale as Budget's; all-time category trend as a horizontally scrollable stacked area chart of the top 5 categories with a dashed 12-month-average baseline. Baby Steps and Tax Insights link real accounts/categories, falling back to a manual "Mark Done" pill when nothing is linked yet.

**Settings** — sections in order: Payees, AI Keys, S3, Local Backup, Data. Each section: uppercase muted heading, one-paragraph hint, bordered group of rows, centered accent add-link. Per-connection sync controls live in the bucket's own browser menu (see Cloud Bucket Backup above), not in a section of their own.
