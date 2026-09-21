import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ExperimentalBanner } from '../../components/ui/ExperimentalBanner';
import { GuideSection } from '../../components/ui/GuideSection';
import { FinanceToolList } from '../finance-tools/FinanceToolList';
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
import { useAppStore } from '../../state/useAppStore';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ExpandingFieldGroup } from '../../components/ui/ExpandingField';

// Only jurisdiction with real deadline/forms logic so far — the array
// shape is what grows when a second country is added.
const TAX_COUNTRIES = [{ code: 'CA', name: 'Canada' }];
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
const INTEREST_CATEGORY_PATTERN = /interest/i;
const DONATION_CATEGORY_PATTERN = /charit|donat|giving/i;

const countryKey = (boardId: number) => `taxInsights.country:${boardId}`;
const provinceKey = (boardId: number) => `taxInsights.province:${boardId}`;
const interestCategoriesKey = (boardId: number) =>
  `taxInsights.interestCategoryIds:${boardId}`;
// Its own setting, deliberately not shared with Baby Steps' Step 7 —
// picking "which categories mean X" here shouldn't require a trip to a
// different screen, and the two don't have to agree on what "giving" means.
const donationCategoriesKey = (boardId: number) =>
  `taxInsights.donationCategoryIds:${boardId}`;

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

// Rough, local-only estimate from this year's ledger plus a couple of
// manual inputs — not tax advice. Income by source, interest, tracking-
// account gains and donations are surfaced automatically from existing
// data instead of asked for again; only province (and which categories
// mean "interest") are genuinely ambiguous and need a pick.
export function TaxInsightsScreen() {
  const t = useT();
  const month = useAppStore((s) => s.currentMonth);
  const boardId = useAppStore((s) => s.currentBoardId);
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const year = month.slice(0, 4);

  const [ledgerTotals, setLedgerTotals] = useState({
    incomeCents: 0,
    spendingCents: 0,
  });
  const [incomeSources, setIncomeSources] = useState<
    reportsRepo.IncomeSource[]
  >([]);
  const [country, setCountry] = useState('CA');
  const [province, setProvince] = useState<string | null>(null);
  const [interestCategoryIds, setInterestCategoryIds] = useState<number[]>([]);
  const [interestTotals, setInterestTotals] = useState({
    incomeCents: 0,
    expenseCents: 0,
  });
  const [donationCategoryIds, setDonationCategoryIds] = useState<number[]>([]);
  const [donationCents, setDonationCents] = useState(0);
  const [trackingGains, setTrackingGains] = useState<
    {
      accountId: number;
      name: string;
      gainCents: number;
      sinceDate: string | null;
    }[]
  >([]);
  const [additionalIncome, setAdditionalIncome] = useState('');
  const [deductions, setDeductions] = useState('');

  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [provincePickerOpen, setProvincePickerOpen] = useState(false);
  const [interestPickerOpen, setInterestPickerOpen] = useState(false);
  const [donationPickerOpen, setDonationPickerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const totals = await reportsRepo.incomeAndSpendingInRange(
        db,
        boardId,
        `${year}-01-01`,
        `${Number(year) + 1}-01-01`,
      );
      setLedgerTotals(totals);
      setIncomeSources(
        await reportsRepo.incomeByPayeeInRange(
          db,
          boardId,
          `${year}-01-01`,
          `${Number(year) + 1}-01-01`,
        ),
      );

      setCountry(
        (await settingsRepo.getSetting(db, countryKey(boardId))) ?? 'CA',
      );
      setProvince(await settingsRepo.getSetting(db, provinceKey(boardId)));

      const interestRaw = await settingsRepo.getSetting(
        db,
        interestCategoriesKey(boardId),
      );
      if (interestRaw != null) {
        setInterestCategoryIds(JSON.parse(interestRaw));
      } else if (categories.length > 0) {
        const detected = categories
          .filter((c) => INTEREST_CATEGORY_PATTERN.test(c.name))
          .map((c) => c.id);
        setInterestCategoryIds(detected);
        await settingsRepo.setJsonSetting(
          db,
          interestCategoriesKey(boardId),
          detected,
        );
      }

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
      setInterestTotals(
        await reportsRepo.categoryIncomeAndExpenseInRange(
          db,
          boardId,
          interestCategoryIds,
          `${year}-01-01`,
          `${Number(year) + 1}-01-01`,
        ),
      );
    })();
  }, [boardId, year, interestCategoryIds]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      setDonationCents(
        await reportsRepo.categorySpendingInRange(
          db,
          boardId,
          donationCategoryIds,
          `${year}-01-01`,
          `${Number(year) + 1}-01-01`,
        ),
      );
    })();
  }, [boardId, year, donationCategoryIds]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const trackingAccounts = accounts.filter(
        (a) => accountKind(a.account.type) === 'Tracking',
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
          return {
            accountId: a.account.id,
            name: a.account.name,
            gainCents: current.valueCents - baseline.valueCents,
            sinceDate,
          };
        }),
      );
      setTrackingGains(results);
    })();
  }, [boardId, year, accounts]);

  const estimatedTaxableIncomeCents =
    ledgerTotals.incomeCents + toCents(additionalIncome) - toCents(deductions);
  const totalGainCents = trackingGains.reduce((sum, g) => sum + g.gainCents, 0);

  const filingYear = Number(year) + 1;
  const filingDeadline = formatFullDate(craFilingDeadline(filingYear));
  const rrspDate = formatFullDate(rrspDeadline(filingYear));
  const slipsDate = formatFullDate(slipsReadyBy(filingYear));
  const provinceName = province
    ? (CANADA_PROVINCES.find((p) => p.code === province)?.name ?? province)
    : null;

  const saveCountry = async (code: string) => {
    setCountry(code);
    setCountryPickerOpen(false);
    const db = await getDb();
    await settingsRepo.setSetting(db, countryKey(boardId), code);
  };
  const saveProvince = async (code: string) => {
    setProvince(code);
    setProvincePickerOpen(false);
    const db = await getDb();
    await settingsRepo.setSetting(db, provinceKey(boardId), code);
  };
  const toggleInterestCategory = (id: number) => {
    const next = toggleId(interestCategoryIds, id);
    setInterestCategoryIds(next);
    (async () => {
      const db = await getDb();
      await settingsRepo.setJsonSetting(
        db,
        interestCategoriesKey(boardId),
        next,
      );
    })();
  };

  const interestLabel =
    interestCategoryIds.length === 0
      ? t('taxInsights.interestCategoriesLabel')
      : interestCategoryIds.length === 1
        ? (categories.find((c) => c.id === interestCategoryIds[0])?.name ??
          t('taxInsights.interestCategoriesLabel'))
        : t('taxInsights.categoriesCount', {
            count: interestCategoryIds.length,
          });

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
            <Text style={styles.rowLabel}>{t('taxInsights.countryLabel')}</Text>
            <Text
              style={styles.linkText}
              onPress={() => setCountryPickerOpen(true)}
            >
              {TAX_COUNTRIES.find((c) => c.code === country)?.name ?? country} ▾
            </Text>
          </View>
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
          <Row
            label={t('taxInsights.totalIncomeLabel', { year })}
            value={formatMoney(ledgerTotals.incomeCents)}
          />
          <Row
            label={t('taxInsights.totalSpendingLabel', { year })}
            value={formatMoney(ledgerTotals.spendingCents)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>
            {t('taxInsights.incomeBySourceLabel')}
          </Text>
          {/* Who paid it, biggest first — the parts add up to the total above
            because both use the same definition of income. */}
          {incomeSources.length === 0 ? (
            <Text style={styles.hint}>{t('taxInsights.noIncomeYet')}</Text>
          ) : (
            incomeSources.map((source) => (
              <Row
                key={source.payeeId ?? 'unnamed'}
                label={source.payeeName ?? t('common.noPayee')}
                value={formatMoney(source.totalCents)}
              />
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t('taxInsights.interestLabel')}</Text>
          <Text style={styles.hint}>{t('taxInsights.interestHint')}</Text>
          <Text
            style={styles.linkText}
            onPress={() => setInterestPickerOpen(true)}
          >
            {interestLabel} ▾
          </Text>
          <Row
            label={t('taxInsights.interestEarned')}
            value={formatMoney(interestTotals.incomeCents)}
          />
          <Row
            label={t('taxInsights.interestPaid')}
            value={formatMoney(interestTotals.expenseCents)}
          />
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
            {t('taxInsights.additionalInfoLabel')}
          </Text>
          <MoneyField
            label={t('taxInsights.additionalIncomeLabel')}
            placeholder={t('common.amountPlaceholder')}
            value={additionalIncome}
            onChangeText={setAdditionalIncome}
          />
          <MoneyField
            label={t('taxInsights.deductionsLabel')}
            placeholder={t('common.amountPlaceholder')}
            value={deductions}
            onChangeText={setDeductions}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>
            {t('taxInsights.estimatedTaxableIncomeLabel')}
          </Text>
          <Text style={styles.value}>
            {formatMoney(estimatedTaxableIncomeCents)}
          </Text>
          <Text style={styles.hint}>
            {t('taxInsights.estimatedTaxableIncomeHint')}
          </Text>
        </View>

        {country === 'CA' ? (
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
            <FormRow
              show={ledgerTotals.incomeCents > 0}
              label={t('taxInsights.formT4')}
            />
            <FormRow
              show={interestTotals.incomeCents > 0 || trackingGains.length > 0}
              label={t('taxInsights.formT5')}
            />
            <FormRow
              show={donationCents > 0}
              label={t('taxInsights.formDonationReceipts')}
            />
            <FormRow show label={t('taxInsights.formRrsp')} />
            <FormRow
              show={province === 'QC'}
              label={t('taxInsights.formTP1')}
            />
          </View>
        ) : null}

        <Pressable
          style={styles.aiButton}
          onPress={() =>
            Alert.alert(
              t('taxInsights.aiSummaryTitle'),
              t('taxInsights.aiSummaryMessage'),
            )
          }
        >
          <Text style={styles.aiButtonText}>{t('taxInsights.askAi')}</Text>
        </Pressable>

        <FinanceToolList hub="tax" />

        <Modal
          visible={countryPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setCountryPickerOpen(false)}
        >
          <BottomSheet
            title={t('taxInsights.countryLabel')}
            onClose={() => setCountryPickerOpen(false)}
          >
            {TAX_COUNTRIES.map((c) => (
              <DropdownOption
                key={c.code}
                label={c.name}
                selected={country === c.code}
                onPress={() => saveCountry(c.code)}
              />
            ))}
            <Text style={styles.hint}>
              {t('taxInsights.countryComingSoon')}
            </Text>
          </BottomSheet>
        </Modal>

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
          visible={interestPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setInterestPickerOpen(false)}
        >
          <BottomSheet
            title={t('taxInsights.interestCategoriesLabel')}
            onClose={() => setInterestPickerOpen(false)}
          >
            {categories.map((c) => (
              <DropdownOption
                key={c.id}
                label={`${c.icon ? c.icon + ' ' : ''}${c.name}`}
                selected={interestCategoryIds.includes(c.id)}
                onPress={() => toggleInterestCategory(c.id)}
              />
            ))}
            {categories.length === 0 ? (
              <Text style={styles.hint}>
                {t('taxInsights.noCategoriesAvailable')}
              </Text>
            ) : null}
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
  aiButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    borderStyle: 'dashed',
  },
  aiButtonText: { color: colors.accent, fontWeight: '700' },
});
