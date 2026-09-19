import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Card } from '../../components/ui/Card';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ExpandingFieldGroup } from './../../components/ui/ExpandingField';

// Shared frame for every calculator: inputs, then results, then whatever
// table the tool has. The tail spacer clears the tab bar, which these screens
// are pushed inside.
export function CalcScreen({ children }: { children: ReactNode }) {
  return (
    <ScreenContainer scroll>
      {/* Every calculator's pickers unfold in the row's own space, same as
          the spend form — see components/ui/ExpandingField. */}
      <ExpandingFieldGroup>{children}</ExpandingFieldGroup>
      <View style={styles.tail} />
    </ScreenContainer>
  );
}

// Results only mean something once the inputs that drive them are in, so the
// results card is replaced by a one-line prompt rather than rendering zeros —
// a screen of $0.00 reads as a broken calculator, not an empty one.
export function ResultsCard({
  ready,
  children,
}: {
  ready: boolean;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <Card title={t('financeTools.results')}>
      {ready ? (
        children
      ) : (
        <Text style={styles.empty}>{t('financeTools.enterInputs')}</Text>
      )}
    </Card>
  );
}

// One assumption stated under a result, for the figures a calculator has to
// invent (28/36 DTI, 1.5%/yr upkeep) rather than ask for.
export function AssumptionNote({ text }: { text: string }) {
  return <Text style={styles.note}>{text}</Text>;
}

const styles = StyleSheet.create({
  tail: { height: spacing.xl * 2 },
  empty: { fontSize: 13, color: colors.textMuted },
  note: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
