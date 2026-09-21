import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ExperimentalBanner } from '../../components/ui/ExperimentalBanner';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { FinanceToolList } from './FinanceToolList';
import { formatMoney } from '../../domain/money';
import { useAccounts } from '../../hooks/useAccounts';
import { useT } from '../../i18n';

// Tracking and asset accounts — what you've actually got invested — above the
// projection calculators.
export function InvestmentInsightsScreen() {
  const t = useT();
  const { accounts } = useAccounts();
  const holdings = accounts.filter(
    (a) => (a.account.type === 'tracking' || a.account.type === 'asset') && a.account.archivedAt == null,
  );
  const totalCents = holdings.reduce((sum, a) => sum + a.balanceCents, 0);

  return (
    <ScreenContainer scroll>
      <ExperimentalBanner />
      {holdings.length > 0 ? (
        <Card title={t('financeTools.yourInvestments')}>
          <ResultRow label={t('financeTools.totalValue')} value={formatMoney(totalCents)} big />
          {holdings.map((a) => (
            <ResultRow key={a.account.id} label={a.account.name} value={formatMoney(a.balanceCents)} />
          ))}
        </Card>
      ) : null}
      <FinanceToolList hub="invest" />
    </ScreenContainer>
  );
}
