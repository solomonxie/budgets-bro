# React Native, bare

No Expo. Not the Expo SDK, not Expo Go, not a dev server — see
[`docs/DESIGN.md`](docs/DESIGN.md#no-expo-go-no-dev-server). If a fix seems to
want an `expo-*` package, pick a community library instead.

Read the exact versioned docs at https://reactnative.dev/docs/0.86/getting-started
before writing any code.

`ios/` is a real Xcode project, edited by hand. `npm run ios` is the whole
loop: Release build straight onto the paired iPhone.

Physical iPhone only. Never build, install, or run on a simulator — the sim
build crashes on iOS 27. If the paired device isn't reachable, stop and say
so; don't fall back to a simulator.

# Lightweight, and blazing fast

Non-negotiable, and it outranks any feature: this is a budgeting app people
open twenty times a day for ten seconds. It must install small and feel
instant on a phone that is several years old. A feature that cannot be built
within this is not built.

Budgets, measured on a Release device build (see `docs/DESIGN.md` for the
numbers as of the last check and the commands that produce them):

- **App**: under 25 MB installed, under 12 MB zipped. Check before
  and after anything that adds a native dependency.
- **JS bundle**: under 4 MB of Hermes bytecode. Precompiled bytecode is not
  optional — a plain-JS bundle parses at every cold start.
- **Interaction**: nothing the user taps may take longer than one frame's
  worth of noticeable delay. No spinner for anything the device does locally.

Rules that keep it there:

- **Never read the whole board to render part of it.** Ask SQL for the rows
  and columns the screen actually shows — a `SELECT *` with three joins to
  populate a dropdown is the shape of the mistake. Add an index (a partial one
  where the rows are a minority) rather than filtering in JS.
- **Weigh every dependency in the bundle, not in the README.** Measure with
  the source-map command in `docs/DESIGN.md`. Prefer one already in the tree,
  then a small focused package, then hand-rolling it. A library that costs
  200 KB to serve an optional feature is not a fair trade.
- **Aggregate in memory only over rows already read for another reason**, and
  memoize it. Recomputing a whole-ledger roll-up on every keystroke is the
  other shape of the mistake.
- **No work on a screen that isn't showing it.** No polling, no background
  timers, no eager prefetch of a page nobody opened.
- Keep assets out of the bundle: SVG or a system glyph over a PNG set.
