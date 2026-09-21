import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { GuideSection } from '../../components/ui/GuideSection';
import { PurchaseItemTrendChart } from './PurchaseItemTrendChart';
import { usePurchaseInsights } from '../../hooks/usePurchaseInsights';
import {
  purchaseItemHistory,
  purchaseItemTrend,
} from '../../domain/purchaseInsights';
import { formatMoneyExact } from '../../domain/money';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { RootStackParamList } from '../../navigation/types';

type RootNav = NativeStackNavigationProp<RootStackParamList>;

// Everything the ledger has been told it bought, by name. Ranked by how
// often, because that is what makes a price worth watching — a thing bought
// once has no trend to read.
//
// A row opens in place rather than pushing a page: the ranking is the frame
// of reference for whatever you opened, and losing it to a detail screen
// means coming back and finding your place again.
export function PurchaseInsightsScreen() {
  const t = useT();
  const rootNavigation = useNavigation<RootNav>();
  const { items, transactions, loading } = usePurchaseInsights();
  const [openName, setOpenName] = useState<string | null>(null);

  const history = useMemo(
    () => (openName ? purchaseItemHistory(transactions, openName) : []),
    [openName, transactions],
  );
  const trend = useMemo(() => purchaseItemTrend(history), [history]);

  if (!loading && items.length === 0)
    return (
      <ScreenContainer>
        <Text style={styles.hint}>{t('purchaseInsights.empty')}</Text>
      </ScreenContainer>
    );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <GuideSection
          heading={t('purchaseInsights.guideHeading')}
          body={t('purchaseInsights.guideBody')}
        />
        <Text style={styles.hint}>{t('purchaseInsights.hint')}</Text>
        <View style={styles.card}>
          {items.map((item, i) => {
            const open = openName === item.name;
            return (
              <View key={item.name}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => setOpenName(open ? null : item.name)}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {t('purchaseInsights.timesBought', { count: item.count })}
                      {' · '}
                      {t('purchaseInsights.totalSpent', {
                        amount: formatMoneyExact(item.totalCents),
                      })}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.price}>{formatMoneyExact(item.avgCents)}</Text>
                    <Text style={styles.priceLabel}>
                      {t('purchaseInsights.average')}
                    </Text>
                  </View>
                  <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
                </Pressable>
                {open ? (
                  <View style={styles.panel}>
                    <PurchaseItemTrendChart trend={trend} />
                    {item.minCents !== item.maxCents ? (
                      <Text style={styles.range}>
                        {t('purchaseInsights.priceRange', {
                          min: formatMoneyExact(item.minCents),
                          max: formatMoneyExact(item.maxCents),
                        })}
                      </Text>
                    ) : null}
                    <Text style={styles.historyLabel}>
                      {t('purchaseInsights.history')}
                    </Text>
                    {history.map((day) => (
                      <Pressable
                        key={day.date}
                        style={({ pressed }) => [
                          styles.historyRow,
                          pressed && styles.rowPressed,
                        ]}
                        onPress={() =>
                          rootNavigation.navigate('AddTransaction', {
                            transactionId: day.transactionIds[0],
                          })
                        }
                      >
                        <Text style={styles.historyDate}>{day.date}</Text>
                        {day.count > 1 ? (
                          <Text style={styles.historyCount}>
                            {t('purchaseInsights.sameDayCount', { count: day.count })}
                          </Text>
                        ) : null}
                        <Text style={styles.historyPrice}>
                          {formatMoneyExact(day.priceCents)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <GuideSection
          heading={t('purchaseInsights.guideBottomHeading')}
          body={t('purchaseInsights.guideBottomBody')}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl, gap: spacing.sm },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rowPressed: { backgroundColor: colors.border },
  rowText: { flex: 1 },
  name: { fontSize: 16, color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  price: { fontSize: 15, fontWeight: '600', color: colors.text },
  priceLabel: { fontSize: 10, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textMuted },
  chevronOpen: { transform: [{ rotate: '90deg' }], color: colors.accent },
  panel: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  range: { fontSize: 12, color: colors.textMuted },
  historyLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  historyDate: { fontSize: 14, color: colors.text, flex: 1 },
  historyCount: { fontSize: 12, color: colors.textMuted },
  historyPrice: { fontSize: 14, fontWeight: '600', color: colors.text },
});
