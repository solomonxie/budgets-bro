import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ExperimentalBanner } from '../../components/ui/ExperimentalBanner';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { GuideSection } from '../../components/ui/GuideSection';
import { SeriesLineChart } from '../../components/ui/SeriesLineChart';
import { CommunityPriceModal } from './CommunityPriceModal';
import { useHomes } from './useHomes';
import type { HomeEntry } from './useHomes';
import { formatMoney, formatMoneyCompact } from '../../domain/money';
import { currentDateISO } from '../../domain/month';
import {
  ARCHIVED_STATUSES,
  HOUSE_STATUSES,
} from '../../db/repositories/housesRepo';
import type { HouseStatus } from '../../db/repositories/housesRepo';
import { SCORE_CRITERIA } from '../../domain/houseScore';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import type { InsightsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<InsightsStackParamList>;
type Sort = 'status' | 'price' | 'monthly' | 'score';

const SORTS: { value: Sort; key: TranslationKey }[] = [
  { value: 'status', key: 'housing.sortStatus' },
  { value: 'price', key: 'housing.sortPrice' },
  { value: 'monthly', key: 'housing.sortMonthly' },
  { value: 'score', key: 'housing.sortScore' },
];

export function statusKey(status: HouseStatus): TranslationKey {
  return `houseStatus.${status}` as TranslationKey;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const [ty, tm, td] = currentDateISO().split('-').map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
  );
}

// Homes: the places being considered, each with what sets it apart, and a
// hand-kept benchmark per community to judge them against. What it would
// cost to borrow for is the Mortgage page's; a house links there.
export function HomesScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const { entries, weights, setWeights, communities } = useHomes();
  const { series, add, remove } = communities;
  const [addingPrice, setAddingPrice] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [sort, setSort] = useState<Sort>('status');
  const [showArchived, setShowArchived] = useState(false);
  const [showWeights, setShowWeights] = useState(false);

  const { active, archived } = useMemo(() => {
    const value = (e: HomeEntry): number | null =>
      sort === 'price'
        ? e.metrics.priceCents
        : sort === 'monthly'
          ? e.metrics.fixedMonthlyCents
          : sort === 'score'
            ? e.score
            : null;
    const sorted =
      sort === 'status'
        ? entries
        : [...entries].sort((a, b) => {
            const va = value(a);
            const vb = value(b);
            if (va == null) return vb == null ? 0 : 1;
            if (vb == null) return -1;
            return sort === 'score' ? vb - va : va - vb;
          });
    return {
      active: sorted.filter((e) => !ARCHIVED_STATUSES.includes(e.house.status)),
      archived: sorted.filter((e) =>
        ARCHIVED_STATUSES.includes(e.house.status),
      ),
    };
  }, [entries, sort]);

  const toggle = (id: number) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const row = (e: HomeEntry) => {
    const { house, metrics, score } = e;
    const picked = selected.includes(house.id);
    const subjects =
      house.status === 'offered' ? daysUntil(house.subjectRemovalDate) : null;
    const badges = [
      metrics.fixedMonthlyCents != null
        ? t('housing.perMonth', {
            amount: formatMoney(metrics.fixedMonthlyCents),
          })
        : null,
      metrics.overBenchmark != null
        ? t(
            metrics.overBenchmark >= 1
              ? 'housing.aboveBenchmarkShort'
              : 'housing.belowBenchmarkShort',
            {
              percent: Math.abs((metrics.overBenchmark - 1) * 100).toFixed(0),
            },
          )
        : null,
      metrics.priceChangeCents != null && metrics.priceChangeCents < 0
        ? t('housing.droppedShort', {
            amount: formatMoneyCompact(-metrics.priceChangeCents),
          })
        : null,
      score != null ? t('housing.scoreShort', { score }) : null,
    ].filter(Boolean);
    return (
      <View key={house.id} style={styles.houseRow}>
        <Pressable
          hitSlop={10}
          onPress={() => toggle(house.id)}
          accessibilityLabel={t('housing.pickToCompare')}
          style={[styles.check, picked && styles.checkOn]}
        >
          {picked ? <Text style={styles.checkMark}>✓</Text> : null}
        </Pressable>
        <Pressable
          style={styles.houseMain}
          onPress={() =>
            navigation.navigate('HouseDetail', { houseId: house.id })
          }
        >
          <View style={styles.titleRow}>
            <Text style={styles.houseName} numberOfLines={1}>
              {house.name}
            </Text>
            <Text style={styles.housePrice}>
              {house.askingPriceCents
                ? formatMoneyCompact(house.askingPriceCents)
                : '—'}
            </Text>
          </View>
          <Text style={styles.houseSub} numberOfLines={1}>
            {[
              t(statusKey(house.status)),
              house.community ?? house.city,
              house.beds != null
                ? t('housing.bedsShort', { beds: house.beds })
                : null,
              house.floorAreaSqft
                ? t('housing.sqftShort', { sqft: house.floorAreaSqft })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {badges.length > 0 ? (
            <Text style={styles.houseSub} numberOfLines={1}>
              {badges.join(' · ')}
            </Text>
          ) : null}
          {subjects != null ? (
            <Text style={[styles.houseSub, subjects <= 3 && styles.warn]}>
              {subjects >= 0
                ? t('housing.subjectsIn', { days: subjects })
                : t('housing.subjectsPassed')}
            </Text>
          ) : null}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.flex}>
      <ScreenContainer scroll>
        <ExperimentalBanner />
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate('HouseDetail', {})}
        >
          <Text style={styles.addButtonText}>{t('housing.addHouse')}</Text>
        </Pressable>

        <Card title={t('housing.shortlistHeading')}>
          {entries.length > 1 ? (
            <View style={styles.sorts}>
              {SORTS.map((s) => (
                <Pressable
                  key={s.value}
                  style={[styles.sort, sort === s.value && styles.sortOn]}
                  onPress={() => setSort(s.value)}
                >
                  <Text
                    style={[
                      styles.sortText,
                      sort === s.value && styles.sortTextOn,
                    ]}
                  >
                    {t(s.key)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {entries.length === 0 ? (
            <Text style={styles.muted}>{t('housing.empty')}</Text>
          ) : (
            active.map(row)
          )}
          {archived.length > 0 ? (
            <>
              <Pressable
                style={styles.archivedHead}
                onPress={() => setShowArchived((v) => !v)}
              >
                <Text style={styles.muted}>
                  {showArchived ? '▾ ' : '› '}
                  {t('housing.archived', { count: archived.length })}
                </Text>
              </Pressable>
              {showArchived ? archived.map(row) : null}
            </>
          ) : null}
          {entries.length >= 2 && selected.length < 2 ? (
            <Text style={styles.muted}>{t('housing.compareHint')}</Text>
          ) : null}
        </Card>

        {entries.length > 1 ? (
          <Card>
            <Pressable
              style={styles.weightsHead}
              onPress={() => setShowWeights((v) => !v)}
            >
              <Text style={styles.weightsTitle}>
                {t('housing.weightsHeading')}
              </Text>
              <Text style={styles.muted}>{showWeights ? '▾' : '›'}</Text>
            </Pressable>
            {showWeights ? (
              <>
                <Text style={styles.muted}>{t('housing.weightsHint')}</Text>
                {SCORE_CRITERIA.map((criterion) => (
                  <View key={criterion} style={styles.weightRow}>
                    <Text style={styles.weightLabel}>
                      {t(`houseScore.${criterion}` as TranslationKey)}
                    </Text>
                    <View style={styles.weightSteps}>
                      {[0, 1, 2, 3].map((n) => {
                        const on = (weights[criterion] ?? 0) === n;
                        return (
                          <Pressable
                            key={n}
                            style={[styles.step, on && styles.sortOn]}
                            onPress={() =>
                              setWeights({ ...weights, [criterion]: n })
                            }
                          >
                            <Text
                              style={[styles.sortText, on && styles.sortTextOn]}
                            >
                              {n === 0 ? '–' : '●'.repeat(n)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </Card>
        ) : null}

        {series.map((entry) => {
          const points = entry.points.map((p) => ({
            date: p.asOfMonth,
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
                <SeriesLineChart
                  points={points}
                  formatValue={formatMoneyCompact}
                />
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
        {selected.length >= 2 ? <View style={styles.barSpace} /> : null}

        <CommunityPriceModal
          visible={addingPrice}
          onCancel={() => setAddingPrice(false)}
          onSave={async (input) => {
            await add(input);
            setAddingPrice(false);
          }}
        />
      </ScreenContainer>
      {/* Stays in reach however far the list is scrolled. */}
      {selected.length >= 2 ? (
        <SafeAreaView edges={['bottom']} style={styles.bar}>
          <Pressable onPress={() => setSelected([])} hitSlop={8}>
            <Text style={styles.muted}>{t('housing.clearPicks')}</Text>
          </Pressable>
          <Pressable
            style={styles.compareButton}
            onPress={() =>
              navigation.navigate('HouseCompare', { houseIds: selected })
            }
          >
            <Text style={styles.compareText}>
              {t('housing.compareSelected', { count: selected.length })}
            </Text>
          </Pressable>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

// Exported so the compare screen labels its status row the same way.
export const HOUSE_STATUS_ORDER = HOUSE_STATUSES;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  muted: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  warn: { color: colors.negative, fontWeight: '700' },
  link: { fontSize: 14, fontWeight: '700', color: colors.accent },
  addLink: { alignItems: 'center', paddingVertical: spacing.sm },
  addButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.accent,
  },
  addButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  pressed: { opacity: 0.8 },
  sorts: { flexDirection: 'row', gap: spacing.xs },
  sort: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortOn: { borderColor: colors.accent, backgroundColor: colors.tint },
  sortText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  sortTextOn: { color: colors.accent },
  houseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  houseMain: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  houseName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  houseSub: { fontSize: 12, color: colors.textMuted },
  housePrice: { fontSize: 15, fontWeight: '700', color: colors.text },
  archivedHead: { paddingVertical: spacing.sm },
  weightsHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weightsTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  weightLabel: { flex: 1, fontSize: 13, color: colors.text },
  weightSteps: { flexDirection: 'row', gap: 4 },
  step: {
    minWidth: 40,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  barSpace: { height: 72 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  compareButton: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.accent,
    marginBottom: spacing.sm,
  },
  compareText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
