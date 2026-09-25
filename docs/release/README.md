# App Store Release

Bundle ID `com.solomonxie.budgetsbro` · iOS 16.4+ · iPhone only, portrait.

- [`listing.md`](listing.md) — step-by-step plan and every App Store Connect field, ready to paste
- [`privacy-policy.md`](privacy-policy.md) — the policy; its GitHub URL is the Privacy Policy URL
- `screenshots/` — upload-ready 6.9" set (also shown in the root README), from `scripts/store-screenshots.sh`

Upload a build: `make release` (typecheck + tests, then archive → App Store Connect; build number = timestamp).

Versioning: `MARKETING_VERSION` in `project.pbxproj` is the user-visible version; bump it per release.
