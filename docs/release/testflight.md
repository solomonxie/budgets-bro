# TestFlight external testing

App Store Connect → TestFlight → External Testing → **+** group → add the build. First build of a version goes through Beta App Review (~1 day).

## Test Information

Beta App Description (≤4000):

```
Budgets Bro is zero-based budgeting that stays on your iPhone: give every dollar a job before the month starts, record spending as it happens, and see what's left in each category. No account, no server, no bank connection — everything lives in a local database on the device.

To look around without entering your own numbers: Settings (top-left icon) → Demo Mode. It fills every screen with a sample household, kept apart from your data; turn it off to go back.

What's in this beta:
• Budget, Spend, Accounts and Insights tabs
• Multi-currency accounts and totals
• Mortgage, loan, investment and tax calculators
• Backup to your own iCloud Drive or S3 bucket, export/import as plain files
• Face ID / passcode app lock
• English and Simplified Chinese
• Optional AI analysis with your own API key (off by default)

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
Everything is local, so start fresh or turn on Settings → Demo Mode for sample data. Please try: adding spending on the Spend tab, assigning money on the Budget tab, an iCloud Drive backup and restore (Settings → Data), and switching language to Chinese. Report anything slow, confusing or broken with a screenshot via TestFlight.
```
