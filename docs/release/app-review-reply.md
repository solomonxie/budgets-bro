# Reply to App Review — 4.3 Spam / 4.2.6 (rejection of 2026-10-05)

Paste under **App Review → Oct 3 submission → Reply to App Review**.

---

Hello, thank you for the review. Answers to each question:

**1. What the app does and the problem it solves**
Budgets Bro is a zero-based budget that stays entirely on the iPhone: every dollar of income is assigned to a category before it is spent, and each spend is recorded against that category. The problem it targets is the step after budgeting, which most budget apps leave to the user: deciding which recurring costs to keep. It finds recurring payments in the user's own spending history and asks them to keep or cancel each one once a quarter (Quarterly Review), turning decisions into to-dos. It tracks the price of things the user buys repeatedly and shows which are getting more expensive (Tracked Prices), and calculates how many months their cash would last without income (Runway). Loans get a health check against take-home pay, including a mortgage stress test. Every change is recorded in a History log, and a whole CSV import can be undone in one step.

**2. Intended user**
Individuals and households who budget manually and do not want to give a company their bank login or financial data: people who already use or have tried envelope budgeting, paying down debt, or saving for a home, and who want the planning tools of a subscription budgeting service without an account, a server, or a bank connection. It is localized in English and Simplified Chinese, with calculators for Canadian and Chinese mortgage rules.

**3. Gap it fills**
Established zero-based budgeting apps require an account, a subscription, and usually a bank connection, and they stop at the budget itself. Budgets Bro is different in two ways: (a) everything is local — no account, no server, no analytics, data never leaves the device unless the user turns on their own iCloud Drive or S3 backup; (b) it adds decision tools that do not exist in those apps: the quarterly keep-or-cancel review of detected recurring payments, per-item price tracking, cash runway, and loan health against income.

**4. Beta testing**
So far, testing has been my own daily use with my real household budget on my iPhone since early September 2026, across 360+ revisions; examples of changes made in that time are a faster spend entry form (a Next button that steps through payee then category), past budget months closing at zero with leftovers carried into the current month, and a guided account setup on first launch. I have now opened an external TestFlight group with a public link (build 202610161743) to collect feedback from other users, and will apply it before the next build.

**5. Standalone or suite**
Standalone. The other apps on this developer account are in unrelated categories (podcasts, photos, anatomy, world clock, workout tracking, etc.) and share no features or data with Budgets Bro.

**6. Could it be an in-app purchase in another app?**
No. None of the other apps on the account deal with personal finance; budgeting would not fit into any of them.

**7. Shared code or assets with other apps on the account**
No shared in-house framework, code, or assets. Budgets Bro has its own codebase, including its own small native modules (file storage, iCloud Drive backup, storefront detection).

**8. Shared codebase/SDK with third-party apps**
No template or app generation service. Only standard open-source frameworks: React Native, React Navigation, op-sqlite (SQLite), react-native-svg, react-native-keychain, zustand, jszip. All budgeting, insights, and calculator logic is original.

**9. Created for a client?**
No. It is my own concept and product, built and published by me under my own account; no third party provided content, concept, or branding.

Thank you,
Solomon Xie
