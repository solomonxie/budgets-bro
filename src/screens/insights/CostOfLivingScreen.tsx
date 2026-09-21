import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ExperimentalBanner } from '../../components/ui/ExperimentalBanner';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { DropdownField, DropdownOption } from '../../components/ui/DropdownField';
import { ExpandingFieldGroup } from '../../components/ui/ExpandingField';
import { GuideSection } from '../../components/ui/GuideSection';
import { CostQuadrantChart } from './CostQuadrantChart';
import { useCityCosts } from '../../hooks/useCityCosts';
import { useBucketSpending } from '../../hooks/useBucketSpending';
import { useCategories } from '../../hooks/useCategories';
import { useExchangeRates } from '../../hooks/useExchangeRates';
import { fxStats } from '../../market/fxStats';
import {
  CITIES,
  COST_BUCKETS,
  COST_OF_LIVING_AS_OF,
  compareToCity,
  comparisonTotals,
} from '../../market/costOfLiving';
import type { CostBucket } from '../../market/costOfLiving';
import { formatMoney } from '../../domain/money';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const HOME_CURRENCY = 'CAD';

function cityNameKey(id: string): TranslationKey {
  return `city.${id}` as TranslationKey;
}

function bucketKey(bucket: CostBucket): TranslationKey {
  return `bucket.${bucket}` as TranslationKey;
}

// What a city costs, against what you actually spend. The city's half is an
// estimate and says so; your half is exact, because it is your own ledger.
export function CostOfLivingScreen() {
  const t = useT();
  const [cityId, setCityId] = useState('vancouver');
  const [pickingBucket, setPickingBucket] = useState<CostBucket | null>(null);
  const { categories } = useCategories();
  const cityName = t(cityNameKey(cityId));
  const city = useCityCosts(cityId, cityName);
  const { mapping, monthlyByBucket, windowMonths, toggleCategory } =
    useBucketSpending();

  // A city priced in its own money is converted with the same cached ECB
  // rates the Exchange page uses — no second source, no second request.
  const needsConversion = city.currency !== HOME_CURRENCY;
  const fx = useExchangeRates(
    needsConversion ? city.currency : HOME_CURRENCY,
    HOME_CURRENCY,
  );
  const rate = useMemo(() => {
    if (!needsConversion) return 1;
    return fxStats(fx.points).latest?.rate ?? 0;
  }, [needsConversion, fx.points]);

  const rows = useMemo(
    () =>
      city.monthly
        ? compareToCity(city.monthly, monthlyByBucket, rate || 1)
        : [],
    [city.monthly, monthlyByBucket, rate],
  );
  const totals = useMemo(() => comparisonTotals(rows), [rows]);

  const mappedLabel = (bucket: CostBucket) => {
    const ids = mapping[bucket] ?? [];
    if (ids.length === 0) return t('costOfLiving.mapCategories');
    if (ids.length === 1)
      return categories.find((c) => c.id === ids[0])?.name ?? '—';
    return t('babySteps.categoriesCount', { count: ids.length });
  };

  return (
    <ScreenContainer scroll>
      <ExperimentalBanner />
      <ExpandingFieldGroup>
        <Card title={t('costOfLiving.cityHeading')}>
          <DropdownField
            compact
            label={t('costOfLiving.city')}
            valueLabel={cityName}
          >
            {(close) => (
              <>
                {CITIES.map((c) => (
                  <DropdownOption
                    key={c.id}
                    label={t(cityNameKey(c.id))}
                    selected={cityId === c.id}
                    onPress={() => {
                      setCityId(c.id);
                      close();
                    }}
                  />
                ))}
              </>
            )}
          </DropdownField>
          <Text style={styles.muted}>
            {city.fromAi
              ? t('costOfLiving.fromAi', {
                  model: city.model ?? 'AI',
                  date: city.asOf,
                })
              : t('costOfLiving.fromTable', { date: COST_OF_LIVING_AS_OF })}
          </Text>
          <View style={styles.actions}>
            {city.hasAiKey ? (
              <Pressable onPress={city.askAi} disabled={city.asking} hitSlop={8}>
                <Text style={styles.link}>
                  {city.asking
                    ? t('costOfLiving.asking')
                    : t('costOfLiving.askAi')}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.muted}>{t('costOfLiving.needsAiKey')}</Text>
            )}
            {city.fromAi ? (
              <Pressable onPress={city.clearUpdate} hitSlop={8}>
                <Text style={styles.muted}>{t('costOfLiving.useTable')}</Text>
              </Pressable>
            ) : null}
          </View>
          {city.error ? (
            <Text style={styles.error}>{t('costOfLiving.askFailed')}</Text>
          ) : null}
          {needsConversion && rate === 0 ? (
            <Text style={styles.muted}>
              {t('costOfLiving.needsRate', { currency: city.currency })}
            </Text>
          ) : null}
        </Card>

        <Card title={t('costOfLiving.compareHeading', { months: windowMonths })}>
          {rows.map((row) => (
            <View key={row.bucket} style={styles.bucketRow}>
              <ResultRow
                label={t(bucketKey(row.bucket))}
                value={
                  row.differenceCents == null
                    ? formatMoney(row.cityCents)
                    : `${formatMoney(row.yoursCents)} / ${formatMoney(row.cityCents)}`
                }
                tone={
                  row.differenceCents == null
                    ? 'muted'
                    : row.differenceCents > 0
                      ? 'negative'
                      : 'positive'
                }
                hint={
                  row.differenceCents == null
                    ? undefined
                    : t('costOfLiving.difference', {
                        amount: formatMoney(Math.abs(row.differenceCents)),
                        direction: t(
                          row.differenceCents > 0
                            ? 'costOfLiving.more'
                            : 'costOfLiving.less',
                        ),
                      })
                }
              />
              <Pressable onPress={() => setPickingBucket(row.bucket)} hitSlop={6}>
                <Text style={styles.link}>{mappedLabel(row.bucket)} ▾</Text>
              </Pressable>
            </View>
          ))}
          {totals.comparedBuckets > 0 ? (
            <ResultRow
              label={t('costOfLiving.totalCompared', {
                count: totals.comparedBuckets,
              })}
              value={`${formatMoney(totals.yoursCents)} / ${formatMoney(totals.cityCents)}`}
              big
              tone={totals.differenceCents > 0 ? 'negative' : 'positive'}
            />
          ) : (
            <Text style={styles.muted}>{t('costOfLiving.mapSomething')}</Text>
          )}
        </Card>

        {totals.comparedBuckets > 1 ? (
          <Card title={t('costOfLiving.quadrantHeading')}>
            <Text style={styles.muted}>{t('costOfLiving.quadrantHint')}</Text>
            <CostQuadrantChart
              rows={rows}
              labelFor={(bucket) => t(bucketKey(bucket))}
              formatAmount={formatMoney}
            />
          </Card>
        ) : null}

        <GuideSection
          heading={t('costOfLiving.guideHeading')}
          body={t('costOfLiving.guideBody')}
        />
        <GuideSection
          heading={t('costOfLiving.sourceHeading')}
          body={t('costOfLiving.sourceBody')}
        />
      </ExpandingFieldGroup>

      <Modal
        visible={pickingBucket != null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickingBucket(null)}
      >
        <BottomSheet
          title={
            pickingBucket ? t(bucketKey(pickingBucket)) : t('costOfLiving.city')
          }
          onClose={() => setPickingBucket(null)}
        >
          {categories.map((category) => (
            <DropdownOption
              key={category.id}
              label={category.name}
              selected={(mapping[pickingBucket ?? 'housing'] ?? []).includes(
                category.id,
              )}
              onPress={() =>
                pickingBucket && toggleCategory(pickingBucket, category.id)
              }
            />
          ))}
        </BottomSheet>
      </Modal>
    </ScreenContainer>
  );
}

// Bucket ids are a closed set — kept here so a new bucket is a compile error
// in the dictionary rather than a blank row on the page.
export const ALL_BUCKETS = COST_BUCKETS;

const styles = StyleSheet.create({
  muted: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  error: { fontSize: 12, color: colors.negative },
  link: { fontSize: 13, fontWeight: '700', color: colors.accent },
  actions: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  bucketRow: { gap: 2 },
});
