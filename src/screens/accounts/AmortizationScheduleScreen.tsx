import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { AmortizationCalculator } from '../../components/ui/AmortizationCalculator';
import { useAccounts } from '../../hooks/useAccounts';
import { useAccountRateHistory } from '../../hooks/useAccountRateHistory';
import { monthlyPaymentCents } from '../../finance-tools/amortization';
import type { AccountsStackParamList } from '../../navigation/types';

type Route = RouteProp<AccountsStackParamList, 'AmortizationSchedule'>;

// Full mortgage/loan calculator reached from a real account's Loan
// Details card: prefills from the account's *current* outstanding balance
// and rate (not its original terms), but the payment itself stays pinned
// to the loan's actual contractual amount (see AmortizationCalculator's
// `fixedPaymentCents`) — editing the balance/rate/term fields previews a
// different scenario without ever pretending the real loan repriced.
export function AmortizationScheduleScreen() {
  const route = useRoute<Route>();
  const { accountId } = route.params;
  const { accounts } = useAccounts();
  const { currentRateBps } = useAccountRateHistory(accountId);
  const account = accounts.find((a) => a.account.id === accountId);
  const outstandingCents = Math.max(0, -(account?.balanceCents ?? 0));
  const scheduledTermMonths = account?.account.termMonths ?? null;
  const scheduledPrincipalCents = account?.account.originalPrincipalCents ?? null;
  const scheduledPaymentCents =
    scheduledPrincipalCents != null && scheduledTermMonths != null && currentRateBps != null
      ? monthlyPaymentCents(scheduledPrincipalCents, currentRateBps, scheduledTermMonths)
      : null;

  return (
    <ScreenContainer>
      <AmortizationCalculator
        initialPrincipalCents={outstandingCents}
        initialRateBps={currentRateBps}
        initialTermMonths={scheduledTermMonths ?? 360}
        fixedPaymentCents={scheduledPaymentCents}
      />
    </ScreenContainer>
  );
}
