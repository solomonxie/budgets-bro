import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { GuideSection } from '../../components/ui/GuideSection';
import { useHouses } from '../../hooks/useHouses';
import { DEFAULT_ASSUMPTIONS, houseMetrics, markBest } from '../../domain/houseMetrics';
import type { CompareDirection } from '../../domain/houseMetrics';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import type { InsightsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Route = RouteProp<InsightsStackParamList, 'HouseCompare'>;

const COLUMN_WIDTH = 132;

type Formatter = 'money' | 'number' | 'text' | 'percent';

interface RowSpec {
  key: TranslationKey;
  direction: CompareDirection;
  format: Formatter;
  read: (
    house: ReturnType<typeof useHouses>['houses'][number],
    metrics: ReturnType<typeof houseMetrics>,
  ) => number | string | null;
}

// Side by side, one row per thing that differs, with the better cell marked
// where "better" is defined — cheaper to carry, more space, newer roof. Rows
// where better is a matter of taste (community, orientation) mark nothing:
// the comparison's job is to line the facts up, not to pick.
const ROWS: RowSpec[] = [
  { key: 'housing.askingPrice', direction: 'lowerIsBetter', format: 'money', read: (h) => h.askingPriceCents },
  { key: 'housing.carryingMonthly', direction: 'lowerIsBetter', format: 'money', read: (_h, m) => m.carryingMonthlyCents },
  { key: 'housing.mortgagePayment', direction: 'lowerIsBetter', format: 'money', read: (_h, m) => m.paymentMonthlyCents },
  { key: 'housing.pricePerSqft', direction: 'lowerIsBetter', format: 'money', read: (_h, m) => m.pricePerSqftCents },
  { key: 'housing.strataFee', direction: 'lowerIsBetter', format: 'money', read: (h) => h.strataFeeCents },
  { key: 'housing.propertyTaxAnnual', direction: 'lowerIsBetter', format: 'money', read: (h) => h.propertyTaxAnnualCents },
  { key: 'housing.askingOverAssessed', direction: 'lowerIsBetter', format: 'percent', read: (_h, m) => m.askingOverAssessed },
  { key: 'housing.floorArea', direction: 'higherIsBetter', format: 'number', read: (h) => h.floorAreaSqft },
  { key: 'housing.lotSize', direction: 'higherIsBetter', format: 'number', read: (h) => h.lotSqft },
  { key: 'housing.beds', direction: 'higherIsBetter', format: 'number', read: (h) => h.beds },
  { key: 'housing.baths', direction: 'higherIsBetter', format: 'number', read: (h) => h.baths },
  { key: 'housing.yearBuilt', direction: 'higherIsBetter', format: 'number', read: (h) => h.yearBuilt },
  { key: 'housing.roofAge', direction: 'lowerIsBetter', format: 'number', read: (h) => h.roofAgeYears },
  { key: 'housing.furnaceAge', direction: 'lowerIsBetter', format: 'number', read: (h) => h.furnaceAgeYears },
  { key: 'housing.commuteMinutes', direction: 'lowerIsBetter', format: 'number', read: (h) => h.commuteMinutes },
  { key: 'housing.rating', direction: 'higherIsBetter', format: 'number', read: (h) => h.rating },
  { key: 'housing.community', direction: 'neutral', format: 'text', read: (h) => h.community },
  { key: 'housing.propertyType', direction: 'neutral', format: 'text', read: (h) => h.propertyType },
  { key: 'housing.orientation', direction: 'neutral', format: 'text', read: (h) => h.orientation },
  { key: 'housing.schoolCatchment', direction: 'neutral', format: 'text', read: (h) => h.schoolCatchment },
  { key: 'housing.issues', direction: 'neutral', format: 'text', read: (h) => h.issues },
  { key: 'housing.pros', direction: 'neutral', format: 'text', read: (h) => h.pros },
  { key: 'housing.cons', direction: 'neutral', format: 'text', read: (h) => h.cons },
];

function display(value: number | string | null, format: Formatter): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (format === 'money') return formatMoney(value);
  if (format === 'percent') return `${(value * 100).toFixed(0)}%`;
  return String(value);
}

export function HouseCompareScreen() {
  const t = useT();
  const params = useRoute<Route>().params;
  const { houses } = useHouses();

  const chosen = useMemo(() => {
    const ids = params?.houseIds ?? [];
    return ids.map((id) => houses.find((h) => h.id === id)).filter((h) => h != null);
  }, [params, houses]);
  const metrics = useMemo(() => {
    const year = new Date().getFullYear();
    return chosen.map((h) => houseMetrics(h!, DEFAULT_ASSUMPTIONS, year));
  }, [chosen]);

  const rows = useMemo(
    () =>
      ROWS.map((spec) => {
        const raw = chosen.map((house, i) => spec.read(house!, metrics[i]));
        const numeric = raw.map((v) => (typeof v === 'number' ? v : null));
        return {
          spec,
          raw,
          best: markBest(spec.key, spec.direction, numeric).bestIndex,
        };
      }),
    [chosen, metrics],
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
            {chosen.map((house) => (
              <Text
                key={house!.id}
                style={[styles.cell, styles.headerCell]}
                numberOfLines={2}
              >
                {house!.name}
              </Text>
            ))}
          </View>
          <ScrollView>
            {rows.map(({ spec, raw, best }) => (
              <View key={spec.key} style={styles.row}>
                <Text style={[styles.label, styles.labelCell]} numberOfLines={2}>
                  {t(spec.key)}
                </Text>
                {raw.map((value, i) => (
                  <Text
                    key={`${spec.key}-${i}`}
                    style={[styles.cell, best === i && styles.bestCell]}
                    numberOfLines={3}
                  >
                    {display(value, spec.format)}
                  </Text>
                ))}
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
  cell: { width: COLUMN_WIDTH, fontSize: 13, color: colors.text },
  headerCell: { fontWeight: '700' },
  bestCell: { color: colors.positive, fontWeight: '700' },
  muted: { fontSize: 13, color: colors.textMuted },
});
