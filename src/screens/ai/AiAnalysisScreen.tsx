import { StubScreen } from '../../components/ui/StubScreen';
import { useT } from '../../i18n';

export function AiAnalysisScreen() {
  const t = useT();
  return <StubScreen title={t('aiAnalysis.title')} />;
}
