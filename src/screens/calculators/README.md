# Calculators

```
CalculatorsHomeScreen.tsx
— thin wrapper around ../../components/ui/AmortizationCalculator.tsx (inputs,
result summary, extra-payment payoff, full schedule table), just with default
starting numbers and no account behind them (`fixedPaymentCents` omitted, so
the payment is always derived fresh from whatever's typed in).
```

Same shared component `accounts/AmortizationScheduleScreen.tsx` uses — this is the ad-hoc "what if" case, that one prefills from and pins to a real account's actual loan.
