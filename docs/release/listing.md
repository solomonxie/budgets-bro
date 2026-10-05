# Publishing Budgets Bro — step by step

Every field below is ready to paste. `TODO` = only you can supply it.
App Store Connect paths start at **Apps → Budgets Bro → Distribution →**.

| | |
|---|---|
| Bundle ID | `com.example.budgetsbro` |
| SKU | `budgetsbro-ios` |
| Version | `1.0` (`MARKETING_VERSION`) |
| Build | timestamp, set by `npm run release:ios` |
| Devices | iPhone only (`TARGETED_DEVICE_FAMILY = 1`) — no iPad screenshots needed |
| Min iOS | 16.4 |
| Privacy Policy URL | `https://github.com/solomonxie/budgets-bro/blob/master/docs/release/privacy-policy.md` |
| Support URL | `https://github.com/solomonxie/budgets-bro/issues` |

---

## 1. Apple Developer account

- [ ] developer.apple.com → Account → membership **active** (paid, Individual is fine).
- [ ] App Store Connect → **Business** (Agreements, Tax, and Banking) → no pending agreement banner. Free app: no Paid Apps agreement or banking needed.

## 2. Xcode

- [ ] Xcode → Settings → **Accounts** → signed in with the developer Apple ID; the team shows under it.
- [ ] `cp ios/Local.xcconfig.example ios/Local.xcconfig`, set your Team ID (developer.apple.com → Membership). Gitignored — never commit it.
- [ ] `cd ios && pod install` succeeds.

## 3–4. Bundle ID and iCloud container

Already created by automatic signing during device builds. Verify at
developer.apple.com → Certificates, Identifiers & Profiles:

- [ ] Identifiers → `com.example.budgetsbro` → **iCloud** checked (CloudKit/iCloud Documents), container `iCloud.com.example.budgetsbro` assigned.
- [ ] The entitlements file no longer pins `Development`; `ios/ExportOptions.plist` sets `iCloudContainerEnvironment = Production` at export.

## 5. Run on the iPhone

- [ ] `npm run ios` → Release build on the paired iPhone. Smoke-test: budget, add a spend, accounts, insights, backup to iCloud, Face ID lock.

## 6. Create the app in App Store Connect

**Apps → + → New App**

| Field | Value |
|---|---|
| Platforms | iOS |
| Name | `Budgets Bro` |
| Primary Language | English (U.S.) |
| Bundle ID | `com.example.budgetsbro` (dropdown) |
| SKU | `budgetsbro-ios` |
| User Access | Full Access |

## 7. Listing content

Fill the pages in [App Store Connect pages](#app-store-connect-pages) below. Screenshots: see [Screenshots](#screenshots).

## 8–9. Archive and upload

```
make release
```

Runs the typecheck and tests, then archives Release, signs for App Store and uploads (`scripts/release-ios.sh`) — no Xcode clicks.
Processing in App Store Connect: 15–60 min, then an email "build has completed processing".

Fallback, Xcode GUI: open `ios/BudgetsBro.xcworkspace` → destination **Any iOS Device (arm64)** → Product → **Archive** → Organizer → **Distribute App** → App Store Connect → Upload.

## 10. TestFlight

- [ ] App Store Connect → **TestFlight** → the build shows no "Missing Compliance" (see [Export compliance](#export-compliance)).
- [ ] Internal Testing → **+** group `Me` → add your Apple ID → install via the TestFlight app on the iPhone.
- [ ] Same smoke test as step 5, on the TestFlight build (this is the exact binary Apple reviews). Check iCloud backup specifically — it's the Production container now.

## 11. Submit

- [ ] `iOS App → 1.0 Prepare for Submission` → **Build** → **+** → pick the build.
- [ ] Every page in [App Store Connect pages](#app-store-connect-pages) filled; App Privacy published.
- [ ] **Add for Review** → **Submit for Review**.

## 12. App Review

- Typical: 24–48 h. Status: Waiting for Review → In Review → Pending Developer Release.
- Rejection → **Resolution Center**: reply there, or fix, bump nothing but re-run `npm run release:ios` (new build number is automatic), attach the new build, resubmit.
- Likely questions: AI feature (notes explain it's optional/BYO key), iCloud backup (optional).

### Guideline 2.1 "Information Needed" (new developer accounts)

Apple wants a screen recording plus answers 2–6. The answers are the App Review Notes further down — paste them into the reply **and** into App Review → Notes.

Record the build Apple will review. If it's a new build, upload it first (`npm run release:ios`), pick it under **Build** on the `1.0` page, and install it from TestFlight.

Recording (the build Apple reviews, on the iPhone, current iOS):
1. iPhone Settings → Control Center → add **Screen Recording**. Turn on Do Not Disturb.
2. In the app, Settings → Budget Boards → switch to **Demo** (keeps your real numbers out). Swipe the app away.
3. Start recording, then launch the app from the Home Screen.
4. ~2 minutes: Budget (scroll, assign an amount) → Spend (enter a spend with a payee, category, one item, Save) → Accounts (open an account, its trend) → Insights (breakdown, Baby Steps, one calculator) → Settings (language, app lock, export, AI Connections showing it needs the user's own key, Remove all app data shown but cancelled).
5. Stop. Photos → trim → share the video.

Reply: `App Review` in App Store Connect → the message → **Reply**, attach the video (or a link, e.g. an unlisted YouTube/iCloud link, if it's too large), paste:

```
Hello, thank you for the review. Answers below, and the same text is now in the App Review Information notes.

1. Screen recording attached, captured on an iPhone 14 running the latest iOS, starting from launch. The app has no account registration or login (so no account deletion flow), no user-generated content, and no paid content.

[paste the App Review Notes block from PURPOSE AND AUDIENCE to the end]
```

## 13. Release

- [ ] Status **Pending Developer Release** → `1.0` page → **Release This Version**. Live in the store within ~24 h.
- [ ] `git tag v1.0 && git push --tags`.

---

## Screenshots

App Store Connect slot **iPhone 6.9" Display** takes `1320 × 2868`. Upload that one set; App Store Connect scales it for smaller phones.

Ready now — eight shots (2026-10-03, simulator, demo board, JPEG q80), upload in filename order:

- `docs/release/screenshots/*.jpg` — 1320 × 2868 (English)
- `docs/release/screenshots/zh-Hans/*.jpg` — 简体中文 localization

To recapture:

1. `npm run ios` (Release — no dev overlay). Load a realistic board, no real personal figures.
2. Status bar: full battery, Wi-Fi, no notifications. Side button + Volume Up per shot.
3. Shots, in upload order:
   1. **Budgets** — month with a healthy "Unassigned" and several categories
   2. **Spent** — add-transaction screen mid-entry
   3. **Accounts** — list with net worth
   4. **Chequing** — one account's register
   5. **Mortgage** — loan details with payoff date
   6. **Insights** — spending breakdown + top categories
   7. **Payee trend** — who the money goes to
   8. **Settings** — "no server, no account" copy
4. AirDrop to the Mac, e.g. `~/Desktop/shots/`, then:

```
scripts/store-screenshots.sh ~/Desktop/shots
```

Outputs overwrite `docs/release/screenshots/`. Drag its files into the 6.9" slot.

App Preview video: skip for 1.0.

---

## App Store Connect pages

### `iOS App → 1.0 Prepare for Submission`

| Field | Value |
|---|---|
| Previews and Screenshots | [Screenshots](#screenshots) |
| Promotional Text | below |
| Description | below |
| Keywords | below |
| Support URL | `https://github.com/solomonxie/budgets-bro/issues` |
| Marketing URL | leave blank |
| Version | `1.0` |
| Copyright | `2026 solomonxie` |
| Routing App Coverage File | leave blank |
| Build | the uploaded build (step 11) |
| App Review → Sign-In Required | Off |
| App Review → Contact First / Last Name | TODO |
| App Review → Phone | TODO (with country code, e.g. `+1 …`) |
| App Review → Email | TODO |
| App Review → Notes | below |
| App Review → Attachment | none |
| Version Release | **Manually release this version** |

Promotional Text (≤170, no price wording — Guideline 2.3.7):

```
Zero-based budgeting that stays on your iPhone. Works offline, backs up privately, no account, no server.
```

Description:

```
Budgets Bro is zero-based budgeting that stays on your iPhone. Give every dollar a job before the month starts, watch the categories rather than the balance, and know where the money is going before it goes.

No account. No subscription. No server holding your ledger.

BUDGETING
• Zero-based budgeting — assign every dollar to a category until nothing is left unassigned
• Accounts, transactions, payees, and categories, with running balances
• Flagged transactions for anything that needs a second look
• Multi-currency: type in one currency, read the totals in the rest
• Baby Steps progress, each step saying what it is for
• Import your history from a YNAB export

INSIGHTS
• Spending by category and by payee — who the money actually goes to
• Account balance and net-worth trends over time
• Exchange-rate history for the currencies you actually hold
• Cost-of-living view of where each month goes

CALCULATORS
• Mortgage, payoff, refinance, affordability, and rent vs. buy
• Amortization, auto loan, loan payoff, and debt-to-income
• Compound interest, investment growth, and tax savings
• Canadian mortgage rules built in

YOUR DATA
• Everything lives in a local database on the device, and works with the network off
• Optional backup to your own iCloud Drive folder, visible in the Files app
• Optional backup to your own S3 bucket
• Export and import as plain files — you can walk away with your data at any time
• Face ID, Touch ID, or a passcode locks the app

OPTIONAL AI
Bring your own API key from OpenAI, Anthropic, Google, Mistral, Groq, DeepSeek, or xAI and ask questions about your own numbers. The key is yours, usage shows up in your provider's dashboard, and the feature is off until you turn it on. Skip it entirely and the app works the same.

Free, with no upsell, no ads, and no analytics.
```

Keywords (98/100 — "budget" is omitted, the name already indexes it):

```
networth,envelope,zero-based,expense,money,finance,tracker,offline,privacy,mortgage,savings,ledger
```

App Review Notes (also the Guideline 2.1 answers Apple asked to keep here):

```
No account or login. On first launch tap "Start empty", then Settings (top-left icon) → Demo Mode: every screen fills with a sample household, kept apart from real data. Turn it off to return to the empty budget.

PURPOSE AND AUDIENCE
Budgets Bro is a zero-based budgeting app for individuals and households who want to plan their money privately, on their own iPhone. You give every dollar of income a job (a category) before the month starts, record spending as it happens, and see what's left in each category. It solves overspending and "where did the money go" without handing bank logins or financial data to a company: there is no account, no server, and no bank connection.

HOW TO USE THE MAIN FEATURES (with Demo Mode on)
- Budget tab: the month's categories, what's assigned and what's left. Tap a category's amount to assign money.
- Spend tab: enter an amount, pick a payee, category and account, Save.
- Accounts tab: balances, net worth; tap an account for its transactions and balance trend.
- Insights tab: spending breakdown, trends, Baby Steps plan, payee and price trends, mortgage/loan/investment calculators.
- Settings (top-left icon): budgets, language (English/Chinese), app lock (Face ID/passcode), export/import, backups, AI connections, remove all app data.

OPTIONAL FEATURES (off by default; the app is fully usable without them)
- AI analysis (Settings → AI Connections): the user pastes their own API key from a provider they choose. We provide no key and receive nothing.
- Backup to the user's own iCloud Drive or their own Amazon S3 bucket (Settings → Data).

EXTERNAL SERVICES
- Frankfurter (api.frankfurter.app): public European Central Bank exchange rates, used for multi-currency totals. No personal data is sent.
- Only if the user adds their own key: OpenAI, Anthropic, Google Gemini, Mistral, Groq, DeepSeek, xAI, Qwen, Kimi, GLM, ERNIE or an OpenAI-compatible server the user enters, called directly from the device. On the China storefront only DeepSeek, Qwen, Kimi, GLM and ERNIE are offered; the others are not shown.
- Only if the user turns it on: Apple iCloud Drive, or Amazon S3 with the user's own credentials.
No analytics, advertising, crash reporting, authentication or payment services. We run no server.

REGIONAL DIFFERENCES
The app works the same in every region. It is available in English and Simplified Chinese. A few calculators model specific rules — Canadian home purchase and mortgage rules, a Chinese mortgage prepayment calculator, and Canadian tax-year insights — and are simply options in the list elsewhere.

REGULATION
Budgets Bro is a personal record-keeping and planning tool. It does not move money, hold funds, lend, process payments, connect to banks or give investment advice; calculator results are estimates for planning. No third-party protected material is included.

All data is stored in a local database on the device. We operate no server and receive no user data.
```

What's New: not shown for a first version. From 1.1 on, write it here.

### `General → App Information`

| Field | Value |
|---|---|
| Name | `Budgets Bro` |
| Subtitle (29/30) | `Zero-based budgeting, offline` |
| Category — Primary | Finance |
| Category — Secondary | Productivity |
| Content Rights | **No**, it does not contain, show, or access third-party content |
| Age Rating | **Edit** → answer below → result **4+** |
| License Agreement | Apple standard EULA (default) |
| Privacy Policy URL | `https://github.com/solomonxie/budgets-bro/blob/master/docs/release/privacy-policy.md` |

Age rating questionnaire — every answer:

| Section | Answer |
|---|---|
| Parental controls / age assurance | No |
| Unrestricted web access | No |
| User-generated content | No |
| Messaging and chat | No |
| Advertising | No |
| Violence, sexual content, profanity, horror, mature themes | None |
| Alcohol, tobacco, drugs | None |
| Medical or treatment information / health & wellness | None |
| Gambling, simulated gambling, contests, loot boxes | None / No |
| Made for Kids | No |

Regional (Korea, China Mainland, Vietnam) — leave unset.
**Digital Services Act** trader status: **Not a trader** (free, no monetization) — if App Store Connect blocks EU availability without it, answer this in Business → Compliance.

### `App Store → Trust & Safety → App Privacy`

| Field | Value |
|---|---|
| Privacy Policy URL | same as above |
| Do you or your third-party partners collect data from this app? | **No, we do not collect data from this app** |

Then **Publish**. Label shows "Data Not Collected".

Still true only while there's no analytics/crash SDK — re-check before each submission:

```
grep -rniE "analytics|firebase|sentry|amplitude|mixpanel|posthog|bugsnag" package.json ios/Podfile.lock
```

Data only leaves the device to destinations the user configures (their iCloud, S3, AI provider); you never receive it, so it isn't "collected".

### `App Store → Trust & Safety → App Accessibility`

Skip for 1.0 rather than over-claim.

### `App Store → Monetization → Pricing and Availability`

| Field | Value |
|---|---|
| Base Country or Region | United States (USD) |
| Price | **Free** ($0.00) |
| Availability | All countries or regions |
| Tax Category | App Store software (default) |
| iPhone and iPad Apps on Apple Silicon Macs | **Off** for 1.0 (Face ID lock and iCloud Files paths untested on Mac) |
| Apple Vision Pro | Off |

### Not needed for 1.0

In-App Purchases, Subscriptions, In-App Events, Custom Product Pages, Product Page Optimization, Promo Codes, Game Center, Featuring Nominations, Ratings and Reviews, History.

---

## Export compliance

No page for it in App Store Connect — nothing to fill in. `ITSAppUsesNonExemptEncryption = false`
in `Info.plist` answers it at upload (HTTPS/TLS, Keychain, HMAC-SHA256 signing only → exempt).
Verify: TestFlight → the build is **not** marked "Missing Compliance".
Only if it is: **Manage** → **None of the algorithms mentioned above**.

---

## 简体中文 localization

All fields, ready to paste: [listing-zh.md](listing-zh.md).
