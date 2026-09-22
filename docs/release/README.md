# App Store Release

Bundle ID `com.solomonxie.budgetsbro` · Team `Z3VPHM3BJL` · iOS 16.4+ · portrait-first, iPhone + iPad.

- [`listing.md`](listing.md) — every App Store Connect field, pre-filled where it can be
- [`privacy-policy.md`](privacy-policy.md) — draft policy; must be hosted at a public URL before submitting

## 1. Fix before archiving (code)

| Where | Change | Why |
|---|---|---|
| `ios/BudgetsBro/BudgetsBro.entitlements` | `icloud-container-environment` → `Production` | `Development` iCloud containers don't exist for App Store builds; backup silently fails for users |
| `ios/BudgetsBro/Info.plist` | `CFBundleShortVersionString` is the literal `1.0.0`, while the project has `MARKETING_VERSION = 1.0` | Pick one. Use `$(MARKETING_VERSION)` in the plist and bump the build setting per release |
| `ios/BudgetsBro/Info.plist` | Drop `UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` unless the Files-app folder is intended | They expose the app's Documents folder in Files; keep only if that's the feature |
| `project.pbxproj` `TARGETED_DEVICE_FAMILY = "1,2"` | Decide: keep iPad, or set to `1` | Keeping iPad means iPad screenshots are **required** and reviewers test on iPad |
| `README.md` / store copy | Remove the "🚧 Work in progress" framing | Review rejects apps presented as beta/incomplete (guideline 2.2) |

Versioning per release: `MARKETING_VERSION` = user-visible (1.0.0), `CURRENT_PROJECT_VERSION` = build number, must increase on every upload.

## 2. Apple Developer / App Store Connect setup (manual, one-off)

1. Paid Apple Developer Program membership active (Individual is fine).
2. Certificates, Identifiers & Profiles → identifier `com.solomonxie.budgetsbro` exists with **iCloud (CloudKit/CloudDocuments)** capability, and the iCloud container `iCloud.com.solomonxie.budgetsbro` is created for **Production**.
3. App Store Connect → My Apps → **+ → New App**: platform iOS, name, primary language, bundle ID, SKU (any string, e.g. `budgetsbro-ios`).
4. Agreements, Tax, and Banking → **Paid Apps agreement not needed** (free app), but the Free Apps terms must show *Active*.
5. Host the privacy policy at a public URL (GitHub Pages off this repo is enough) — App Store Connect will not accept a submission without it.

## 3. Assets to produce

| Asset | Spec | Status |
|---|---|---|
| App icon | 1024×1024 PNG, no alpha, no rounded corners | ✅ in `ios/BudgetsBro/Images.xcassets/AppIcon.appiconset/` (light/dark/tinted), alpha-free — verified |
| iPhone 6.9" screenshots | 1320×2868 or 1290×2796, 3–10 shots | ❌ existing `docs/screenshots/*.png` are 1206×2622 (iPhone 16 Pro) — **wrong size**, recapture |
| iPad 13" screenshots | 2064×2752 or 2048×2732 | ❌ only if iPad stays in `TARGETED_DEVICE_FAMILY` |
| App preview video | optional | skip for 1.0 |

Confirm the current accepted sizes in App Store Connect at upload time — Apple changes them.

Recapture on the right device:
```
# Simulator (no paid-device round trip); pick a 6.9" device, e.g. iPhone 17 Pro Max
xcrun simctl list devices | grep "Pro Max"
xcrun simctl boot "iPhone 17 Pro Max"
npx eas-cli build --profile preview --platform ios    # simulator build
xcrun simctl install booted <app>.app
xcrun simctl io booted screenshot ~/Desktop/shot-01.png
```
Check the icon has no alpha: `sips -g hasAlpha ios/BudgetsBro/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`

## 4. Build and upload

Cloud (works on macOS Sequoia, where Xcode 26.4 can't be installed):
```
npx eas-cli build --profile production --platform ios
npx eas-cli submit --platform ios --latest
```

Local Xcode, if on macOS Tahoe with Xcode 26.4+:
```
cd ios && pod install
open BudgetsBro.xcworkspace
# Product → Destination → Any iOS Device → Product → Archive → Distribute App → App Store Connect
```

Upload takes minutes; App Store Connect *processing* takes 15–60 min before the build is selectable.

## 5. In App Store Connect (manual)

1. Fill every field from [`listing.md`](listing.md).
2. **App Privacy** questionnaire — answers in `listing.md`. Required before submitting; it is separate from the privacy policy URL.
3. **Export compliance**: the app uses HTTPS and Keychain only — standard/exempt encryption. Add `ITSAppUsesNonExemptEncryption = false` to `Info.plist` to stop being asked on every build.
4. Attach the processed build, set the release option (manual release recommended for 1.0).
5. **App Review notes**: the AI feature needs a reviewer-usable path — see the notes draft in `listing.md`. Provide a test API key or a clear "optional, skip" note.
6. Submit. First review is typically 24–48 h; rejections come back in Resolution Center.

## 6. After approval

- Tag the release in git; keep `CURRENT_PROJECT_VERSION` monotonically increasing.
- TestFlight for the next build before it goes public: same production build, invite via email, no UDIDs.
