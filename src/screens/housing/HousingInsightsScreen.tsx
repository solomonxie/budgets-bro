import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { GuideSection } from '../../components/ui/GuideSection';
import { SeriesLineChart } from '../../components/ui/SeriesLineChart';
import { CommunityPriceModal } from './CommunityPriceModal';
import { useHouses } from '../../hooks/useHouses';
import { useCommunityPrices } from '../../hooks/useCommunityPrices';
import { DEFAULT_ASSUMPTIONS, houseMetrics } from '../../domain/houseMetrics';
import { formatMoney, formatMoneyCompact } from '../../domain/money';
import { HOUSE_STATUSES } from '../../db/repositories/housesRepo';
import type { HouseStatus } from '../../db/repositories/housesRepo';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import type { InsightsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<InsightsStackParamList>;

export function statusKey(status: HouseStatus): TranslationKey {
  return `houseStatus.${status}` as TranslationKey;
}

// The house hunt: what a community has been doing, and the places being
// considered in it. Both halves are the user's own records — a benchmark
// price is read off a real-estate board's report and typed in, exactly like
// a tracking account's value, because those reports are documents rather
// than an API and their terms don't allow republishing them anyway.
export function HousingInsightsScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const { houses } = useHouses();
  const { series, add, remove } = useCommunityPrices();
  const [addingPrice, setAddingPrice] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const metricsById = useMemo(() => {
    const year = new Date().getFullYear();
    return new Map(
      houses.map((h) => [h.id, houseMetrics(h, DEFAULT_ASSUMPTIONS, year)]),
    );
  }, [houses]);

  const toggleSelected = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <ScreenContainer scroll>
      <Card title={t('housing.shortlistHeading')}>
        {houses.length === 0 ? (
          <Text style={styles.muted}>{t('housing.empty')}</Text>
        ) : (
          houses.map((house) => {
            const metrics = metricsById.get(house.id);
            const picked = selected.includes(house.id);
            return (
              <Pressable
                key={house.id}
                style={styles.houseRow}
                onPress={() =>
                  navigation.navigate('HouseDetail', { houseId: house.id })
                }
                onLongPress={() => toggleSelected(house.id)}
              >
                <View style={styles.houseMain}>
                  <Text style={styles.houseName} numberOfLines={1}>
                    {picked ? '✓ ' : ''}
                    {house.name}
                  </Text>
                  <Text style={styles.houseSub} numberOfLines={1}>
                    {[
                      house.community ?? house.city,
                      house.beds != null ? t('housing.bedsShort', { beds: house.beds }) : null,
                      house.floorAreaSqft
                        ? t('housing.sqftShort', { sqft: house.floorAreaSqft })
                        : null,
                      t(statusKey(house.status)),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {metrics?.carryingMonthlyCents != null ? (
                    <Text style={styles.houseSub}>
                      {t('housing.carryingShort', {
                        amount: formatMoney(metrics.carryingMonthlyCents),
                      })}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.housePrice}>
                  {house.askingPriceCents
                    ? formatMoneyCompact(house.askingPriceCents)
                    : '—'}
                </Text>
              </Pressable>
            );
          })
        )}
        <View style={styles.actions}>
          <Pressable
            hitSlop={8}
            onPress={() => navigation.navigate('HouseDetail', {})}
          >
            <Text style={styles.link}>{t('housing.addHouse')}</Text>
          </Pressable>
          {selected.length >= 2 ? (
            <Pressable
              hitSlop={8}
              onPress={() =>
                navigation.navigate('HouseCompare', { houseIds: selected })
              }
            >
              <Text style={styles.link}>
                {t('housing.compareSelected', { count: selected.length })}
              </Text>
            </Pressable>
          ) : houses.length >= 2 ? (
            <Text style={styles.muted}>{t('housing.compareHint')}</Text>
          ) : null}
        </View>
      </Card>

      {series.map((entry) => {
        const points = entry.points.map((p) => ({
          label: p.asOfMonth,
          value: p.benchmarkPriceCents,
        }));
        const first = entry.points[0];
        const last = entry.points[entry.points.length - 1];
        const change =
          first && last && first.benchmarkPriceCents > 0
            ? (last.benchmarkPriceCents - first.benchmarkPriceCents) /
              first.benchmarkPriceCents
            : 0;
        return (
          <Card key={entry.key} title={`${entry.community} · ${entry.city}`}>
            {points.length > 1 ? (
              <SeriesLineChart points={points} formatValue={formatMoneyCompact} />
            ) : null}
            <ResultRow
              label={t('housing.latestBenchmark')}
              value={last ? formatMoney(last.benchmarkPriceCents) : '—'}
              hint={last?.asOfMonth}
              big
            />
            {points.length > 1 ? (
              <ResultRow
                label={t('housing.changeSince', { month: first.asOfMonth })}
                value={`${change >= 0 ? '+' : ''}${(change * 100).toFixed(1)}%`}
                tone={change >= 0 ? 'positive' : 'negative'}
              />
            ) : null}
            {entry.points.map((price) => (
              <Pressable
                key={price.id}
                style={styles.priceRow}
                onLongPress={() => remove(price.id)}
              >
                <Text style={styles.muted}>
                  {price.asOfMonth}
                  {price.propertyType ? ` · ${price.propertyType}` : ''}
                </Text>
                <Text style={styles.muted}>
                  {formatMoney(price.benchmarkPriceCents)}
                </Text>
              </Pressable>
            ))}
          </Card>
        );
      })}

      <Pressable
        style={styles.addLink}
        hitSlop={8}
        onPress={() => setAddingPrice(true)}
      >
        <Text style={styles.link}>{t('housing.addBenchmark')}</Text>
      </Pressable>

      <GuideSection
        heading={t('housing.guideHeading')}
        body={t('housing.guideBody')}
      />
      <GuideSection
        heading={t('housing.sourceHeading')}
        body={t('housing.sourceBody')}
      />

      <CommunityPriceModal
        visible={addingPrice}
        onCancel={() => setAddingPrice(false)}
        onSave={async (input) => {
          await add(input);
          setAddingPrice(false);
        }}
      />
    </ScreenContainer>
  );
}

// Exported so the compare screen labels its status row the same way.
export const HOUSE_STATUS_ORDER = HOUSE_STATUSES;

const styles = StyleSheet.create({
  muted: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  link: { fontSize: 14, fontWeight: '700', color: colors.accent },
  addLink: { alignItems: 'center', paddingVertical: spacing.sm },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  houseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  houseMain: { flex: 1, gap: 2 },
  houseName: { fontSize: 15, fontWeight: '600', color: colors.text },
  houseSub: { fontSize: 12, color: colors.textMuted },
  housePrice: { fontSize: 15, fontWeight: '700', color: colors.text },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
});
