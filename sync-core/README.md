# Sync core

Protocol code shared by the app (`src/`) and the Chrome extension
(`extension/`). Format: `docs/design/browser-sync/PROTOCOL.md`.

- Plain TypeScript: no React Native, DOM, Node or npm imports, so Metro,
  jest and esbuild all take it as-is via relative imports.
- Anything platform-specific (fetch, gzip, storage, `now`) is injected.
- `clock.ts`: hybrid logical clock and stamps.
- `bucket.ts`: write-once S3 client over `sigv4.ts` + `sha256.ts`.
- `bytes.ts`: UTF-8/hex without TextEncoder (Hermes has none).
