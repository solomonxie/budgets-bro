import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Card } from '../../components/ui/Card';
import { ResultRow } from '../../components/ui/ResultRow';
import { TextField } from '../../components/ui/TextField';
import { DropdownField, DropdownOption } from '../../components/ui/DropdownField';
import { ExpandingFieldGroup } from '../../components/ui/ExpandingField';
import { ExpandingSection } from '../../components/ui/ExpandingSection';
import { GuideSection } from '../../components/ui/GuideSection';
import { getDb } from '../../db/client';
import * as housesRepo from '../../db/repositories/housesRepo';
import { HOUSE_STATUSES, emptyHouse } from '../../db/repositories/housesRepo';
import type { House, HouseInput, HouseStatus } from '../../db/repositories/housesRepo';
import { useHouses } from '../../hooks/useHouses';
import { DEFAULT_ASSUMPTIONS, houseMetrics } from '../../domain/houseMetrics';
import { formatMoney, parseMoneyToCents } from '../../domain/money';
import { statusKey } from './HousingInsightsScreen';
import { useT } from '../../i18n';
import type { InsightsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Route = RouteProp<InsightsStackParamList, 'HouseDetail'>;
type Nav = NativeStackNavigationProp<InsightsStackParamList>;

const RATINGS = [1, 2, 3, 4, 5];

// Everything a viewing turns up, in one editable record. Nothing is
// required but the name: a house gets added from the car park with three
// facts, and the rest arrives over the following week. Fields past the
// first card live in folded sections, because a form that asks forty
// questions at once is a form nobody finishes.
export function HouseDetailScreen() {
  const t = useT();
  const navigation = useNavigation<Nav>();
  const houseId = useRoute<Route>().params?.houseId ?? null;
  const { add, update, remove } = useHouses();
  const [draft, setDraft] = useState<HouseInput>(emptyHouse());
  const [savedId, setSavedId] = useState<number | null>(houseId);

  useEffect(() => {
    (async () => {
      if (houseId == null) return;
      const db = await getDb();
      const found = await housesRepo.getHouse(db, houseId);
      if (found) {
        const { id: _id, ...rest } = found as House;
        setDraft(rest);
      }
    })();
  }, [houseId]);

  const set = <K extends keyof HouseInput>(key: K, value: HouseInput[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const money = (key: keyof HouseInput) => ({
    value:
      draft[key] == null ? '' : String(((draft[key] as number) ?? 0) / 100),
    onChangeText: (text: string) =>
      set(key, (text.trim() === '' ? null : parseMoneyToCents(text)) as never),
  });

  const number = (key: keyof HouseInput) => ({
    value: draft[key] == null ? '' : String(draft[key]),
    onChangeText: (text: string) => {
      const parsed = Number.parseFloat(text);
      set(key, (text.trim() === '' || !Number.isFinite(parsed) ? null : parsed) as never);
    },
  });

  const text = (key: keyof HouseInput) => ({
    value: (draft[key] as string | null) ?? '',
    onChangeText: (value: string) => set(key, (value || null) as never),
  });

  const metrics = useMemo(
    () =>
      houseMetrics(
        { id: savedId ?? 0, ...draft },
        DEFAULT_ASSUMPTIONS,
        new Date().getFullYear(),
      ),
    [draft, savedId],
  );

  const save = async () => {
    if (!draft.name.trim()) {
      set('name', t('housing.untitled') as never);
    }
    const input = { ...draft, name: draft.name.trim() || t('housing.untitled') };
    if (savedId == null) {
      const id = await add(input);
      setSavedId(id);
    } else {
      await update(savedId, input);
    }
    navigation.goBack();
  };

  const confirmDelete = () => {
    if (savedId == null) return;
    Alert.alert(t('housing.deleteTitle'), t('common.cannotBeUndone'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await remove(savedId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <ScreenContainer scroll modal>
      <ExpandingFieldGroup>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.headerBtn}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable onPress={save} hitSlop={8}>
            <Text style={[styles.headerBtn, styles.save]}>{t('common.save')}</Text>
          </Pressable>
        </View>

        <Card title={t('housing.identityHeading')}>
          <TextField
            label={t('housing.name')}
            placeholder={t('housing.namePlaceholder')}
            {...text('name')}
          />
          <TextField label={t('housing.address')} {...text('address')} />
          <TextField label={t('housing.city')} {...text('city')} />
          <TextField
            label={t('housing.community')}
            placeholder={t('housing.communityPlaceholder')}
            {...text('community')}
          />
          <TextField
            label={t('housing.listingUrl')}
            autoCapitalize="none"
            {...text('listingUrl')}
          />
          {draft.listingUrl ? (
            <Pressable
              hitSlop={8}
              onPress={() => Linking.openURL(draft.listingUrl as string)}
            >
              <Text style={styles.link}>{t('housing.openListing')}</Text>
            </Pressable>
          ) : null}
          <DropdownField
            compact
            label={t('housing.status')}
            valueLabel={t(statusKey(draft.status))}
          >
            {(close) => (
              <>
                {HOUSE_STATUSES.map((status: HouseStatus) => (
                  <DropdownOption
                    key={status}
                    label={t(statusKey(status))}
                    selected={draft.status === status}
                    onPress={() => {
                      set('status', status);
                      close();
                    }}
                  />
                ))}
              </>
            )}
          </DropdownField>
          <View style={styles.ratingRow}>
            <Text style={styles.label}>{t('housing.rating')}</Text>
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
          <TextField
            label={t('housing.viewedOn')}
            placeholder="YYYY-MM-DD"
            {...text('viewedOn')}
          />
        </Card>

        <Card title={t('housing.priceHeading')}>
          <TextField
            label={t('housing.askingPrice')}
            keyboardType="decimal-pad"
            {...money('askingPriceCents')}
          />
          <TextField
            label={t('housing.assessedValue')}
            keyboardType="decimal-pad"
            {...money('assessedValueCents')}
          />
          <TextField
            label={t('housing.strataFee')}
            keyboardType="decimal-pad"
            {...money('strataFeeCents')}
          />
          <TextField
            label={t('housing.propertyTaxAnnual')}
            keyboardType="decimal-pad"
            {...money('propertyTaxAnnualCents')}
          />
        </Card>

        <Card title={t('housing.derivedHeading')}>
          <ResultRow
            label={t('housing.carryingMonthly')}
            value={
              metrics.carryingMonthlyCents != null
                ? formatMoney(metrics.carryingMonthlyCents)
                : '—'
            }
            big
          />
          <ResultRow
            label={t('housing.mortgagePayment')}
            value={
              metrics.paymentMonthlyCents != null
                ? formatMoney(metrics.paymentMonthlyCents)
                : '—'
            }
          />
          <ResultRow
            label={t('housing.downPayment')}
            value={
              metrics.downPaymentCents != null
                ? formatMoney(metrics.downPaymentCents)
                : '—'
            }
          />
          <ResultRow
            label={t('housing.pricePerSqft')}
            value={
              metrics.pricePerSqftCents != null
                ? formatMoney(metrics.pricePerSqftCents)
                : '—'
            }
          />
          {metrics.askingOverAssessed != null ? (
            <ResultRow
              label={t('housing.askingOverAssessed')}
              value={`${(metrics.askingOverAssessed * 100).toFixed(0)}%`}
              tone={metrics.askingOverAssessed > 1 ? 'negative' : 'positive'}
            />
          ) : null}
          {metrics.ageYears != null ? (
            <ResultRow
              label={t('housing.age')}
              value={t('housing.ageYears', { years: metrics.ageYears })}
            />
          ) : null}
          <Pressable
            hitSlop={8}
            onPress={() =>
              navigation.navigate('FinanceTool', { tool: 'canadaPurchase' })
            }
          >
            <Text style={styles.link}>{t('housing.openCalculator')}</Text>
          </Pressable>
          <Text style={styles.muted}>{t('housing.derivedNote')}</Text>
        </Card>

        <ExpandingSection
          label={t('housing.buildingHeading')}
          summary={
            [
              draft.beds != null ? `${draft.beds}bd` : null,
              draft.baths != null ? `${draft.baths}ba` : null,
              draft.floorAreaSqft ? `${draft.floorAreaSqft} sqft` : null,
            ]
              .filter(Boolean)
              .join(' · ') || ''
          }
        >
          <TextField
            label={t('housing.propertyType')}
            placeholder={t('housing.propertyTypePlaceholder')}
            {...text('propertyType')}
          />
          <TextField label={t('housing.beds')} keyboardType="decimal-pad" {...number('beds')} />
          <TextField label={t('housing.baths')} keyboardType="decimal-pad" {...number('baths')} />
          <TextField
            label={t('housing.floorArea')}
            keyboardType="number-pad"
            {...number('floorAreaSqft')}
          />
          <TextField
            label={t('housing.lotSize')}
            keyboardType="number-pad"
            {...number('lotSqft')}
          />
          <TextField label={t('housing.levels')} keyboardType="number-pad" {...number('levels')} />
          <TextField
            label={t('housing.yearBuilt')}
            keyboardType="number-pad"
            {...number('yearBuilt')}
          />
          <TextField label={t('housing.parking')} {...text('parking')} />
          <TextField
            label={t('housing.orientation')}
            placeholder={t('housing.orientationPlaceholder')}
            {...text('orientation')}
          />
        </ExpandingSection>

        <ExpandingSection
          label={t('housing.conditionHeading')}
          summary={draft.issues ? t('housing.hasIssues') : ''}
        >
          <TextField
            label={t('housing.roofAge')}
            keyboardType="number-pad"
            {...number('roofAgeYears')}
          />
          <TextField
            label={t('housing.furnaceAge')}
            keyboardType="number-pad"
            {...number('furnaceAgeYears')}
          />
          <TextField
            label={t('housing.waterTankAge')}
            keyboardType="number-pad"
            {...number('waterTankAgeYears')}
          />
          <TextField label={t('housing.windows')} {...text('windows')} />
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
          label={t('housing.locationHeading')}
          summary={draft.schoolCatchment ?? ''}
        >
          <TextField
            label={t('housing.schoolCatchment')}
            {...text('schoolCatchment')}
          />
          <TextField
            label={t('housing.commuteMinutes')}
            keyboardType="number-pad"
            {...number('commuteMinutes')}
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

        {savedId != null ? (
          <Pressable style={styles.deleteRow} onPress={confirmDelete}>
            <Text style={styles.delete}>{t('housing.deleteHouse')}</Text>
          </Pressable>
        ) : null}

        <GuideSection
          heading={t('housing.detailGuideHeading')}
          body={t('housing.detailGuideBody')}
        />
      </ExpandingFieldGroup>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  headerBtn: { fontSize: 15, fontWeight: '600', color: colors.accent },
  save: { fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stars: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 22, color: colors.accent },
  link: { fontSize: 13, fontWeight: '700', color: colors.accent },
  muted: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  deleteRow: { alignItems: 'center', paddingVertical: spacing.md },
  delete: { fontSize: 15, fontWeight: '700', color: colors.negative },
});
