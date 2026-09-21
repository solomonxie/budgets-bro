import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ExperimentalBanner } from '../../components/ui/ExperimentalBanner';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { FinanceToolList } from './FinanceToolList';
import { formatMoney, formatPercent } from '../../domain/money';
import { useAccounts } from '../../hooks/useAccounts';
import { useCurrentRates } from '../../hooks/useCurrentRates';
import { useT } from '../../i18n';

// Everything you owe that isn't the house — cards, student and personal
// loans, car loans. The mortgage has its own hub because its questions
// (equity, affordability, prepayment) are different ones.
export function LoanInsightsScreen() {
  const t = useT();
  const { accounts } = useAccounts();
  const { ratesByAccountId } = useCurrentRates();
  const debts = accounts.filter(
    (a) => (a.account.type === 'loan' || a.account.type === 'credit_card') && a.account.archivedAt == null && a.balanceCents < 0,
  );
  const totalOwedCents = debts.reduce((sum, a) => sum - a.balanceCents, 0);

  return (
    <ScreenContainer scroll>
      <ExperimentalBanner />
      {debts.length > 0 ? (
        <Card title={t('financeTools.yourDebts')}>
          <ResultRow label={t('financeTools.totalOwed')} value={formatMoney(totalOwedCents)} big tone="negative" />
          {debts.map((a) => {
            const rateBps = ratesByAccountId.get(a.account.id);
            return (
              <ResultRow
                key={a.account.id}
                label={a.account.name}
                value={formatMoney(-a.balanceCents)}
                hint={rateBps != null ? formatPercent(rateBps) : undefined}
              />
            );
          })}
        </Card>
      ) : null}
      <FinanceToolList hub="loan" />
    </ScreenContainer>
  );
}
