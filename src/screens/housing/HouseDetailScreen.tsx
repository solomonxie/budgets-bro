import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { UnitAmountField } from '../../components/ui/UnitAmountField';
import { DateField } from '../../components/ui/DateField';
import { FieldCard } from '../../components/ui/FieldCard';
import { ExpandingFieldGroup } from '../../components/ui/ExpandingField';
import { ExpandingSection } from '../../components/ui/ExpandingSection';
import { getDb } from '../../db/client';
import * as housesRepo from '../../db/repositories/housesRepo';
import { HOUSE_STATUSES, emptyHouse } from '../../db/repositories/housesRepo';
import type { HouseInput } from '../../db/repositories/housesRepo';
import {
  formatDistance,
  houseMetrics,
  parseDistance,
} from '../../domain/houseMetrics';
import {
  CHECKLIST_ITEMS,
  cycleMark,
  parseChecklist,
} from '../../domain/houseChecklist';
import { addressFromListingUrl } from '../../domain/houseListing';
import { formatMoney } from '../../domain/money';
import { currentDateISO, formatDateLabel } from '../../domain/month';
import { benchmarkFor, useHomes } from './useHomes';
import { statusKey } from './HomesScreen';
import { useT } from '../../i18n';
import { useAppStore } from '../../state/useAppStore';
import type { TranslationKey } from '../../i18n';
import type { InsightsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Route = RouteProp<InsightsStackParamList, 'HouseDetail'>;
type Nav = NativeStackNavigationProp<InsightsStackParamList>;

const RATINGS = [1, 2, 3, 4, 5];
const SAVE_DELAY_MS = 400;
// A common rule of thumb for upkeep: 1% of the price a year.
const UPKEEP_SHARE_PER_YEAR = 0.01;

function dollars(cents: number | null): string {
  return cents == null ? '' : Math.round(cents / 100).toLocaleString('en-US');
}

function centsFromDollars(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) * 100 : null;
}

function percentOf(part: number, whole: number): string {
  return `${((part / whole) * 100).toFixed(1)}%`;
}

// Everything a viewing turns up, saved as it's typed — there is no Save to
// forget in a car park. The first card is what every house has (name,
// price, where it stands); the rest unfolds in place, one section at a time.
export function HouseDetailScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const houseId = useRoute<Route>().params?.houseId ?? null;
  const { add, update, remove, entries, communities } = useHomes();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const [draft, setDraft] = useState<HouseInput>(emptyHouse());
  const [loaded, setLoaded] = useState(houseId == null);
  const savedId = useRef<number | null>(houseId);
  const [shownId, setShownId] = useState<number | null>(houseId);
  const creating = useRef<Promise<number> | null>(null);
  const pending = useRef<HouseInput | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Logged only when it changes, so deleting a history entry sticks.
  const loggedPrice = useRef<number | null>(null);
  const [taxUnit, setTaxUnit] = useState<'year' | 'percent'>('year');
  const [taxPercent, setTaxPercent] = useState('');

  useEffect(() => {
    if (houseId == null) return;
    (async () => {
      const found = await housesRepo.getHouse(await getDb(), houseId);
      if (found) {
        const { id: _id, ...rest } = found;
        setDraft(rest);
        loggedPrice.current = found.askingPriceCents;
      }
      setLoaded(true);
    })();
  }, [houseId]);

  const persist = async (input: HouseInput) => {
    const named = {
      ...input,
      name: input.name.trim() || t('housing.untitled'),
    };
    if (savedId.current == null && !creating.current) {
      if (!input.name.trim() && input.askingPriceCents == null) return;
      creating.current = add(named);
      savedId.current = await creating.current;
      setShownId(savedId.current);
    } else {
      // A change typed while the first save was still creating the row.
      savedId.current ??= await creating.current!;
      await update(savedId.current, named);
    }
    if (
      input.askingPriceCents != null &&
      input.askingPriceCents !== loggedPrice.current
    ) {
      loggedPrice.current = input.askingPriceCents;
      await housesRepo.logHousePrice(
        await getDb(),
        savedId.current!,
        currentDateISO(),
        input.askingPriceCents,
      );
    }
  };

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const input = pending.current;
    pending.current = null;
    if (input) persist(input);
  };

  // Saved a moment after typing stops, and on the way out.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [dirty, setDirty] = useState(false);
  const change = (next: HouseInput) => {
    setDraft(next);
    setDirty(true);
  };
  useEffect(() => {
    if (!dirty || !loaded) return;
    pending.current = draft;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty, loaded]);
  const set = <K extends keyof HouseInput>(key: K, value: HouseInput[K]) =>
    change({ ...draft, [key]: value });

  const text = (key: keyof HouseInput) => ({
    value: (draft[key] as string | null) ?? '',
    onChangeText: (value: string) => set(key, (value || null) as never),
  });
  const money = (key: keyof HouseInput) => ({
    value: dollars(draft[key] as number | null),
    onChangeText: (value: string) => set(key, centsFromDollars(value) as never),
    keyboardType: 'number-pad' as const,
  });
  const number = (key: keyof HouseInput) => ({
    value: draft[key] == null ? '' : String(draft[key]),
    onChangeText: (value: string) => {
      const parsed = Number.parseFloat(value);
      set(
        key,
        (value.trim() === '' || !Number.isFinite(parsed)
          ? null
          : parsed) as never,
      );
    },
    keyboardType: 'decimal-pad' as const,
  });
  // Typed as "400" or "1.2 km"; kept as typed while focused would need a
  // second state per field, so it reads back in the same unit it's stored.
  const distance = (key: keyof HouseInput) => ({
    value: draft[key] == null ? '' : String(draft[key]),
    onChangeText: (value: string) => set(key, parseDistance(value) as never),
    keyboardType: 'number-pad' as const,
    placeholder: t('housing.metresPlaceholder'),
    hint: draft[key] != null ? formatDistance(draft[key] as number) : undefined,
  });

  const entry = entries.find((e) => e.house.id === shownId);
  const benchmark = useMemo(
    () => benchmarkFor({ id: 0, ...draft }, communities.prices),
    [draft, communities.prices],
  );
  const metrics = useMemo(
    () =>
      houseMetrics(
        { id: shownId ?? 0, ...draft },
        {
          todayIso: currentDateISO(),
          prices: entry?.prices ?? [],
          benchmarkCents: benchmark?.benchmarkPriceCents ?? null,
        },
      ),
    [draft, entry, benchmark, shownId],
  );
  const price = draft.askingPriceCents;
  const marks = parseChecklist(draft.checklist);

  const setListingUrl = (url: string) => {
    const address = draft.address ? null : addressFromListingUrl(url);
    change({
      ...draft,
      listingUrl: url || null,
      ...(address
        ? {
            address,
            name: draft.name.trim() ? draft.name : address,
          }
        : {}),
    });
  };

  const confirmDelete = () => {
    if (savedId.current == null) return navigation.goBack();
    Alert.alert(t('housing.deleteTitle'), t('common.cannotBeUndone'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          pending.current = null;
          if (timer.current) clearTimeout(timer.current);
          await remove(savedId.current!);
          navigation.goBack();
        },
      },
    ]);
  };

  const daysUntil = (iso: string | null) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    const [ty, tm, td] = currentDateISO().split('-').map(Number);
    return Math.round(
      (Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
    );
  };
  const subjectsIn = daysUntil(draft.subjectRemovalDate);
  const completesIn = daysUntil(draft.completionDate);

  const optionalDate = (key: keyof HouseInput, label: TranslationKey) => {
    const value = draft[key] as string | null;
    return value ? (
      <View style={styles.dateRow}>
        <View style={styles.flex}>
          <DateField
            label={t(label)}
            value={value}
            onChange={(d) => set(key, d as never)}
          />
        </View>
        <Pressable hitSlop={8} onPress={() => set(key, null as never)}>
          <Text style={styles.clear}>✕</Text>
        </Pressable>
      </View>
    ) : (
      <Pressable
        style={styles.setDate}
        hitSlop={6}
        onPress={() => set(key, currentDateISO() as never)}
      >
        <Text style={styles.label}>{t(label)}</Text>
        <Text style={styles.link}>{t('housing.setDate')}</Text>
      </Pressable>
    );
  };

  return (
    <ScreenContainer scroll modal>
      <ExpandingFieldGroup>
        <View style={styles.header}>
          <Text style={styles.saved}>{t('housing.savesAsYouType')}</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.headerBtn}>{t('common.done')}</Text>
          </Pressable>
        </View>

        {/* What every house has. */}
        <View style={styles.hero}>
          <TextInput
            style={styles.nameInput}
            placeholder={t('housing.namePlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardAppearance="dark"
            autoFocus={houseId == null}
            {...text('name')}
          />
          <View style={styles.priceRow}>
            <Text style={styles.priceSymbol}>$</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="800,000"
              placeholderTextColor={colors.textMuted}
              keyboardAppearance="dark"
              {...money('askingPriceCents')}
            />
          </View>
          <Text style={styles.label}>{t('housing.totalPrice')}</Text>
          <View style={styles.chips}>
            {HOUSE_STATUSES.map((status) => {
              const on = draft.status === status;
              return (
                <Pressable
                  key={status}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => set('status', status)}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {t(statusKey(status))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.stars}>
            {RATINGS.map((n) => (
              <Pressable
                key={n}
                hitSlop={6}
                onPress={() => set('rating', draft.rating === n ? null : n)}
              >
                <Text style={styles.star}>
                  {(draft.rating ?? 0) >= n ? '★' : '☆'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* What sets it apart — derived, and only what's known. */}
        <Card title={t('housing.differsHeading')}>
          {metrics.fixedMonthlyCents != null ? (
            <ResultRow
              label={t('housing.fixedMonthly')}
              value={formatMoney(metrics.fixedMonthlyCents)}
              hint={t('housing.fixedMonthlyHint')}
              big
            />
          ) : null}
          {metrics.pricePerSqftCents != null ? (
            <ResultRow
              label={t('housing.pricePerSqft')}
              value={formatMoney(metrics.pricePerSqftCents)}
            />
          ) : null}
          {metrics.overBenchmark != null && benchmark ? (
            <ResultRow
              label={t('housing.vsBenchmark')}
              value={t(
                metrics.overBenchmark >= 1
                  ? 'housing.aboveBy'
                  : 'housing.belowBy',
                {
                  percent: Math.abs((metrics.overBenchmark - 1) * 100).toFixed(
                    1,
                  ),
                },
              )}
              hint={`${benchmark.community} · ${benchmark.asOfMonth} · ${formatMoney(benchmark.benchmarkPriceCents)}`}
              tone={metrics.overBenchmark > 1 ? 'negative' : 'positive'}
            />
          ) : null}
          {metrics.askingOverAssessed != null ? (
            <ResultRow
              label={t('housing.askingOverAssessed')}
              value={`${(metrics.askingOverAssessed * 100).toFixed(0)}%`}
              tone={metrics.askingOverAssessed > 1 ? 'negative' : 'positive'}
            />
          ) : null}
          {metrics.priceChangeCents != null ? (
            <ResultRow
              label={t('housing.priceChange')}
              value={`${metrics.priceChangeCents > 0 ? '+' : '−'}${formatMoney(Math.abs(metrics.priceChangeCents))} (${(metrics.priceChangeRatio! * 100).toFixed(1)}%)`}
              tone={metrics.priceChangeCents < 0 ? 'positive' : 'negative'}
            />
          ) : null}
          {metrics.daysOnMarket != null ? (
            <ResultRow
              label={t('housing.daysOnMarket')}
              value={String(metrics.daysOnMarket)}
            />
          ) : null}
          {metrics.ageYears != null ? (
            <ResultRow
              label={t('housing.age')}
              value={t('housing.ageYears', { years: metrics.ageYears })}
            />
          ) : null}
          {draft.checklist ? (
            <ResultRow
              label={t('housing.concerns')}
              value={String(metrics.concerns)}
              tone={metrics.concerns > 0 ? 'negative' : 'positive'}
            />
          ) : null}
          {(
            [
              ['busDistanceM', 'housing.bus'],
              ['trainDistanceM', 'housing.train'],
              ['schoolDistanceM', 'housing.school'],
              ['groceryDistanceM', 'housing.grocery'],
            ] as const
          ).map(([key, label]) =>
            draft[key] != null ? (
              <ResultRow
                key={key}
                label={t(label)}
                value={formatDistance(draft[key]!)}
              />
            ) : null,
          )}
          {price ? (
            <Pressable
              hitSlop={8}
              onPress={() =>
                navigation.navigate('MortgageInsights', {
                  priceCents: price,
                  name: draft.name || undefined,
                })
              }
            >
              <Text style={styles.link}>{t('housing.openCalculator')}</Text>
            </Pressable>
          ) : null}
        </Card>

        <FieldCard>
          <ExpandingSection
            label={t('housing.costsHeading')}
            summary={
              metrics.fixedMonthlyCents != null
                ? t('housing.perMonth', {
                    amount: formatMoney(metrics.fixedMonthlyCents),
                  })
                : ''
            }
          >
            <TextField
              label={t('housing.strataFee')}
              placeholder="0"
              {...money('strataFeeCents')}
            />
            <UnitAmountField
              label={t('housing.propertyTax')}
              unit={taxUnit}
              onUnitChange={(unit) => {
                setTaxUnit(unit);
                if (unit === 'percent' && price && draft.propertyTaxAnnualCents)
                  setTaxPercent(
                    ((draft.propertyTaxAnnualCents / price) * 100).toFixed(2),
                  );
              }}
              units={[
                { value: 'year', label: t('housing.perYearUnit') },
                { value: 'percent', label: '%' },
              ]}
              value={
                taxUnit === 'year'
                  ? dollars(draft.propertyTaxAnnualCents)
                  : taxPercent
              }
              onChangeText={(value) => {
                if (taxUnit === 'year') {
                  set('propertyTaxAnnualCents', centsFromDollars(value));
                  return;
                }
                setTaxPercent(value);
                const pct = Number.parseFloat(value);
                set(
                  'propertyTaxAnnualCents',
                  price && Number.isFinite(pct)
                    ? Math.round((price * pct) / 100)
                    : null,
                );
              }}
              keyboardType={taxUnit === 'year' ? 'number-pad' : 'decimal-pad'}
              placeholder={taxUnit === 'year' ? '4,800' : '0.6'}
            />
            {draft.propertyTaxAnnualCents && price ? (
              <Text style={styles.hint}>
                {taxUnit === 'year'
                  ? t('housing.taxIsPercent', {
                      percent: percentOf(draft.propertyTaxAnnualCents, price),
                    })
                  : t('housing.taxIsAmount', {
                      amount: formatMoney(draft.propertyTaxAnnualCents),
                    })}
              </Text>
            ) : null}
            <TextField
              label={t('housing.maintenance')}
              placeholder={
                price
                  ? dollars(Math.round((price * UPKEEP_SHARE_PER_YEAR) / 12))
                  : '300'
              }
              {...money('maintenanceMonthlyCents')}
            />
            {price && draft.maintenanceMonthlyCents == null ? (
              <Text style={styles.hint}>
                {t('housing.maintenanceHint')}{' '}
                <Text
                  style={styles.link}
                  onPress={() =>
                    set(
                      'maintenanceMonthlyCents',
                      Math.round((price * UPKEEP_SHARE_PER_YEAR) / 12 / 100) *
                        100,
                    )
                  }
                >
                  {t('housing.useEstimate')}
                </Text>
              </Text>
            ) : null}
            <TextField
              label={t('housing.assessedValue')}
              {...money('assessedValueCents')}
            />
          </ExpandingSection>

          <ExpandingSection
            label={t('housing.gettingAroundHeading')}
            summary={[
              draft.commuteMinutes != null
                ? t('housing.commuteShort', { minutes: draft.commuteMinutes })
                : null,
              draft.busDistanceM != null
                ? `${t('housing.busShort')} ${formatDistance(draft.busDistanceM)}`
                : null,
              draft.trainDistanceM != null
                ? `${t('housing.trainShort')} ${formatDistance(draft.trainDistanceM)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            <TextField
              label={t('housing.commuteMinutes')}
              {...number('commuteMinutes')}
            />
            <TextField
              label={t('housing.busDistance')}
              {...distance('busDistanceM')}
            />
            <TextField
              label={t('housing.trainDistance')}
              {...distance('trainDistanceM')}
            />
            <TextField
              label={t('housing.schoolDistance')}
              {...distance('schoolDistanceM')}
            />
            <TextField
              label={t('housing.groceryDistance')}
              {...distance('groceryDistanceM')}
            />
            <TextField
              label={t('housing.schoolCatchment')}
              {...text('schoolCatchment')}
            />
            <TextField label={t('housing.transit')} {...text('transit')} />
            <TextField
              label={t('housing.noise')}
              placeholder={t('housing.noisePlaceholder')}
              {...text('noise')}
            />
            <TextField
              label={t('housing.neighbourhood')}
              multiline
              style={styles.multiline}
              {...text('neighbourhood')}
            />
          </ExpandingSection>

          <ExpandingSection
            label={t('housing.buildingHeading')}
            summary={[
              draft.beds != null ? `${draft.beds}bd` : null,
              draft.baths != null ? `${draft.baths}ba` : null,
              draft.floorAreaSqft ? `${draft.floorAreaSqft} sqft` : null,
              draft.yearBuilt ? String(draft.yearBuilt) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            <TextField
              label={t('housing.propertyType')}
              placeholder={t('housing.propertyTypePlaceholder')}
              {...text('propertyType')}
            />
            <View style={styles.pair}>
              <View style={styles.flex}>
                <TextField label={t('housing.beds')} {...number('beds')} />
              </View>
              <View style={styles.flex}>
                <TextField label={t('housing.baths')} {...number('baths')} />
              </View>
            </View>
            <View style={styles.pair}>
              <View style={styles.flex}>
                <TextField
                  label={t('housing.floorArea')}
                  {...number('floorAreaSqft')}
                />
              </View>
              <View style={styles.flex}>
                <TextField
                  label={t('housing.lotSize')}
                  {...number('lotSqft')}
                />
              </View>
            </View>
            <View style={styles.pair}>
              <View style={styles.flex}>
                <TextField
                  label={t('housing.yearBuilt')}
                  {...number('yearBuilt')}
                />
              </View>
              <View style={styles.flex}>
                <TextField label={t('housing.levels')} {...number('levels')} />
              </View>
            </View>
            <TextField label={t('housing.parking')} {...text('parking')} />
            <TextField
              label={t('housing.orientation')}
              placeholder={t('housing.orientationPlaceholder')}
              {...text('orientation')}
            />
          </ExpandingSection>

          <ExpandingSection
            label={t('housing.conditionHeading')}
            summary={
              draft.checklist
                ? t('housing.concernsSummary', { count: metrics.concerns })
                : ''
            }
          >
            <Text style={styles.hint}>{t('housing.checklistHint')}</Text>
            <View style={styles.checklist}>
              {CHECKLIST_ITEMS.map((item) => {
                const mark = marks[item];
                return (
                  <Pressable
                    key={item}
                    style={[
                      styles.check,
                      mark === 'ok' && styles.checkOk,
                      mark === 'concern' && styles.checkConcern,
                    ]}
                    onPress={() =>
                      set('checklist', cycleMark(draft.checklist, item))
                    }
                  >
                    <Text style={styles.checkText}>
                      {mark === 'ok' ? '✓ ' : mark === 'concern' ? '! ' : ''}
                      {t(`houseCheck.${item}` as TranslationKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.pair}>
              <View style={styles.flex}>
                <TextField
                  label={t('housing.roofAge')}
                  {...number('roofAgeYears')}
                />
              </View>
              <View style={styles.flex}>
                <TextField
                  label={t('housing.furnaceAge')}
                  {...number('furnaceAgeYears')}
                />
              </View>
            </View>
            <TextField
              label={t('housing.waterTankAge')}
              {...number('waterTankAgeYears')}
            />
            <TextField
              label={t('housing.renovations')}
              multiline
              style={styles.multiline}
              {...text('renovations')}
            />
            <TextField
              label={t('housing.issues')}
              multiline
              style={styles.multiline}
              {...text('issues')}
            />
          </ExpandingSection>

          <ExpandingSection
            label={t('housing.offerHeading')}
            summary={
              draft.offerPriceCents
                ? [
                    formatMoney(draft.offerPriceCents),
                    subjectsIn != null && subjectsIn >= 0
                      ? t('housing.subjectsIn', { days: subjectsIn })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : ''
            }
          >
            <TextField
              label={t('housing.offerPrice')}
              {...money('offerPriceCents')}
            />
            {draft.offerPriceCents && price ? (
              <Text style={styles.hint}>
                {t('housing.offerVsAsking', {
                  percent: percentOf(draft.offerPriceCents, price),
                })}
              </Text>
            ) : null}
            <TextField
              label={t('housing.deposit')}
              {...money('depositCents')}
            />
            {optionalDate('subjectRemovalDate', 'housing.subjectRemoval')}
            {subjectsIn != null ? (
              <Text style={[styles.hint, subjectsIn <= 3 && styles.warn]}>
                {subjectsIn >= 0
                  ? t('housing.subjectsIn', { days: subjectsIn })
                  : t('housing.subjectsPassed')}
              </Text>
            ) : null}
            {optionalDate('completionDate', 'housing.completion')}
            {completesIn != null && completesIn >= 0 ? (
              <Text style={styles.hint}>
                {t('housing.completesIn', { days: completesIn })}
              </Text>
            ) : null}
          </ExpandingSection>

          <ExpandingSection
            label={t('housing.listingHeading')}
            summary={draft.address ?? draft.community ?? ''}
          >
            <TextField
              label={t('housing.listingUrl')}
              autoCapitalize="none"
              keyboardType="url"
              value={draft.listingUrl ?? ''}
              onChangeText={setListingUrl}
              hint={t('housing.listingUrlHint')}
            />
            {draft.listingUrl ? (
              <Pressable
                hitSlop={8}
                onPress={() => Linking.openURL(draft.listingUrl as string)}
              >
                <Text style={styles.link}>{t('housing.openListing')}</Text>
              </Pressable>
            ) : null}
            <TextField label={t('housing.address')} {...text('address')} />
            <View style={styles.pair}>
              <View style={styles.flex}>
                <TextField label={t('housing.city')} {...text('city')} />
              </View>
              <View style={styles.flex}>
                <TextField
                  label={t('housing.community')}
                  placeholder={t('housing.communityPlaceholder')}
                  {...text('community')}
                />
              </View>
            </View>
            {optionalDate('listedOn', 'housing.listedOn')}
            {optionalDate('viewedOn', 'housing.viewedOn')}
          </ExpandingSection>

          <ExpandingSection
            label={t('housing.priceHistoryHeading')}
            summary={
              entry && entry.prices.length > 1
                ? t('housing.priceChanges', { count: entry.prices.length - 1 })
                : ''
            }
          >
            <Text style={styles.hint}>{t('housing.priceHistoryHint')}</Text>
            {(entry?.prices ?? []).map((p, i, all) => {
              const prev = all[i - 1];
              const delta = prev ? p.priceCents - prev.priceCents : 0;
              return (
                <Pressable
                  key={p.id}
                  style={styles.historyRow}
                  onLongPress={async () => {
                    await housesRepo.deleteHousePrice(await getDb(), p.id);
                    bumpDataVersion();
                  }}
                >
                  <Text style={styles.hint}>{formatDateLabel(p.date)}</Text>
                  <Text style={styles.historyPrice}>
                    {formatMoney(p.priceCents)}
                    {delta !== 0 ? (
                      <Text
                        style={delta < 0 ? styles.down : styles.up}
                      >{`  ${delta > 0 ? '+' : '−'}${formatMoney(Math.abs(delta))}`}</Text>
                    ) : null}
                  </Text>
                </Pressable>
              );
            })}
          </ExpandingSection>

          <ExpandingSection
            label={t('housing.verdictHeading')}
            summary={draft.pros ? draft.pros.split('\n')[0] : ''}
          >
            <TextField
              label={t('housing.pros')}
              multiline
              style={styles.multiline}
              {...text('pros')}
            />
            <TextField
              label={t('housing.cons')}
              multiline
              style={styles.multiline}
              {...text('cons')}
            />
            <TextField
              label={t('housing.notes')}
              multiline
              style={styles.multiline}
              {...text('notes')}
            />
          </ExpandingSection>
        </FieldCard>

        <Pressable style={styles.deleteRow} onPress={confirmDelete}>
          <Text style={styles.delete}>{t('housing.deleteHouse')}</Text>
        </Pressable>
      </ExpandingFieldGroup>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  saved: { fontSize: 12, color: colors.textMuted },
  headerBtn: { fontSize: 16, fontWeight: '700', color: colors.accent },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.sm,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    padding: 0,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceSymbol: { fontSize: 30, fontWeight: '700', color: colors.textMuted },
  priceInput: {
    flex: 1,
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.tint },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipTextOn: { color: colors.accent },
  stars: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 24, color: colors.accent },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  link: { fontSize: 13, fontWeight: '700', color: colors.accent },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  warn: { color: colors.negative, fontWeight: '700' },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  pair: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  clear: { fontSize: 16, color: colors.textMuted, paddingBottom: 12 },
  setDate: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  checklist: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  check: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  checkOk: { borderColor: colors.positive },
  checkConcern: {
    borderColor: colors.negative,
    backgroundColor: colors.background,
  },
  checkText: { fontSize: 13, color: colors.text },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  historyPrice: {
    fontSize: 13,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  down: { color: colors.positive },
  up: { color: colors.negative },
  deleteRow: { alignItems: 'center', paddingVertical: spacing.md },
  delete: { fontSize: 15, fontWeight: '700', color: colors.negative },
});
