import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ExperimentalBanner } from '../../components/ui/ExperimentalBanner';
import { GuideSection } from '../../components/ui/GuideSection';
import { MoneyField } from '../../components/ui/MoneyField';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { DropdownOption } from '../../components/ui/DropdownField';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { getDb } from '../../db/client';
import * as settingsRepo from '../../db/repositories/settingsRepo';
import * as reportsRepo from '../../db/repositories/reportsRepo';
import * as accountValueHistoryRepo from '../../db/repositories/accountValueHistoryRepo';
import { accountKind } from '../../domain/accountKind';
import { formatMoney } from '../../domain/money';
import type { TrackingKind } from '../../domain/types';
import { useAppStore } from '../../state/useAppStore';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ExpandingFieldGroup } from '../../components/ui/ExpandingField';
import {
  estimateRefund,
  FHSA_ANNUAL_LIMIT,
  forYear,
  grossFromNet,
  rrspRoomEstimate,
  US_401K_LIMIT,
  US_IRA_LIMIT,
} from '../../finance-tools/canadaIncomeTax';

const CANADA_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];
const DONATION_CATEGORY_PATTERN = /charit|donat|giving/i;
// Plans whose contributions come off taxable income.
type DeductibleKind = 'ca_rrsp' | 'ca_fhsa' | 'us_401k' | 'us_ira';
const DEDUCTIBLE_KINDS: DeductibleKind[] = [
  'ca_rrsp',
  'ca_fhsa',
  'us_401k',
  'us_ira',
];
// An account left as a general tracking account still counts when its name
// says what it is.
const KIND_BY_NAME: [RegExp, DeductibleKind][] = [
  [/rrsp/i, 'ca_rrsp'],
  [/fhsa/i, 'ca_fhsa'],
  [/401\(?k\)?/i, 'us_401k'],
  [/\bira\b/i, 'us_ira'],
];
function deductibleKind(
  kind: TrackingKind | null,
  name: string,
): DeductibleKind | null {
  if (kind != null && kind !== 'general')
    return (DEDUCTIBLE_KINDS as string[]).includes(kind)
      ? (kind as DeductibleKind)
      : null;
  if (/roth/i.test(name)) return null;
  return KIND_BY_NAME.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}
// Sheltered: growth inside isn't taxed as it happens.
const isRegistered = (kind: TrackingKind | null, name: string) =>
  (kind != null && kind !== 'general') || deductibleKind(kind, name) != null;

const provinceKey = (boardId: number) => `taxInsights.province:${boardId}`;
// The room from your notice of assessment, per plan and tax year. Optional:
// without it the room is estimated (see autoRoomCents).
const roomKey = (boardId: number, year: string) =>
  `taxInsights.contributionRoom:${boardId}:${year}`;
// Its own setting, deliberately not shared with Baby Steps' Step 7 —
// picking "which categories mean X" here shouldn't require a trip to a
// different screen, and the two don't have to agree on what "giving" means.
const donationCategoriesKey = (boardId: number) =>
  `taxInsights.donationCategoryIds:${boardId}`;
// Which payees are real income, not a merchant's refund. Unset: all of them.
const incomePayeesKey = (boardId: number) =>
  `taxInsights.incomePayeeIds:${boardId}`;
// The optional "Anything else?" figures, per tax year.
const extrasKey = (boardId: number, year: string) =>
  `taxInsights.extras:${boardId}:${year}`;
interface Extras {
  grossPay?: string;
  otherIncome?: string;
  otherDeductions?: string;
}

const dollars = (cents: number) => cents / 100;
const cents = (dollarAmount: number) => Math.round(dollarAmount * 100);

function dayAfter(iso: string): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function toCents(text: string): number {
  const parsed = parseFloat(text);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// April 30 of `filingYear`, pushed to the following Monday if it lands on
// a weekend — CRA's actual rule for the general filing deadline.
function craFilingDeadline(filingYear: number): Date {
  const date = new Date(Date.UTC(filingYear, 3, 30));
  const weekday = date.getUTCDay();
  if (weekday === 6) date.setUTCDate(date.getUTCDate() + 2);
  else if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

// First 60 days of `filingYear` — the RRSP contribution window for the
// prior tax year.
function rrspDeadline(filingYear: number): Date {
  const date = new Date(Date.UTC(filingYear, 0, 1));
  date.setUTCDate(date.getUTCDate() + 59);
  return date;
}

// Last day of February of `filingYear` — when T4/T4A/T5 slips are usually
// issued.
function slipsReadyBy(filingYear: number): Date {
  return new Date(Date.UTC(filingYear, 2, 0));
}

function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

// Rough, local-only estimate from this year's ledger — not tax advice.
// Everything is derived from data already kept; the only pick is the
// province, and every typed figure is an optional correction.
export function TaxInsightsScreen() {
  const t = useT();
  const month = useAppStore((s) => s.currentMonth);
  const boardId = useAppStore((s) => s.currentBoardId);
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const year = month.slice(0, 4);

  const [incomeSources, setIncomeSources] = useState<
    reportsRepo.IncomeSource[]
  >([]);
  const [lastYearSources, setLastYearSources] = useState<
    reportsRepo.IncomeSource[]
  >([]);
  const [incomePayeeIds, setIncomePayeeIds] = useState<
    (number | null)[] | null
  >(null);
  const [province, setProvince] = useState<string | null>(null);
  const [interestEarnedCents, setInterestEarnedCents] = useState(0);
  const [donationCategoryIds, setDonationCategoryIds] = useState<number[]>([]);
  const [donationCents, setDonationCents] = useState(0);
  const [contributions, setContributions] = useState<
    { accountId: number; name: string; kind: DeductibleKind; cents: number }[]
  >([]);
  const [room, setRoom] = useState<Partial<Record<DeductibleKind, string>>>({});
  const [trackingGains, setTrackingGains] = useState<
    {
      accountId: number;
      name: string;
      gainCents: number;
      sinceDate: string | null;
    }[]
  >([]);
  const [extras, setExtras] = useState<Extras>({});
  const [extrasOpen, setExtrasOpen] = useState(false);

  const [provincePickerOpen, setProvincePickerOpen] = useState(false);
  const [donationPickerOpen, setDonationPickerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      setLastYearSources(
        await reportsRepo.incomeByPayeeInRange(
          db,
          boardId,
          `${Number(year) - 1}-01-01`,
          `${year}-01-01`,
        ),
      );
      setExtras(
        await settingsRepo.getJsonSetting(db, extrasKey(boardId, year), {}),
      );
      setIncomeSources(
        await reportsRepo.incomeByPayeeInRange(
          db,
          boardId,
          `${year}-01-01`,
          `${Number(year) + 1}-01-01`,
        ),
      );

      const incomeRaw = await settingsRepo.getSetting(
        db,
        incomePayeesKey(boardId),
      );
      setIncomePayeeIds(incomeRaw != null ? JSON.parse(incomeRaw) : null);

      setProvince(await settingsRepo.getSetting(db, provinceKey(boardId)));

      const donationRaw = await settingsRepo.getSetting(
        db,
        donationCategoriesKey(boardId),
      );
      if (donationRaw != null) {
        setDonationCategoryIds(JSON.parse(donationRaw));
      } else if (categories.length > 0) {
        const detected = categories
          .filter((c) => DONATION_CATEGORY_PATTERN.test(c.name))
          .map((c) => c.id);
        setDonationCategoryIds(detected);
        await settingsRepo.setJsonSetting(
          db,
          donationCategoriesKey(boardId),
          detected,
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, year, categories.length]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      setInterestEarnedCents(
        await reportsRepo.estimatedInterestInRange(
          db,
          boardId,
          `${year}-01-01`,
          `${Number(year) + 1}-01-01`,
        ),
      );
    })();
  }, [boardId, year]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const givingIds = accounts
        .filter((a) => a.account.type === 'giving')
        .map((a) => a.account.id);
      const [spentCents, setAsideCents] = await Promise.all([
        reportsRepo.categorySpendingInRange(
          db,
          boardId,
          donationCategoryIds,
          `${year}-01-01`,
          `${Number(year) + 1}-01-01`,
        ),
        reportsRepo.depositsIntoAccountsInRange(
          db,
          boardId,
          givingIds,
          `${year}-01-01`,
          `${Number(year) + 1}-01-01`,
        ),
      ]);
      setDonationCents(spentCents + setAsideCents);
    })();
  }, [boardId, year, donationCategoryIds, accounts]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const plans = accounts.flatMap((a) => {
        const kind =
          a.account.type === 'tracking'
            ? deductibleKind(a.account.trackingKind, a.account.name)
            : null;
        return kind ? [{ ...a, kind }] : [];
      });
      setRoom(
        await settingsRepo.getJsonSetting(db, roomKey(boardId, year), {}),
      );
      const deposits = await reportsRepo.depositsByAccountInRange(
        db,
        boardId,
        plans.map((a) => a.account.id),
        `${year}-01-01`,
        `${Number(year) + 1}-01-01`,
      );
      setContributions(
        plans.map((a) => ({
          accountId: a.account.id,
          name: a.account.name,
          kind: a.kind,
          cents: deposits.get(a.account.id) ?? 0,
        })),
      );
    })();
  }, [boardId, year, accounts]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const trackingAccounts = accounts.filter(
        (a) =>
          accountKind(a.account.type) === 'Tracking' &&
          !isRegistered(a.account.trackingKind, a.account.name),
      );
      const yearStart = `${year}-01-01`;
      const results = await Promise.all(
        trackingAccounts.map(async (a) => {
          const history = [
            ...(await accountValueHistoryRepo.listValueHistory(
              db,
              a.account.id,
            )),
          ].sort((x, y) => x.effectiveDate.localeCompare(y.effectiveDate));
          if (history.length === 0)
            return {
              accountId: a.account.id,
              name: a.account.name,
              gainCents: 0,
              sinceDate: null,
            };
          // A real pre-year entry means the gain is bounded to the calendar
          // year as intended; falling back to the earliest entry overall
          // means there's no such baseline, so the gain is "since inception"
          // instead — flag that instead of silently understating the window.
          const priorEntry = [...history]
            .reverse()
            .find((h) => h.effectiveDate < yearStart);
          const baseline = priorEntry ?? history[0];
          const current = history[history.length - 1];
          const sinceDate = priorEntry ? null : baseline.effectiveDate;
          // What was paid in between the two readings isn't gain. A reading
          // already includes that day's deposits (see
          // ACTIVITY_SINCE_LATEST_VALUE), hence the day-after bounds.
          const paidIn = await reportsRepo.netFlowByAccountInRange(
            db,
            boardId,
            [a.account.id],
            dayAfter(baseline.effectiveDate),
            dayAfter(current.effectiveDate),
          );
          return {
            accountId: a.account.id,
            name: a.account.name,
            gainCents:
              current.valueCents -
              baseline.valueCents -
              (paidIn.get(a.account.id) ?? 0),
            sinceDate,
          };
        }),
      );
      setTrackingGains(results);
    })();
  }, [boardId, year, accounts]);

  const isIncome = (payeeId: number | null) =>
    incomePayeeIds == null || incomePayeeIds.includes(payeeId);
  const incomeCents = incomeSources
    .filter((source) => isIncome(source.payeeId))
    .reduce((sum, source) => sum + source.totalCents, 0);
  const toggleIncomePayee = (payeeId: number | null) => {
    const current =
      incomePayeeIds ?? incomeSources.map((source) => source.payeeId);
    const next = current.includes(payeeId)
      ? current.filter((id) => id !== payeeId)
      : [...current, payeeId];
    setIncomePayeeIds(next);
    (async () => {
      const db = await getDb();
      await settingsRepo.setJsonSetting(db, incomePayeesKey(boardId), next);
    })();
  };

  const yearNumber = Number(year);
  const taxProvince = province ?? 'ON';
  // Deposits are take-home pay; the return is on gross. Backed out through
  // tax, CPP and EI unless the T4 figure was typed in.
  const grossPayCents = extras.grossPay
    ? toCents(extras.grossPay)
    : cents(grossFromNet(dollars(incomeCents), taxProvince, yearNumber));
  const lastYearGrossCents = useMemo(() => {
    const net = lastYearSources
      .filter(
        (source) =>
          incomePayeeIds == null || incomePayeeIds.includes(source.payeeId),
      )
      .reduce((sum, source) => sum + source.totalCents, 0);
    return cents(grossFromNet(dollars(net), taxProvince, yearNumber - 1));
  }, [lastYearSources, incomePayeeIds, taxProvince, yearNumber]);

  // Without a figure from the notice of assessment: RRSP is 18% of last
  // year's pay up to the cap (no carry-forward, no pension adjustment), the
  // rest their yearly limits.
  // Null when there's no last year on file to estimate from.
  const autoRoomCents = (kind: DeductibleKind): number | null => {
    switch (kind) {
      case 'ca_rrsp':
        return lastYearGrossCents > 0
          ? cents(rrspRoomEstimate(dollars(lastYearGrossCents), yearNumber))
          : null;
      case 'ca_fhsa':
        return cents(FHSA_ANNUAL_LIMIT);
      case 'us_401k':
        return cents(forYear(US_401K_LIMIT, yearNumber));
      case 'us_ira':
        return cents(forYear(US_IRA_LIMIT, yearNumber));
    }
  };

  // Per plan: what went in, and what of it is deductible. Over the room is
  // an over-contribution — penalized, not deducted.
  const plans = DEDUCTIBLE_KINDS.flatMap((kind) => {
    const accountsOfKind = contributions.filter((c) => c.kind === kind);
    if (accountsOfKind.length === 0) return [];
    const paidCents = accountsOfKind.reduce((sum, c) => sum + c.cents, 0);
    const typed = room[kind] ? toCents(room[kind]!) : null;
    const roomCents = typed ?? autoRoomCents(kind);
    return [
      {
        kind,
        accounts: accountsOfKind,
        paidCents,
        roomCents,
        estimated: typed == null,
        deductibleCents:
          roomCents == null ? paidCents : Math.min(paidCents, roomCents),
      },
    ];
  });
  const contributionCents = plans.reduce(
    (sum, plan) => sum + plan.deductibleCents,
    0,
  );
  const saveRoom = (kind: DeductibleKind, text: string) => {
    const next = { ...room, [kind]: text };
    setRoom(next);
    (async () => {
      const db = await getDb();
      await settingsRepo.setJsonSetting(db, roomKey(boardId, year), next);
    })();
  };
  const saveExtra = (key: keyof Extras, text: string) => {
    const next = { ...extras, [key]: text };
    setExtras(next);
    (async () => {
      const db = await getDb();
      await settingsRepo.setJsonSetting(db, extrasKey(boardId, year), next);
    })();
  };

  // Interest, and anything typed under "Anything else?", had nothing
  // withheld from it; contributions and other deductions come off.
  const estimate = estimateRefund({
    year: yearNumber,
    province: taxProvince,
    grossPay: dollars(grossPayCents),
    untaxedIncome: dollars(
      interestEarnedCents + toCents(extras.otherIncome ?? ''),
    ),
    deductions: dollars(
      contributionCents + toCents(extras.otherDeductions ?? ''),
    ),
    donations: dollars(donationCents),
  });
  const refundCents = cents(estimate.refund);
  const totalGainCents = trackingGains.reduce((sum, g) => sum + g.gainCents, 0);

  const filingYear = Number(year) + 1;
  const filingDeadline = formatFullDate(craFilingDeadline(filingYear));
  const rrspDate = formatFullDate(rrspDeadline(filingYear));
  const slipsDate = formatFullDate(slipsReadyBy(filingYear));
  const provinceName = province
    ? (CANADA_PROVINCES.find((p) => p.code === province)?.name ?? province)
    : null;

  const saveProvince = async (code: string) => {
    setProvince(code);
    setProvincePickerOpen(false);
    const db = await getDb();
    await settingsRepo.setSetting(db, provinceKey(boardId), code);
  };
  const toggleDonationCategory = (id: number) => {
    const next = toggleId(donationCategoryIds, id);
    setDonationCategoryIds(next);
    (async () => {
      const db = await getDb();
      await settingsRepo.setJsonSetting(
        db,
        donationCategoriesKey(boardId),
        next,
      );
    })();
  };

  const donationLabel =
    donationCategoryIds.length === 0
      ? t('taxInsights.donationCategoriesLabel')
      : donationCategoryIds.length === 1
        ? (categories.find((c) => c.id === donationCategoryIds[0])?.name ??
          t('taxInsights.donationCategoriesLabel'))
        : t('taxInsights.categoriesCount', {
            count: donationCategoryIds.length,
          });

  return (
    <ScreenContainer scroll>
      <ExperimentalBanner />
      <GuideSection
        heading={t('taxInsights.guideHeading')}
        body={t('taxInsights.guideBody')}
      />
      <ExpandingFieldGroup>
        <View style={styles.card}>
          <Text style={styles.title}>{t('taxInsights.title', { year })}</Text>
          <Text style={styles.disclaimer}>{t('taxInsights.disclaimer')}</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              {t('taxInsights.provinceLabel')}
            </Text>
            <Text
              style={styles.linkText}
              onPress={() => setProvincePickerOpen(true)}
            >
              {provinceName ?? t('taxInsights.selectProvince')} ▾
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>
            {refundCents >= 0
              ? t('taxInsights.refundLabel')
              : t('taxInsights.owingLabel')}
          </Text>
          <Text
            style={[
              styles.value,
              refundCents >= 0 ? styles.within : styles.over,
            ]}
          >
            {formatMoney(Math.abs(refundCents))}
          </Text>
          <Row
            label={t('taxInsights.fromContributions')}
            value={formatMoney(cents(estimate.fromDeductions))}
          />
          <Row
            label={t('taxInsights.fromDonations')}
            value={formatMoney(cents(estimate.fromDonations))}
          />
          <Row
            label={t('taxInsights.fromUntaxed')}
            value={formatMoney(cents(estimate.fromUntaxedIncome))}
          />
          <Row
            label={t('taxInsights.estimatedTaxableIncomeLabel')}
            value={formatMoney(cents(estimate.taxableIncome))}
          />
          <Text style={styles.hint}>
            {province
              ? t('taxInsights.refundHint', {
                  gross: formatMoney(grossPayCents),
                })
              : t('taxInsights.refundNoProvince')}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>
            {t('taxInsights.incomeBySourceLabel')}
          </Text>
          {/* Who paid it, biggest first. The ticked ones add up to the total
            above; untick a refund so it isn't counted as income. */}
          {incomeSources.length === 0 ? (
            <Text style={styles.hint}>{t('taxInsights.noIncomeYet')}</Text>
          ) : (
            <>
              <Row
                label={t('taxInsights.totalIncomeLabel', { year })}
                value={formatMoney(incomeCents)}
              />
              <Text style={styles.hint}>{t('taxInsights.incomePickHint')}</Text>
              {incomeSources.map((source) => {
                const counted = isIncome(source.payeeId);
                return (
                  <Pressable
                    key={source.payeeId ?? 'unnamed'}
                    style={styles.row}
                    onPress={() => toggleIncomePayee(source.payeeId)}
                  >
                    <Text
                      style={[styles.rowLabel, !counted && styles.excluded]}
                    >
                      {counted ? '☑' : '☐'}{' '}
                      {source.payeeName ?? t('common.noPayee')}
                    </Text>
                    <Text
                      style={[styles.rowValue, !counted && styles.excluded]}
                    >
                      {formatMoney(source.totalCents)}
                    </Text>
                  </Pressable>
                );
              })}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t('taxInsights.interestLabel')}</Text>
          <Text style={styles.hint}>{t('taxInsights.interestHint')}</Text>
          <Row
            label={t('taxInsights.interestEarned')}
            value={formatMoney(interestEarnedCents)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>
            {t('taxInsights.contributionsLabel', { year })}
          </Text>
          {contributions.length === 0 ? (
            <Text style={styles.hint}>
              {t('taxInsights.noContributionAccounts')}
            </Text>
          ) : (
            plans.map((plan) => {
              const autoCents = autoRoomCents(plan.kind);
              const leftCents =
                plan.roomCents == null ? null : plan.roomCents - plan.paidCents;
              return (
                <View key={plan.kind} style={styles.plan}>
                  {plan.accounts.map((c) => (
                    <Row
                      key={c.accountId}
                      label={c.name}
                      value={formatMoney(c.cents)}
                    />
                  ))}
                  <MoneyField
                    label={t('taxInsights.roomLabel', {
                      plan: t(`accountSetup.name.${plan.kind}`),
                    })}
                    placeholder={
                      autoCents == null
                        ? t('taxInsights.roomPlaceholderUnknown')
                        : t('taxInsights.roomPlaceholder', {
                            amount: formatMoney(autoCents),
                          })
                    }
                    value={room[plan.kind] ?? ''}
                    onChangeText={(text) => saveRoom(plan.kind, text)}
                  />
                  {leftCents == null ? null : (
                    <Text
                      style={[
                        styles.hint,
                        leftCents < 0 ? styles.over : styles.within,
                      ]}
                    >
                      {leftCents < 0
                        ? t('taxInsights.roomOver', {
                            amount: formatMoney(-leftCents),
                          })
                        : t(
                            plan.estimated
                              ? 'taxInsights.roomLeftEstimated'
                              : 'taxInsights.roomLeft',
                            { amount: formatMoney(leftCents) },
                          )}
                    </Text>
                  )}
                </View>
              );
            })
          )}
          <Text style={styles.hint}>{t('taxInsights.contributionsHint')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>
            {t('taxInsights.donationsLabel', { year })}
          </Text>
          <Text
            style={styles.linkText}
            onPress={() => setDonationPickerOpen(true)}
          >
            {donationLabel} ▾
          </Text>
          <Text style={styles.value}>{formatMoney(donationCents)}</Text>
          <Text style={styles.hint}>{t('taxInsights.donationsHint')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>
            {t('taxInsights.investmentGainsLabel', { year })}
          </Text>
          {trackingGains.length === 0 ? (
            <Text style={styles.hint}>
              {t('taxInsights.noTrackingAccounts')}
            </Text>
          ) : (
            trackingGains.map((g) => (
              <Row
                key={g.accountId}
                label={
                  g.sinceDate
                    ? `${g.name} (${t('taxInsights.gainSince', { date: g.sinceDate })})`
                    : g.name
                }
                value={formatMoney(g.gainCents)}
              />
            ))
          )}
          {trackingGains.length > 0 ? (
            <Row
              label={t('taxInsights.totalGains')}
              value={formatMoney(totalGainCents)}
            />
          ) : null}
          <Text style={styles.hint}>
            {t('taxInsights.investmentGainsHint')}
          </Text>
        </View>

        <View style={styles.card}>
          <Pressable
            style={styles.row}
            onPress={() => setExtrasOpen((open) => !open)}
          >
            <Text style={styles.rowLabel}>
              {t('taxInsights.additionalInfoLabel')}
            </Text>
            <Text style={styles.linkText}>{extrasOpen ? '▴' : '▾'}</Text>
          </Pressable>
          {extrasOpen ? (
            <>
              <MoneyField
                label={t('taxInsights.grossPayLabel')}
                placeholder={t('taxInsights.grossPayPlaceholder', {
                  amount: formatMoney(
                    cents(
                      grossFromNet(
                        dollars(incomeCents),
                        taxProvince,
                        yearNumber,
                      ),
                    ),
                  ),
                })}
                value={extras.grossPay ?? ''}
                onChangeText={(text) => saveExtra('grossPay', text)}
              />
              <MoneyField
                label={t('taxInsights.additionalIncomeLabel')}
                placeholder={t('common.amountPlaceholder')}
                value={extras.otherIncome ?? ''}
                onChangeText={(text) => saveExtra('otherIncome', text)}
              />
              <MoneyField
                label={t('taxInsights.deductionsLabel')}
                placeholder={t('common.amountPlaceholder')}
                value={extras.otherDeductions ?? ''}
                onChangeText={(text) => saveExtra('otherDeductions', text)}
              />
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>
            {provinceName
              ? t('taxInsights.timelineLabel', { province: provinceName })
              : t('taxInsights.timelineNoProvince')}
          </Text>
          <Text style={styles.hint}>
            {t('taxInsights.slipsReadyBy', { date: slipsDate })}
          </Text>
          <Text style={styles.hint}>
            {t('taxInsights.rrspDeadline', { year, date: rrspDate })}
          </Text>
          <Text style={styles.hint}>
            {t('taxInsights.filingDeadline', { date: filingDeadline })}
          </Text>

          <Text style={[styles.label, styles.formsLabel]}>
            {t('taxInsights.formsChecklistLabel')}
          </Text>
          <FormRow show={incomeCents > 0} label={t('taxInsights.formT4')} />
          <FormRow
            show={interestEarnedCents > 0 || trackingGains.length > 0}
            label={t('taxInsights.formT5')}
          />
          <FormRow
            show={donationCents > 0}
            label={t('taxInsights.formDonationReceipts')}
          />
          <FormRow show label={t('taxInsights.formRrsp')} />
          <FormRow show={province === 'QC'} label={t('taxInsights.formTP1')} />
        </View>

        <Modal
          visible={provincePickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setProvincePickerOpen(false)}
        >
          <BottomSheet
            title={t('taxInsights.provinceLabel')}
            onClose={() => setProvincePickerOpen(false)}
          >
            {CANADA_PROVINCES.map((p) => (
              <DropdownOption
                key={p.code}
                label={p.name}
                selected={province === p.code}
                onPress={() => saveProvince(p.code)}
              />
            ))}
          </BottomSheet>
        </Modal>

        <Modal
          visible={donationPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setDonationPickerOpen(false)}
        >
          <BottomSheet
            title={t('taxInsights.donationCategoriesLabel')}
            onClose={() => setDonationPickerOpen(false)}
          >
            {categories.map((c) => (
              <DropdownOption
                key={c.id}
                label={`${c.icon ? c.icon + ' ' : ''}${c.name}`}
                selected={donationCategoryIds.includes(c.id)}
                onPress={() => toggleDonationCategory(c.id)}
              />
            ))}
            {categories.length === 0 ? (
              <Text style={styles.hint}>
                {t('taxInsights.noCategoriesAvailable')}
              </Text>
            ) : null}
          </BottomSheet>
        </Modal>
      </ExpandingFieldGroup>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function FormRow({ show, label }: { show: boolean; label: string }) {
  return (
    <Text
      style={[
        styles.hint,
        show ? styles.formRowActive : styles.formRowInactive,
      ]}
    >
      {show ? '☑' : '☐'} {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  disclaimer: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  formsLabel: { marginTop: spacing.xs },
  value: { fontSize: 26, fontWeight: '700', color: colors.text },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  rowValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.accent },
  formRowActive: { color: colors.text },
  formRowInactive: { color: colors.textMuted },
  excluded: { color: colors.textMuted, fontWeight: '400' },
  plan: { gap: spacing.xs },
  over: { color: colors.negative, fontWeight: '700' },
  within: { color: colors.positive },
});
