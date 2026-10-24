import { useEffect, useMemo, useRef } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ExperimentalBanner } from '../../components/ui/ExperimentalBanner';
import { CalcFormProvider } from './calcForm';
import { MortgagePlanView } from './mortgage/MortgagePlanView';
import type { HeldMortgage } from './mortgage/MortgagePlanView';
import { heldTerms } from './mortgage/heldTerms';
import { loadHeldHistory } from './mortgage/useHeldHistory';
import {
  accountProfileId,
  formKey,
  useSimulationProfiles,
} from './mortgage/profiles';
import { getDb } from '../../db/client';
import type { Compounding } from '../../finance-tools/canadianMortgage';
import { monthlySchedule } from '../../finance-tools/mortgagePlan';
import * as settingsRepo from '../../db/repositories/settingsRepo';
import { useAccounts } from '../../hooks/useAccounts';
import { useAccountValues } from '../../hooks/useAccountValues';
import { useCurrentRates } from '../../hooks/useCurrentRates';
import { useT } from '../../i18n';
import type { InsightsStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// The first plan picks up whatever was typed into the Home purchase tool
// this page replaced. A down payment over 100 was always dollars.
async function legacyPurchaseInputs(): Promise<Record<string, string> | null> {
  const db = await getDb();
  const old = await settingsRepo.getJsonSetting<Record<string, string> | null>(
    db,
    'calc_form:canadaPurchase',
    null,
  );
  if (!old) return null;
  const down = Number((old.down ?? '').replace(/[^\d.]/g, ''));
  return { ...old, '@downUnit': down > 100 ? 'amount' : 'percent' };
}

// Every mortgage question on one page. Plans are tabs along the top: each
// real mortgage account is one (filled from the account, never deleted),
// then any number of what-ifs, each saving as it's typed.
export function MortgageInsightsScreen() {
  const t = useT();
  const route =
    useRoute<RouteProp<InsightsStackParamList, 'MortgageInsights'>>();
  const { accounts } = useAccounts();
  const { ratesByAccountId } = useCurrentRates();
  const { valuesByAccountId } = useAccountValues();
  const sims = useSimulationProfiles((n) => t('mortgagePlan.planName', { n }));

  const held = useMemo(
    () =>
      accounts
        .filter(
          (a) => a.account.type === 'mortgage' && a.account.archivedAt == null,
        )
        .map<HeldMortgage & { id: string }>((entry) => ({
          id: accountProfileId(entry.account.id),
          entry,
          rateBps: ratesByAccountId.get(entry.account.id) ?? null,
          homeValueCents:
            valuesByAccountId.get(entry.account.id) ??
            entry.account.originalHousePriceCents,
        })),
    [accounts, ratesByAccountId, valuesByAccountId],
  );

  // Opened from a house on the shortlist: a new plan at that price.
  const startedFrom = useRef<number | null>(null);
  const priceParam = route.params?.priceCents;
  useEffect(() => {
    if (
      !sims.profiles ||
      priceParam == null ||
      startedFrom.current === priceParam
    )
      return;
    startedFrom.current = priceParam;
    sims.add({
      values: { price: Math.round(priceParam / 100).toLocaleString('en-US') },
      name: route.params?.name,
    });
  }, [sims, priceParam, route.params?.name]);

  if (!sims.profiles) return null;

  const tabs = [
    ...held.map((h) => ({ id: h.id, name: h.entry.account.name, held: h })),
    ...sims.profiles.map((p) => ({ id: p.id, name: p.name, held: undefined })),
  ];
  const active = tabs.find((tab) => tab.id === sims.activeId) ?? tabs[0];
  const firstSimId = sims.profiles[0]?.id;

  const confirmRemove = (id: string, name: string) =>
    Alert.alert(
      t('mortgagePlan.deleteTitle', { name }),
      t('mortgagePlan.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => sims.remove(id),
        },
      ],
    );
  const canDelete = sims.profiles.length > 1;

  // A real mortgage as a what-if: the home at its value, what's owed as
  // the loan, the same rate, payment and extras — then change anything.
  const duplicateHeld = async (h: HeldMortgage & { id: string }) => {
    const db = await getDb();
    const [saved, history] = await Promise.all([
      settingsRepo.getJsonSetting<Record<string, string>>(
        db,
        `calc_form:${formKey(h.id)}`,
        {},
      ),
      loadHeldHistory(h.entry.account.id),
    ]);
    const compounding = (saved['@compounding'] ?? 'semiAnnual') as Compounding;
    const { owed, rateBps, payment } = heldTerms(
      h.entry,
      h.rateBps ?? Math.round(Number(saved.rate ?? '0') * 100),
      compounding,
      history.usualPaymentCents,
    );
    const rows = monthlySchedule(owed, rateBps, compounding, payment);
    const paysOff = rows.length > 0 && rows[rows.length - 1].balanceCents === 0;
    const months = paysOff ? rows.length : 300;
    const priceCents = h.homeValueCents ?? Math.round(owed / 0.8);
    const dollars = (cents: number) =>
      Math.round(cents / 100).toLocaleString('en-US');
    sims.add({
      name: t('mortgagePlan.copyOf', { name: h.entry.account.name }),
      values: {
        ...saved,
        price: dollars(priceCents),
        '@downUnit': 'amount',
        down: dollars(Math.max(0, priceCents - owed)),
        rate: String(rateBps / 100),
        years: String(Math.max(1, Math.round(months / 12))),
      },
    });
  };

  const manageHeld = (h: HeldMortgage & { id: string }) => {
    const options = [
      t('mortgagePlan.duplicateAsSimulation'),
      t('common.cancel'),
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: h.entry.account.name, options, cancelButtonIndex: 1 },
      (i) => {
        if (i === 0) duplicateHeld(h);
      },
    );
  };

  const manage = (id: string, name: string) => {
    const rename = () =>
      Alert.prompt(
        t('common.rename'),
        undefined,
        (text) => text?.trim() && sims.rename(id, text.trim()),
        'plain-text',
        name,
      );
    const options = [
      t('common.rename'),
      t('mortgagePlan.duplicate'),
      ...(canDelete ? [t('common.delete')] : []),
      t('common.cancel'),
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: name,
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: canDelete ? 2 : undefined,
      },
      (i) => {
        if (i === 0) rename();
        else if (i === 1)
          sims.add({
            copyFromFormKey: formKey(id),
            name: t('mortgagePlan.copyOf', { name }),
          });
        else if (canDelete && i === 2) confirmRemove(id, name);
      },
    );
  };

  return (
    <CalcFormProvider
      key={active.id}
      toolId={formKey(active.id)}
      seed={active.id === firstSimId ? legacyPurchaseInputs : undefined}
    >
      <MortgagePlanView
        held={active.held}
        top={
          <>
            <ExperimentalBanner />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabs}
            >
              {tabs.map((tab) => {
                const on = tab.id === active.id;
                const menu = () =>
                  tab.held ? manageHeld(tab.held) : manage(tab.id, tab.name);
                return (
                  <Pressable
                    key={tab.id}
                    style={[styles.tab, on && styles.tabOn]}
                    onPress={() => (on ? menu() : sims.open(tab.id))}
                    onLongPress={menu}
                  >
                    <Text
                      style={[styles.tabText, on && styles.tabTextOn]}
                      numberOfLines={1}
                    >
                      {tab.held ? '🏠 ' : ''}
                      {tab.name}
                      {on ? '  ⋯' : ''}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable style={styles.tab} onPress={() => sims.add()}>
                <Text style={styles.addText}>{t('mortgagePlan.newPlan')}</Text>
              </Pressable>
            </ScrollView>
            <Text style={styles.tabHint}>
              {t(
                active.held
                  ? 'mortgagePlan.tabHintHeld'
                  : 'mortgagePlan.tabHint',
              )}
            </Text>
          </>
        }
        footer={
          active.held || !canDelete ? null : (
            <View style={styles.footer}>
              <Pressable
                style={({ pressed }) => [
                  styles.delete,
                  pressed && styles.pressed,
                ]}
                onPress={() => confirmRemove(active.id, active.name)}
              >
                <Text style={styles.deleteText}>
                  {t('mortgagePlan.deleteSimulation')}
                </Text>
              </Pressable>
            </View>
          )
        }
      />
    </CalcFormProvider>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: spacing.sm, paddingVertical: spacing.xs },
  tab: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    maxWidth: 200,
  },
  tabOn: { borderColor: colors.accent, backgroundColor: colors.tint },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextOn: { color: colors.accent },
  addText: { fontSize: 14, fontWeight: '700', color: colors.accent },
  tabHint: { fontSize: 11, color: colors.textMuted },
  footer: { gap: spacing.xs, marginTop: spacing.xl, alignItems: 'center' },
  delete: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.negative,
  },
  deleteText: { fontSize: 15, fontWeight: '700', color: colors.text },
  pressed: { opacity: 0.8 },
});
