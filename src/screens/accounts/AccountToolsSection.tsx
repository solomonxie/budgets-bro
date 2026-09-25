import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { financeTool } from '../finance-tools/registry';
import type { FinanceToolId } from '../finance-tools/registry';
import type { AccountType } from '../../domain/types';
import { useT } from '../../i18n';
import type { AccountsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<AccountsStackParamList>;

// The Insights calculators that are about this kind of account, a tap away
// from the account itself.
const TOOLS_BY_TYPE: Partial<Record<AccountType, FinanceToolId[]>> = {
  mortgage: [
    'mortgagePayoff',
    'refinance',
    'chinaPrepayment',
    'amortization',
    'mortgage',
  ],
  loan: ['loanPayoff', 'amortization', 'autoLoan', 'debtToIncome'],
  credit_card: ['loanPayoff', 'debtToIncome'],
  savings: ['compoundInterest'],
  cash: ['compoundInterest'],
  tracking: ['investment', 'compoundInterest', 'taxSavings'],
};

export function accountTools(type: AccountType): FinanceToolId[] {
  return TOOLS_BY_TYPE[type] ?? [];
}

// Folded by default: most visits are to read the balance, not to run a
// what-if.
export function AccountToolsSection({ type }: { type: AccountType }) {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const [expanded, setExpanded] = useState(false);
  const tools = accountTools(type);
  if (tools.length === 0) return null;

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.label}>{t('accountDetail.calculators')}</Text>
        <Text style={styles.chevron}>{expanded ? '▾' : '›'}</Text>
      </Pressable>
      {expanded
        ? tools.map((id) => {
            const tool = financeTool(id);
            return (
              <Pressable
                key={id}
                style={styles.row}
                onPress={() => navigation.navigate('FinanceTool', { tool: id })}
              >
                <View style={styles.rowText}>
                  <Text style={styles.title}>{t(tool.titleKey)}</Text>
                  <Text style={styles.subtitle}>{t(tool.subtitleKey)}</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  chevron: { fontSize: 14, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowText: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  arrow: { fontSize: 18, color: colors.textMuted },
});
