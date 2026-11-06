# Components (extension)

Plain TS + CSS, no framework. Tokens copied from `src/theme/colors.ts`
(near-black page, `#1C1C1E` surface, teal accent).

## Money cell
```
$84.00     −$12.00     $0.00      +$3,200.00
green      red         muted      green (inflow only)
```
Right-aligned, tabular figures, same formatter as the app (`domain/money`).

## Editable cell
```
idle      $400.00
hover     $400.00 ✎             ← pencil only on hover
editing  ┌$400.00▌┐
invalid  ┌$4o0▌   ┐  red outline, Enter ignored
```

## Typeahead picker (payee, category, account)
```
┌──────────────────────────────┐
│ Gro▌                         │
│ ＋ New payee "Gro"           │ ← payee only
│ 🛒 Groceries   Everyday      │ ← match bold, group muted
│ ─ TRANSFERS ──────────────── │ ← payee only
└──────────────────────────────┘
```
↑/↓ move, Enter pick, Esc close. Max 8 rows, scrolls.

## Status chip
See `sync.md`. Text + glyph, never colour alone.

## Conflict card
See `sync.md`. Inline, below the row, never a modal.

## Toast
```
⌐ 2 transactions deleted     ( Undo ) ¬     bottom-center, 6 s, one action
```

## Empty state
```
            No transactions yet.
          [ + Add transaction ]
```
One line, at most one action, centered in the content area.
