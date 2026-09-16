import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { FinanceToolList } from './FinanceToolList';
import { addMonths, monthlyPaymentCents, remainingMonthsToPayoff } from '../../finance-tools/amortization';
import { currentDateISO } from '../../domain/month';
import { formatMoney, formatPercent } from '../../domain/money';
import { useAccounts } from '../../hooks/useAccounts';
import { useAccountValues } from '../../hooks/useAccountValues';
import { useCurrentRates } from '../../hooks/useCurrentRates';
import { useT } from '../../i18n';
import type { AccountWithBalance } from '../../db/repositories/accountsRepo';

// Your real mortgages first, the what-if calculators under them. The summary
// card is skipped entirely when there's no mortgage on the board — an empty
// "you have no mortgage" card is noise on a page that's still useful.
export function MortgageInsightsScreen() {
  const { accounts } = useAccounts();
  const { ratesByAccountId } = useCurrentRates();
  const { valuesByAccountId } = useAccountValues();
  const mortgages = accounts.filter((a) => a.account.type === 'mortgage' && a.account.archivedAt == null);

  return (
    <ScreenContainer scroll>
      {mortgages.map((m) => (
        <MortgageSummary
          key={m.account.id}
          entry={m}
          rateBps={ratesByAccountId.get(m.account.id) ?? null}
          houseValueCents={valuesByAccountId.get(m.account.id) ?? m.account.originalHousePriceCents}
        />
      ))}
      <FinanceToolList hub="mortgage" />
    </ScreenContainer>
  );
}

function MortgageSummary({
  entry,
  rateBps,
  houseValueCents,
}: {
  entry: AccountWithBalance;
  rateBps: number | null;
  houseValueCents: number | null;
}) {
  const t = useT();
  const { account, balanceCents } = entry;
  const owedCents = Math.max(0, -balanceCents);

  // Same projection the account's own Loan Details card makes: scheduled
  // payment from the original terms, run against today's actual balance.
  const canProject = rateBps != null && account.termMonths != null && account.originalPrincipalCents != null;
  const paymentCents = canProject ? monthlyPaymentCents(account.originalPrincipalCents!, rateBps!, account.termMonths!) : null;
  const months = paymentCents != null ? remainingMonthsToPayoff(owedCents, rateBps!, paymentCents) : Infinity;
  const payoffDate = Number.isFinite(months) ? addMonths(currentDateISO(), months) : null;

  return (
    <Card title={account.name}>
      <ResultRow label={t('financeTools.balance')} value={formatMoney(owedCents)} big />
      {rateBps != null ? <ResultRow label={t('financeTools.rate')} value={formatPercent(rateBps)} /> : null}
      {payoffDate ? (
        <ResultRow label={t('financeTools.payoff')} value={t('loanDetailsCard.payoffValue', { date: payoffDate, months })} />
      ) : null}
      {houseValueCents != null ? (
        <ResultRow
          label={t('financeTools.equity')}
          value={formatMoney(houseValueCents - owedCents)}
          tone={houseValueCents - owedCents >= 0 ? 'positive' : 'negative'}
        />
      ) : null}
    </Card>
  );
}
