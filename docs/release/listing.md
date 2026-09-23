# Publishing Budgets Bro — step by step

Every field below is ready to paste. `TODO` = only you can supply it.
App Store Connect paths start at **Apps → Budgets Bro → Distribution →**.

| | |
|---|---|
| Bundle ID | `com.solomonxie.budgetsbro` |
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
- [ ] `cd ios && pod install` succeeds.

## 3–4. Bundle ID and iCloud container

Already created by automatic signing during device builds. Verify at
developer.apple.com → Certificates, Identifiers & Profiles:

- [ ] Identifiers → `com.solomonxie.budgetsbro` → **iCloud** checked (CloudKit/iCloud Documents), container `iCloud.com.solomonxie.budgetsbro` assigned.
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
| Bundle ID | `com.solomonxie.budgetsbro` (dropdown) |
| SKU | `budgetsbro-ios` |
| User Access | Full Access |

## 7. Listing content

Fill the pages in [App Store Connect pages](#app-store-connect-pages) below. Screenshots: see [Screenshots](#screenshots).

## 8–9. Archive and upload

```
npm run release:ios
```

Archives Release, signs for App Store, uploads (`scripts/release-ios.sh`).
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

## 13. Release

- [ ] Status **Pending Developer Release** → `1.0` page → **Release This Version**. Live in the store within ~24 h.
- [ ] `git tag v1.0 && git push --tags`.

---

## Screenshots

App Store Connect slot **iPhone 6.5" Display** requires exactly `1284 × 2778` (or `1242 × 2688`).
The 6.9" slot takes `1320 × 2868`. Upload one set; App Store Connect scales it for smaller phones.

Ready now, converted from `docs/screenshots/`:

- `docs/release/screenshots/6.5/*.jpg` — 1284 × 2778
- `docs/release/screenshots/6.9/*.jpg` — 1320 × 2868

Those four are from an older debug build (blue gear overlay, pre-rename screens).
Recapture for the final listing:

1. `npm run ios` (Release — no dev overlay). Load a realistic board, no real personal figures.
2. Status bar: full battery, Wi-Fi, no notifications. Side button + Volume Up per shot.
3. Shots, in upload order:
   1. **Budget** — month with a healthy "Unassigned" and several categories
   2. **Spend** — add-transaction screen mid-entry
   3. **Accounts** — list with net worth
   4. **Insights** — spending breakdown + top categories
   5. **Payee trend** — who the money goes to
   6. **Mortgage / calculators** — loan details with payoff date
   7. **Settings → privacy / backup** — "no server, no account" copy
4. AirDrop to the Mac, e.g. `~/Desktop/shots/`, then:

```
scripts/store-screenshots.sh ~/Desktop/shots
```

Outputs overwrite `docs/release/screenshots/{6.5,6.9}/`. Drag the `6.5` folder's files into the 6.5" slot (or `6.9` into 6.9").

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
| Copyright | `2026 Solomon Xie` |
| Routing App Coverage File | leave blank |
| Build | the uploaded build (step 11) |
| App Review → Sign-In Required | Off |
| App Review → Contact First / Last Name | TODO |
| App Review → Phone | TODO (with country code, e.g. `+1 …`) |
| App Review → Email | TODO |
| App Review → Notes | below |
| App Review → Attachment | none |
| Version Release | **Manually release this version** |

Promotional Text (150/170):

```
Powerful budgeting app, completely free, completely offline native, completely private backup, no account, no subscription, no backend server running.
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

App Review Notes:

```
No account or login is needed — the app opens straight into a working budget.

Optional features a reviewer may want to skip:
- AI analysis (Settings → AI): requires the user's own API key from a provider such as OpenAI or Anthropic. It is off by default and the rest of the app works without it.
- iCloud / S3 backup (Settings → Backup): optional; the app is fully functional with local storage only.

All budget data is stored in a local SQLite database on the device. We operate no server and receive no user data.
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

## Optional: 简体中文 localization

The app ships `zh`. App Store Connect → App Information → language dropdown (top right) → **Add Chinese (Simplified)**, then on the `1.0` page switch to it.

| Field | Value |
|---|---|
| Name | `Budgets Bro` |
| Subtitle | `零基预算，离线也能用` |
| Privacy Policy URL | same |
| Keywords | `预算,记账,零基预算,支出,理财,离线,隐私,房贷,储蓄,账本` |
| Screenshots | reuse English ones (App Store Connect falls back automatically) |

Promotional Text:

```
完全免费、完全离线、备份完全私有的预算应用。无需账号，无订阅，没有任何后端服务器。
```

Description:

```
Budgets Bro 是一款只留在你 iPhone 上的零基预算应用。月初就给每一块钱安排好去处，盯住分类而不是余额，在钱花出去之前就知道它会去哪儿。

无需账号。没有订阅。没有服务器保管你的账本。

预算
• 零基预算——把每一块钱分配到分类，直到“未分配”归零
• 账户、交易、收款方、分类，实时余额
• 标记需要再看一眼的交易
• 多币种：用一种货币记账，用其他货币看合计
• Baby Steps 进度，每一步都写明它的用途
• 从 YNAB 导出文件导入历史记录

洞察
• 按分类、按收款方查看支出——钱究竟流向了谁
• 账户余额与净资产走势
• 你实际持有货币的汇率历史
• 生活成本视图，看清每个月花在了哪里

计算器
• 房贷、提前还款、再融资、购房能力、租房还是买房
• 摊销、车贷、贷款还清、负债收入比
• 复利、投资增长、节税
• 内置加拿大房贷规则

你的数据
• 所有数据存在本机数据库，断网也能完整使用
• 可选备份到你自己的 iCloud 云盘，在“文件”App 中可见
• 可选备份到你自己的 S3 存储桶
• 以普通文件导入导出——随时带走你的数据
• 面容 ID、触控 ID 或密码锁定应用

可选 AI
使用你自己的 OpenAI、Anthropic、Google、Mistral、Groq、DeepSeek 或 xAI 的 API 密钥，就自己的数据提问。密钥属于你，用量显示在服务商后台，默认关闭。完全不用它，应用照样好用。

免费，无内购推销，无广告，无统计分析。
```
