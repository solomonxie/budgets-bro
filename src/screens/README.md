# Screens

One folder per tab or feature area. Each screen reads and writes through `../db/repositories` — never raw SQL directly.

- `accounts/` — account list, detail, loan/house-value cards
- `budget/` — the envelope-budgeting month view
- `transactions/` — transaction history and the add/edit sheet
- `insights/` — spending charts and Baby Steps tracker
- `tax/` — Tax Insights (year-to-date, non-authoritative estimate)
- `calculators/` — ad-hoc mortgage/loan calculators
- `settings/` — app settings, backup config, board management
- `ai/` — AI analysis (bring your own API key)
