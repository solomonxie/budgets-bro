import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { useAccounts } from '../../hooks/useAccounts';
import { useAccountValues } from '../../hooks/useAccountValues';
import { useNetWorthTrend } from '../../hooks/useNetWorthTrend';
import { BalanceTrendChart } from './BalanceTrendChart';
import { NetWorthBreakdown } from './NetWorthBreakdown';
import { InfoButton } from '../../components/ui/InfoButton';
import { DraggableList } from '../../components/ui/DraggableList';
import { getDb } from '../../db/client';
import * as accountsRepo from '../../db/repositories/accountsRepo';
import { useAppStore } from '../../state/useAppStore';
import {
  ACCOUNT_KIND_ORDER,
  accountKind,
  countsTowardNetWorth,
  netWorth as computeNetWorth,
} from '../../domain/accountKind';
import type { AccountKind } from '../../domain/types';
import { formatMoney, formatMoneyCompact } from '../../domain/money';
import { formatMonthLabel } from '../../domain/month';
import { localeTag, useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { AccountsStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AccountsStackParamList, 'AccountsList'>;

const KIND_LABEL_KEY: Record<AccountKind, TranslationKey> = {
  Cash: 'accounts.kindCash',
  Savings: 'accounts.kindSavings',
  Credit: 'accounts.kindCredit',
  Loan: 'accounts.kindLoan',
  Tracking: 'accounts.kindTracking',
  Asset: 'accounts.kindAsset',
  Giving: 'accounts.kindGiving',
};

export function AccountsScreen() {
  const { t, language } = useI18n();
  const navigation = useNavigation<Nav>();
  const openAddAccount = useAppStore((s) => s.openAddAccount);
  const { accounts } = useAccounts();
  const { valuesByAccountId: houseValues } = useAccountValues();
  const [excludedAccountIds, setExcludedAccountIds] = useState<Set<number>>(
    new Set(),
  );
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  // The month a finger is on, or was left on. Nothing is explained until
  // one is picked — the chart is read by dragging along it.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const toggleAccountIncluded = (accountId: number) => {
    setExcludedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  // The trend reads the same account list and the same exclusions, so its
  // last point is the number printed above it.
  const trend = useNetWorthTrend(excludedAccountIds);
  const trendPoints = useMemo(
    () =>
      trend.map((p) => ({
        month: p.month,
        balanceCents: p.netWorthCents,
        spendingCents: 0,
      })),
    [trend],
  );

  const netWorth = useMemo(
    () =>
      computeNetWorth(
        accounts
          .filter((a) => !excludedAccountIds.has(a.account.id))
          .map((a) => ({
            type: a.account.type,
            balanceCents: a.balanceCents,
            houseValueCents: houseValues.get(a.account.id),
          })),
      ),
    [accounts, excludedAccountIds, houseValues],
  );

  // Against the month a year back, or the oldest month there is when the
  // board is younger than that.
  const growth = useMemo(() => {
    if (trend.length < 2) return null;
    const base = trend[Math.max(0, trend.length - 13)];
    if (base.netWorthCents === 0) return null;
    return {
      fullYear: trend.length >= 13,
      month: base.month,
      percent:
        ((netWorth.netWorthCents - base.netWorthCents) /
          Math.abs(base.netWorthCents)) *
        100,
    };
  }, [trend, netWorth.netWorthCents]);

  const reorder = async (orderedIds: number[]) => {
    await accountsRepo.reorderAccounts(await getDb(), orderedIds);
    bumpDataVersion();
  };

  const selectedPoint =
    selectedIndex != null ? (trend[selectedIndex] ?? null) : null;

  const groups = useMemo(() => {
    return ACCOUNT_KIND_ORDER.map((kind) => {
      const list = accounts
        .filter((a) => accountKind(a.account.type) === kind)
        .map((a) => ({
          account: a.account,
          displayCents: a.balanceCents,
        }));
      return {
        kind,
        accounts: list,
        subtotalCents: list.reduce((s, a) => s + a.displayCents, 0),
      };
    }).filter((g) => g.accounts.length > 0);
  }, [accounts]);

  return (
    <ScreenContainer scroll scrollEnabled={scrollEnabled}>
      <View style={styles.netWorthCard}>
        <View style={styles.netWorthHeader}>
          <View style={styles.netWorthTitleRow}>
            <Text style={styles.netWorthLabel}>{t('accounts.netWorth')}</Text>
            {/* The number is a dozen derivations summed — the ⓘ is where
                they're spelled out, rather than on the card all the time. */}
            <InfoButton
              title={t('netWorthInfo.title')}
              paragraphs={[
                t('netWorthInfo.recomputed'),
                t('netWorthInfo.assets'),
                t('netWorthInfo.debts'),
                t('netWorthInfo.history'),
                t('netWorthInfo.excluded'),
              ]}
              closeLabel={t('common.done')}
            />
          </View>
          <Pressable onPress={() => setAccountPickerOpen(true)}>
            <Text style={styles.customizeLink}>{t('accounts.customize')}</Text>
          </Pressable>
        </View>
        <Text
          style={[
            styles.netWorthValue,
            netWorth.netWorthCents < 0 && styles.negative,
          ]}
        >
          {formatMoney(netWorth.netWorthCents)}
        </Text>
        <View style={styles.netWorthBreakdown}>
          <Text style={styles.netWorthPart}>
            {t('accounts.assets', {
              amount: formatMoneyCompact(netWorth.assetsCents),
            })}
          </Text>
          <Text style={styles.netWorthPart}>
            {t('accounts.debts', {
              amount: formatMoneyCompact(netWorth.debtsCents),
            })}
          </Text>
          {growth ? (
            <Text
              style={[
                styles.netWorthPart,
                growth.percent < 0 ? styles.negative : styles.positive,
              ]}
            >
              {growth.fullYear
                ? t('accounts.growth12m', { rate: formatRate(growth.percent) })
                : t('accounts.growthSince', {
                    rate: formatRate(growth.percent),
                    month: formatMonthLabel(growth.month, localeTag(language)),
                  })}
            </Text>
          ) : null}
        </View>
        {/* Needs two points to be a line — a board opened today is just the
            number above. */}
        {trendPoints.length > 1 ? (
          <BalanceTrendChart
            points={trendPoints}
            valueLabel={t('accounts.netWorth')}
            showAverage
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
          />
        ) : null}
        {/* The line is a dozen derivations summed; when a month reads wrong,
            the only useful question is which account made it that way. */}
        {trendPoints.length > 1 ? (
          <Pressable
            onPress={() => setSelectedIndex(null)}
            disabled={selectedPoint == null}
            hitSlop={6}
          >
            <Text style={styles.breakdownLink}>
              {selectedPoint != null
                ? t('common.hide')
                : t('netWorthBreakdown.explain')}
            </Text>
          </Pressable>
        ) : null}
        {selectedPoint != null ? (
          <NetWorthBreakdown
            point={selectedPoint}
            accounts={accounts.map((a) => a.account)}
          />
        ) : null}
      </View>

      <Modal
        visible={accountPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountPickerOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setAccountPickerOpen(false)}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>
              {t('accounts.includeInNetWorth')}
            </Text>
            <ScrollView>
              {/* A giving account is shown but not offered: money set
                  aside to give is never part of net worth, and hiding the
                  account here would read as the app having lost it. */}
              {accounts.map(({ account }) => {
                const eligible = countsTowardNetWorth(account.type);
                const included =
                  eligible && !excludedAccountIds.has(account.id);
                return (
                  <Pressable
                    key={account.id}
                    style={styles.accountRow}
                    disabled={!eligible}
                    onPress={() => toggleAccountIncluded(account.id)}
                  >
                    <View style={styles.rowMain}>
                      <Text
                        style={[
                          styles.accountRowText,
                          !eligible && styles.accountRowTextDisabled,
                        ]}
                      >
                        {account.name}
                      </Text>
                      {!eligible ? (
                        <Text style={styles.accountRowNote}>
                          {t('accounts.notInNetWorth')}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        included && styles.checkboxChecked,
                        !eligible && styles.checkboxDisabled,
                      ]}
                    >
                      {included ? (
                        <Text style={styles.checkboxMark}>✓</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              style={styles.doneButton}
              onPress={() => setAccountPickerOpen(false)}
            >
              <Text style={styles.doneButtonText}>{t('common.done')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {groups.map((group) => (
        <View key={group.kind} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupLabel}>
              {t(KIND_LABEL_KEY[group.kind])}
            </Text>
            <Text style={styles.groupSub}>
              {formatMoney(group.subtotalCents)}
            </Text>
          </View>
          <DraggableList
            items={group.accounts}
            keyOf={(a) => a.account.id}
            gap={spacing.xs}
            onDragChange={(dragging) => setScrollEnabled(!dragging)}
            onPress={({ account }) =>
              navigation.navigate('AccountDetail', { accountId: account.id })
            }
            onReorder={(list) => reorder(list.map((a) => a.account.id))}
            renderItem={({ account, displayCents }, pressed) => (
              <View style={[styles.row, pressed && styles.rowPressed]}>
                <Text
                  style={styles.rowTitle}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {account.name}
                </Text>
                <Text
                  style={[styles.rowValue, displayCents < 0 && styles.negative]}
                >
                  {formatMoney(displayCents)}
                </Text>
              </View>
            )}
          />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={openAddAccount}>
        <Text style={styles.addButtonText}>{t('accounts.addAccount')}</Text>
      </Pressable>
      <Pressable
        style={styles.closedLink}
        onPress={() => navigation.navigate('ClosedAccounts')}
      >
        <Text style={styles.closedLinkText}>
          {t('accounts.closedAccounts')}
        </Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  breakdownLink: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  netWorthCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  netWorthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netWorthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  netWorthLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  customizeLink: { fontSize: 12, fontWeight: '700', color: colors.accent },
  netWorthValue: { fontSize: 28, fontWeight: '700', color: colors.text },
  netWorthBreakdown: { flexDirection: 'row', gap: spacing.md },
  netWorthPart: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '75%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: { flex: 1 },
  accountRowTextDisabled: { color: colors.textMuted },
  accountRowNote: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  checkboxDisabled: { opacity: 0.4 },
  accountRowText: { fontSize: 15, color: colors.text },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  doneButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  doneButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  group: { gap: spacing.xs, marginTop: spacing.sm },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  groupSub: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
  },
  rowPressed: { opacity: 0.6 },
  rowTitle: {
    flex: 1,
    marginRight: spacing.sm,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  negative: { color: colors.negative },
  positive: { color: colors.positive },
  addButton: { alignItems: 'center', paddingVertical: spacing.sm },
  addButtonText: { color: colors.accent, fontWeight: '700' },
  closedLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: 80,
  },
  closedLinkText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
});

function formatRate(percent: number): string {
  return `${percent >= 0 ? '+' : '−'}${Math.abs(percent).toFixed(1)}%`;
}
