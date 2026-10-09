# TestFlight external testing

App Store Connect → TestFlight → External Testing → **+** group → add the build. First build of a version goes through Beta App Review (~1 day).

## Test Information

Beta App Description (≤4000):

```
Budgets Bro is a budgeting app that doesn't stop at the budget. It lists your recurring bills each quarter to keep or cancel, shows which things you buy are getting more expensive, and tells you how many months your cash would last without income. Everything stays on your iPhone: no account, no server, no bank connection.

To look around without your own numbers, tap "Try with sample data" on first launch. Settings (top-left icon) → Demo Mode turns it off again.

Worth trying first:
• Quarterly Review (Insights) — recurring payments found from your spending, each decided once a quarter; decisions become to-dos
• Tracked Prices (Insights) — what you buy, how often, and whether it's getting dearer
• Runway (bottom of Insights) — months your cash lasts without income
• Loan health (Accounts → a loan) — debt against take-home pay, with a mortgage stress test
• Payee and Income Trends, House Hunting, Cost of Living (Insights)
• History (Settings) — every change recorded, a whole import undone in one tap

Also in this beta: zero-based budgeting, multi-currency, 13+ calculators, iCloud Drive / S3 backup, CSV export, Face ID lock, English and Simplified Chinese, optional AI with your own API key.

Your data never leaves your phone unless you turn on a backup or an AI connection yourself.
```

Feedback Email: `you@example.com`

## Contact Information

| Field | Value |
|---|---|
| First Name | TODO |
| Last Name | TODO |
| Phone number | TODO — yours, with country code (`+1 …`) |
| Email | `you@example.com` |

## Sign-In Information

Sign-in required: **off** (no account in the app). Leave User Name / Password blank.

## Per build: What to Test

```
New: "Try with sample data" on first launch. Please try: Insights → Quarterly Review (decide one bill), Tracked Prices, the Runway card, a loan account's Health section, then add a spend with an item on the Spend tab. Report anything slow, confusing or broken with a screenshot via TestFlight.
```
