# App Store Release

Bundle ID `com.solomonxie.budgetsbro` · iOS 16.4+ · iPhone only, portrait.

- [`listing.md`](listing.md) — step-by-step plan and every App Store Connect field, ready to paste
- [`privacy-policy.md`](privacy-policy.md) — the policy; its GitHub URL is the Privacy Policy URL
- `screenshots/6.5`, `screenshots/6.9` — upload-ready, from `scripts/store-screenshots.sh`

Upload a build: `npm run release:ios` (archive → App Store Connect, build number = timestamp).

Versioning: `MARKETING_VERSION` in `project.pbxproj` is the user-visible version; bump it per release.
