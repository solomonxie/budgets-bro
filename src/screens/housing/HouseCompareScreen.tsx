import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { GuideSection } from '../../components/ui/GuideSection';
import { useHomes } from './useHomes';
import type { HomeEntry } from './useHomes';
import { formatDistance, markBest } from '../../domain/houseMetrics';
import type { CompareDirection } from '../../domain/houseMetrics';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import type { InsightsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Route = RouteProp<InsightsStackParamList, 'HouseCompare'>;

const COLUMN_WIDTH = 132;

type Formatter = 'money' | 'number' | 'text' | 'percent' | 'distance' | 'ratio';

interface RowSpec {
  key: TranslationKey;
  direction: CompareDirection;
  format: Formatter;
  read: (entry: HomeEntry) => number | string | null;
  /** Show each house's gap to the best, e.g. "+$420". */
  gap?: boolean;
}

// Side by side, one row per thing that differs, with the better cell marked
// where "better" is defined — cheaper, more space, closer to the train.
// Rows where better is a matter of taste (community, orientation) mark
// nothing: the comparison's job is to line the facts up, not to pick.
const ROWS: RowSpec[] = [
  {
    key: 'housing.score',
    direction: 'higherIsBetter',
    format: 'number',
    read: (e) => e.score,
  },
  {
    key: 'housing.totalPrice',
    direction: 'lowerIsBetter',
    format: 'money',
    read: (e) => e.metrics.priceCents,
    gap: true,
  },
  {
    key: 'housing.fixedMonthly',
    direction: 'lowerIsBetter',
    format: 'money',
    read: (e) => e.metrics.fixedMonthlyCents,
    gap: true,
  },
  {
    key: 'housing.maintenance',
    direction: 'lowerIsBetter',
    format: 'money',
    read: (e) => e.house.maintenanceMonthlyCents,
  },
  {
    key: 'housing.strataFee',
    direction: 'lowerIsBetter',
    format: 'money',
    read: (e) => e.house.strataFeeCents,
  },
  {
    key: 'housing.propertyTax',
    direction: 'lowerIsBetter',
    format: 'money',
    read: (e) => e.house.propertyTaxAnnualCents,
  },
  {
    key: 'housing.pricePerSqft',
    direction: 'lowerIsBetter',
    format: 'money',
    read: (e) => e.metrics.pricePerSqftCents,
    gap: true,
  },
  {
    key: 'housing.vsBenchmark',
    direction: 'lowerIsBetter',
    format: 'ratio',
    read: (e) => e.metrics.overBenchmark,
  },
  {
    key: 'housing.askingOverAssessed',
    direction: 'lowerIsBetter',
    format: 'percent',
    read: (e) => e.metrics.askingOverAssessed,
  },
  {
    key: 'housing.priceChange',
    direction: 'lowerIsBetter',
    format: 'money',
    read: (e) => e.metrics.priceChangeCents,
  },
  {
    key: 'housing.daysOnMarket',
    direction: 'neutral',
    format: 'number',
    read: (e) => e.metrics.daysOnMarket,
  },
  {
    key: 'housing.floorArea',
    direction: 'higherIsBetter',
    format: 'number',
    read: (e) => e.house.floorAreaSqft,
  },
  {
    key: 'housing.lotSize',
    direction: 'higherIsBetter',
    format: 'number',
    read: (e) => e.house.lotSqft,
  },
  {
    key: 'housing.beds',
    direction: 'higherIsBetter',
    format: 'number',
    read: (e) => e.house.beds,
  },
  {
    key: 'housing.baths',
    direction: 'higherIsBetter',
    format: 'number',
    read: (e) => e.house.baths,
  },
  {
    key: 'housing.age',
    direction: 'lowerIsBetter',
    format: 'number',
    read: (e) => e.metrics.ageYears,
  },
  {
    key: 'housing.concerns',
    direction: 'lowerIsBetter',
    format: 'number',
    read: (e) => (e.house.checklist ? e.metrics.concerns : null),
  },
  {
    key: 'housing.roofAge',
    direction: 'lowerIsBetter',
    format: 'number',
    read: (e) => e.house.roofAgeYears,
  },
  {
    key: 'housing.furnaceAge',
    direction: 'lowerIsBetter',
    format: 'number',
    read: (e) => e.house.furnaceAgeYears,
  },
  {
    key: 'housing.commuteMinutes',
    direction: 'lowerIsBetter',
    format: 'number',
    read: (e) => e.house.commuteMinutes,
  },
  {
    key: 'housing.bus',
    direction: 'lowerIsBetter',
    format: 'distance',
    read: (e) => e.house.busDistanceM,
  },
  {
    key: 'housing.train',
    direction: 'lowerIsBetter',
    format: 'distance',
    read: (e) => e.house.trainDistanceM,
  },
  {
    key: 'housing.school',
    direction: 'lowerIsBetter',
    format: 'distance',
    read: (e) => e.house.schoolDistanceM,
  },
  {
    key: 'housing.grocery',
    direction: 'lowerIsBetter',
    format: 'distance',
    read: (e) => e.house.groceryDistanceM,
  },
  {
    key: 'housing.rating',
    direction: 'higherIsBetter',
    format: 'number',
    read: (e) => e.house.rating,
  },
  {
    key: 'housing.offerPrice',
    direction: 'neutral',
    format: 'money',
    read: (e) => e.house.offerPriceCents,
  },
  {
    key: 'housing.community',
    direction: 'neutral',
    format: 'text',
    read: (e) => e.house.community,
  },
  {
    key: 'housing.propertyType',
    direction: 'neutral',
    format: 'text',
    read: (e) => e.house.propertyType,
  },
  {
    key: 'housing.orientation',
    direction: 'neutral',
    format: 'text',
    read: (e) => e.house.orientation,
  },
  {
    key: 'housing.schoolCatchment',
    direction: 'neutral',
    format: 'text',
    read: (e) => e.house.schoolCatchment,
  },
  {
    key: 'housing.issues',
    direction: 'neutral',
    format: 'text',
    read: (e) => e.house.issues,
  },
  {
    key: 'housing.pros',
    direction: 'neutral',
    format: 'text',
    read: (e) => e.house.pros,
  },
  {
    key: 'housing.cons',
    direction: 'neutral',
    format: 'text',
    read: (e) => e.house.cons,
  },
];

function display(value: number | string | null, format: Formatter): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (format === 'money') return formatMoney(value);
  if (format === 'percent') return `${(value * 100).toFixed(0)}%`;
  if (format === 'ratio')
    return `${value >= 1 ? '+' : '−'}${Math.abs((value - 1) * 100).toFixed(1)}%`;
  if (format === 'distance') return formatDistance(value);
  return String(value);
}

export function HouseCompareScreen() {
  const t = useT();
  const params = useRoute<Route>().params;
  const { entries } = useHomes();

  const chosen = useMemo(() => {
    const ids = params?.houseIds ?? [];
    return ids
      .map((id) => entries.find((e) => e.house.id === id))
      .filter((e): e is HomeEntry => e != null);
  }, [params, entries]);

  // Rows nobody filled in are noise; only what at least one house says.
  const rows = useMemo(
    () =>
      ROWS.map((spec) => {
        const raw = chosen.map((e) => spec.read(e));
        const numeric = raw.map((v) => (typeof v === 'number' ? v : null));
        const best = markBest(spec.key, spec.direction, numeric).bestIndex;
        const bestValue = best != null ? numeric[best] : null;
        return { spec, raw, numeric, best, bestValue };
      }).filter((r) => r.raw.some((v) => v != null && v !== '')),
    [chosen],
  );

  if (chosen.length === 0) {
    return (
      <ScreenContainer>
        <Text style={styles.muted}>{t('housing.compareEmpty')}</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.label, styles.labelCell]} />
            {chosen.map((e) => (
              <Text
                key={e.house.id}
                style={[styles.cell, styles.headerCell]}
                numberOfLines={2}
              >
                {e.house.name}
              </Text>
            ))}
          </View>
          <ScrollView>
            {rows.map(({ spec, raw, numeric, best, bestValue }) => (
              <View key={spec.key} style={styles.row}>
                <Text
                  style={[styles.label, styles.labelCell]}
                  numberOfLines={2}
                >
                  {t(spec.key)}
                </Text>
                {raw.map((value, i) => {
                  const gap =
                    spec.gap &&
                    bestValue != null &&
                    numeric[i] != null &&
                    i !== best
                      ? numeric[i]! - bestValue
                      : null;
                  return (
                    <View key={`${spec.key}-${i}`} style={styles.cellBox}>
                      <Text
                        style={[styles.cell, best === i && styles.bestCell]}
                        numberOfLines={3}
                      >
                        {display(value, spec.format)}
                      </Text>
                      {gap != null && gap !== 0 ? (
                        <Text style={styles.gap}>
                          {`${gap > 0 ? '+' : '−'}${formatMoney(Math.abs(gap))}`}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
            <GuideSection
              heading={t('housing.compareGuideHeading')}
              body={t('housing.compareGuideBody')}
            />
          </ScrollView>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    gap: spacing.sm,
  },
  headerRow: { borderBottomWidth: 1 },
  label: { fontSize: 12, color: colors.textMuted },
  labelCell: { width: 116 },
  cellBox: { width: COLUMN_WIDTH },
  cell: { fontSize: 13, color: colors.text },
  gap: { fontSize: 11, color: colors.negative },
  headerCell: { fontWeight: '700' },
  bestCell: { color: colors.positive, fontWeight: '700' },
  muted: { fontSize: 13, color: colors.textMuted },
});
