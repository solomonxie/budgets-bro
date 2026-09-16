import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { StubScreen } from '../../components/ui/StubScreen';
import { financeTool } from './registry';
import { useT } from '../../i18n';
import type { InsightsStackParamList } from '../../navigation/types';

// One route for every calculator — the registry decides which screen renders,
// so a new tool never touches the navigator.
export function FinanceToolScreen() {
  const t = useT();
  const route = useRoute<RouteProp<InsightsStackParamList, 'FinanceTool'>>();
  const entry = financeTool(route.params.tool);
  const Screen = entry.Screen;
  return Screen ? <Screen /> : <StubScreen title={t(entry.titleKey)} />;
}
