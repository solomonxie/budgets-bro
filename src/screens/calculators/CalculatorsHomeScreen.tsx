import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { AmortizationCalculator } from '../../components/ui/AmortizationCalculator';

// Ad-hoc mortgage/loan calculator — same math and schedule table as a real
// account's Loan Details card (AmortizationScheduleScreen), just with no
// account behind the numbers (fixedPaymentCents omitted, so the payment
// is always derived fresh from whatever's typed into the three fields).
export function CalculatorsHomeScreen() {
  return (
    <ScreenContainer>
      <AmortizationCalculator initialPrincipalCents={30_000_000} initialRateBps={650} initialTermMonths={360} />
    </ScreenContainer>
  );
}
