import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { financeToolsFor } from './registry';
import type { FinanceToolHub } from './registry';
import { useT } from '../../i18n';
import type { InsightsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<InsightsStackParamList>;

// The tool rows on every hub — same chevron list as Insights' own utilities
// card, driven off the registry so a hub never hand-maintains its contents.
export function FinanceToolList({ hub }: { hub: FinanceToolHub }) {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const tools = financeToolsFor(hub);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionLabel}>{t('financeTools.tools')}</Text>
      <View style={styles.card}>
        {tools.map((tool, i) => (
          <Pressable
            key={tool.id}
            style={[styles.row, i < tools.length - 1 && styles.rowDivider]}
            onPress={() => navigation.navigate('FinanceTool', { tool: tool.id })}
          >
            <View style={styles.rowText}>
              <Text style={styles.title}>{t(tool.titleKey)}</Text>
              <Text style={styles.subtitle}>{t(tool.subtitleKey)}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Last content on every page it appears on — clears the tab bar.
  wrapper: { gap: spacing.sm, marginBottom: 80 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  arrow: { fontSize: 18, color: colors.textMuted },
});
