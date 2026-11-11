# Budgets Bro for Chrome

Your ledger on a computer, over your own S3 bucket. The bucket is the source
of truth; this page and the phone app both cache it, synced through a
per-device op log.

Design: `../docs/design/browser-sync/` (`DESIGN.md`, `PROTOCOL.md`,
`UIUX_DESIGN.md`, `IMPLEMENT_PLAN.md`). Sync code is shared with the app in
`../sync-core/`.

```
npm install      # local node_modules only
npm run check    # tsc
npm test         # vitest: protocol vectors
npm run build    # → dist/
```

Load: `chrome://extensions` → Developer mode → Load unpacked → `dist/`;
click the toolbar icon. After a rebuild, hit reload on the extension card.

- Connection in `chrome.storage.local`, never `.sync`.
- Host access to the bucket endpoint is asked for at setup
  (`optional_host_permissions`).
- Icons: `static/icons/`, from the iOS 1024 px app icon via `sips -z`.
