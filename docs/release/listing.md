# App Store Connect fields

Drafts below are ready to paste. `TODO` = only you can supply it.

## App information

| Field | Value |
|---|---|
| Name (30 chars) | `Budgets Bro` |
| Subtitle (30) | `Envelope budgeting, offline` |
| Bundle ID | `com.solomonxie.budgetsbro` |
| SKU | `budgetsbro-ios` |
| Primary language | English (U.S.) |
| Primary category | Finance |
| Secondary category | Productivity |
| Content rights | Does not contain third-party content |
| Age rating | 4+ — no objectionable content; answer "None" to everything. The AI chat is user-configured and not user-generated content |
| Copyright | `2026 Solomon Xie` |
| Price | Free, all territories |

## URLs

| Field | Value |
|---|---|
| Privacy policy URL | TODO — host `privacy-policy.md` (GitHub Pages works) |
| Support URL | TODO — repo issues page or a simple contact page (required) |
| Marketing URL | optional |

## Promotional text (170 chars, editable without review)

```
Your money, your phone. Envelope budgeting with no account, no subscription, and no server — plus mortgage, interest, and payoff calculators built in.
```

## Description (4000 chars)

```
Budgets Bro is envelope budgeting that stays on your iPhone. Give every dollar a job, watch the categories rather than the balance, and know before the month starts where the money is going.

No account. No subscription. No server holding your ledger.

BUDGETING
• Zero-based, envelope-style budgeting — assign every dollar until nothing is left over
• Accounts, transactions, payees, and categories, with running balances
• Flagged transactions for anything that needs a second look
• Multi-currency: type in one currency, read the totals in the rest
• Baby-steps progress, each step saying what it is for

INSIGHTS
• Spending by category and by payee — who the money actually goes to
• Account balance trends over time
• Exchange-rate history for the currencies you actually hold

CALCULATORS
• Mortgage repayments, amortisation, and extra-payment scenarios
• Compound interest and loan payoff
• Cost-of-living comparison between cities

YOUR DATA
• Everything lives in a local database on the device
• Optional backup to your own iCloud Drive folder, visible in the Files app
• Optional backup to your own S3 bucket
• Import and export as plain files — you can walk away with your data at any time
• Face ID, Touch ID, or a passcode locks the app

OPTIONAL AI
Bring your own API key from OpenAI, Anthropic, Google, Mistral, Groq, DeepSeek, or xAI and ask questions about your own numbers. The key is yours, usage shows up in your provider's dashboard, and the feature is off until you turn it on. Skip it entirely and the app works the same.

Free, with no upsell, no ads, and no analytics.
```

## Keywords (100 chars, comma-separated, no spaces)

```
budget,envelope,zero-based,expense,money,finance,tracker,offline,privacy,mortgage,savings,ledger
```

## What's New (first release)

```
First release.
```

## App Privacy questionnaire

The app collects nothing. Answer:

- **Do you or your third-party partners collect data from this app?** → **No**

That single answer is correct as long as there is no analytics SDK, no crash reporting, and no server of yours — verified clean on 2026-09-22; re-check before each submission:

```
grep -rniE "analytics|firebase|sentry|amplitude|mixpanel|posthog|bugsnag" package.json ios/Podfile.lock
```

If it ever changes, the truthful mapping is: financial info and user content leave the device *only* to destinations the user configures themselves (their iCloud, their S3 bucket, their AI provider) — Apple still counts that as not collected by you, since you never receive it.

Related declarations:
- **Export compliance**: uses only HTTPS and Apple's Keychain → exempt. Set `ITSAppUsesNonExemptEncryption = false` in `Info.plist`.
- **Account required to use the app?** No. (Avoids guideline 5.1.1 sign-in questions.)
- **Third-party content / user-generated content?** No.

## App Review notes (draft)

```
No account or login is needed — the app opens straight into a working budget.

Optional features a reviewer may want to skip:
- AI analysis (Settings → AI): requires the user's own API key from a provider such as OpenAI or Anthropic. It is off by default and the rest of the app works without it. A test key can be supplied on request.
- iCloud / S3 backup (Settings → Backup): optional; the app is fully functional with local storage only.

All budget data is stored in a local SQLite database on the device. We operate no server and receive no user data.
```

Demo account: not applicable (no login).
Contact: TODO — name, phone, email for review contact.
