# Accounts

`src/screens/accounts/AccountsScreen.tsx`

```
 ⚙︎    Accounts
 ┌──────────────────────────────────────────────────┐
 │ NET WORTH                            ( Customize )│
 │ $184,210.55                                      │
 │ Assets $312,400.00      Debts $128,189.45        │
 └──────────────────────────────────────────────────┘
 Cash                                        $1,204.10
 Wallet                                        $204.10
 Checking                                    $1,000.00
 Savings                                    $18,000.00
 Emergency fund                             $18,000.00
 Credit                                      −$820.45   ← red when negative
 Visa                                         −$820.45
 Loan                                     −$127,369.00
 Mortgage                                 −$127,369.00
 Asset                                     $295,000.00
 House                                     $295,000.00
 Tracking                                    $2,196.00
 401(k)                                      $2,196.00
                   ( + Add Account )
                 ( Set Up My Accounts )   ← hero card instead when empty
                   ( Closed Accounts )
```

## Set up accounts  `setup/AccountSetupScreen.tsx`

Full-screen modal from the Accounts page: a hero card when the board has no
accounts (replaces the $0 net worth card), a "Set Up My Accounts" link
otherwise. One question per step; single choice advances on tap.

```
 ✕  ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░  2/8
 What's your home situation?
 A mortgage is an account. Rent is just a budget category.
 ╭────────────────────────────────────╮
 │ (🔑)  I rent                        │   tap → next step
 ╰────────────────────────────────────╯
 │ (🏡)  I own, with a mortgage      ✓ │
 ( ‹ Back )                 [[ Next ]]     multi steps: "None of These" until one ticked
```

Steps: country · home · day-to-day · credit cards · saving & investing
(per country: 401(k)/RRSP/ISA/公积金…) · loans · anything else (abroad, car,
giving) · review.

```
 Here's your list
 CASH
 │ (✓) Chequing▌      Balance today ± [ 1,240.00 ] │  name editable; ± on cash/savings/card
 │ (✓) Amex           Already have one with this name │  rename clash → red, Add disabled
 LOAN
 │ (✓) Mortgage       Owed today     [          ] │
 │                    Home worth today [        ] │
 Already on your list: Wallet
 ( ‹ Back )               [[ Add 6 Accounts ]]
```

Amounts optional: cash/savings → Balance Adjustment transaction; card →
negative one; loan → principal reading; tracking/asset/home → value reading
(`domain/accountSetup.openingEntries`). All in one DB transaction. Mortgaged
property → one mortgage account. Bank abroad → Savings (off-budget).
Default country from device region. ✕ after step 1 asks before discarding.
Save failure → alert, nothing written.

## Account detail  `AccountDetailScreen.tsx`

One screen, everything inline — no separate cards page.

```
 ‹                                             Edit
 ┌ BALANCE ─────────────────────────────────── ▾ ───┐
 │ $1,000.00                                        │
 │ (credit) Deposited $4,200.00                     │
 │ (asset)  Home Value  $295,000.00            ›    │
 │   › expands: value trend charted year by year    │
 │     (a home is re-valued rarely, not monthly),   │
 │     entry list, + Update Home Value              │
 └──────────────────────────────────────────────────┘
 trend chart, open on arrival (▾ folds it):
 ┌──────────────────────────────────────────────────┐
 │      ╱‾‾╲       balance trend (cash/savings/     │
 │  ╱‾‾╯    ╲___   credit — credit overlays monthly │
 │ ▁▁▂▂▃▃▂▂▁▁▁▁▁   spend; a paid-off card reads flat)│
 └──────────────────────────────────────────────────┘
 ┌ LOAN DETAILS ─────────────── 5.75% · $2,918/mo ›─┐
 │ Rate · Scheduled payment · Projected payoff ·    │
 │ Est. remaining interest — read-only, no inputs.  │
 │ Projected off the scheduled payment and the      │
 │ balance real transactions add up to; what-if     │
 │ extra payments live in the payoff calculators.   │
 └──────────────────────────────────────────────────┘
 ┌ SCHEDULED (2) ───────────────────────────── ▾ ───┐
 │ Dated in the future — doesn't affect balance or  │
 │ budget until its date arrives.                   │
 │ Rent            Next: Oct 1, 2026    −$1,800.00  │
 │   ( Approve )   ( Cancel Schedule )              │
 └──────────────────────────────────────────────────┘
 Sep 17, 2026
 Whole Foods                   🛒 Groceries  −$42.50
 empty   No transactions yet.
```

## Account modal  `AccountModal.tsx`

```
 ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
 New Account                              ( Cancel )
 Name          e.g. Wallet
 Type          [ CASH | Savings | Credit Card | Loan |
                 Mortgage | Tracking | Asset ]
 Starting Balance  $0.00
   hint  Balance the day this account starts here; debts negative.
   loan/mortgage: labelled "Balance When Tracking Started" and
   auto-filled as −(Mortgage Amount) until hand-edited — a new loan's
   two numbers are the same one, but someone adding a part-paid loan
   owes less now than they borrowed.
 Current Balance   $0.00      edit-only, not asset/tracking
   hint  A different number posts one balance adjustment.
 ┌ INTEREST RATE ───────────────────────────────────┐
 │ Interest Rate (annual %)   e.g. 6.25 (optional)  │
 │ Interest Rate History        ( + Add Rate Change )│
 │ No rate recorded yet.                            │
 └──────────────────────────────────────────────────┘
 ┌ LOAN TERMS ──────────────────────────────────────┐  loan/mortgage only
 │ Term (months)   e.g. 360                         │
 │   360 = 30 years, 240 = 20 years.                │
 │ Purchase Price   0.00 (optional)   mortgage only │
 │ Mortgage Amount ("Amount Borrowed" for a loan)   │
 │   What you borrowed at signing, not what's left. │
 │ ┌ Down Payment ──────────────┐     mortgage only │
 │ │ $60,000.00 (20.0% down)    │  auto-computed    │
 │ │ ⊗ Mortgage amount exceeds the purchase price   │
 │ └────────────────────────────┘                   │
 │ Origination Date                              ▾  │
 └──────────────────────────────────────────────────┘
 ┌ PAY RATE HISTORY ────────────────────────────────┐  income only
 │ No pay rate history recorded.  ( + Add Entry )   │
 └──────────────────────────────────────────────────┘
 ┌ TOOLS ───────────────────────────────────────────┐
 [[ Save ]]
 [ Close Account ]   ⇒ Close "Visa"? (keeps history, hides the row)
 [ Reopen Account ]  ← in the closed-accounts screen
```
