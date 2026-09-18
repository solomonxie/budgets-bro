import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAppStore } from '../../state/useAppStore';
import { useAccounts } from '../../hooks/useAccounts';
import { useAccountValues } from '../../hooks/useAccountValues';
import { useCategories } from '../../hooks/useCategories';
import { useInsights } from '../../hooks/useInsights';
import { getDb } from '../../db/client';
import * as budgetsRepo from '../../db/repositories/budgetsRepo';
import * as settingsRepo from '../../db/repositories/settingsRepo';
import { netWorth as computeNetWorth } from '../../domain/accountKind';
import {
  formatContextForPrompt,
  redactForPrivacy,
} from '../../domain/aiAnalysis';
import type { AiProfile, AnalysisContext } from '../../domain/aiAnalysis';
import { ANALYSIS_KINDS, buildAnalysisMessages } from '../../ai/prompts';
import type { AnalysisKind } from '../../ai/prompts';
import { AiClientError } from '../../ai/openaiClient';
import type { AiClientErrorCode } from '../../ai/openaiClient';
import { listAiKeys, runWithAiKeys } from '../../ai/aiKeys';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const PROFILE_SETTING_KEY = 'aiAnalysis.profile';
const EMPTY_PROFILE: AiProfile = {
  city: '',
  country: '',
  age: '',
  familySize: '',
};

const KIND_LABEL_KEY: Record<AnalysisKind, TranslationKey> = {
  spending: 'aiAnalysis.kindSpending',
  variance: 'aiAnalysis.kindVariance',
  forecast: 'aiAnalysis.kindForecast',
  health: 'aiAnalysis.kindHealth',
  comparison: 'aiAnalysis.kindComparison',
};
const ERROR_MESSAGE_KEY: Record<AiClientErrorCode, TranslationKey> = {
  invalid_key: 'aiAnalysis.errorInvalidKey',
  rate_limited: 'aiAnalysis.errorRateLimited',
  network: 'aiAnalysis.errorNetwork',
  unknown: 'aiAnalysis.errorUnknown',
};

// Everything here reads local budget data already loaded for other screens
// (useAccounts/useCategories/useInsights) — only "Run Analysis" itself is a
// one-shot network call, sent straight from this device to whichever vendor
// the current key belongs to (see ai/aiKeys.ts and Settings' AI Keys
// section); nothing is proxied through or stored by this app.
export function AiAnalysisScreen() {
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const boardId = useAppStore((s) => s.currentBoardId);
  const month = useAppStore((s) => s.currentMonth);
  const { accounts } = useAccounts();
  const { valuesByAccountId: houseValues } = useAccountValues();
  const { categories } = useCategories();
  const { spending, trendPoints } = useInsights(month);

  const [hasAiKey, setHasAiKey] = useState<boolean | undefined>(undefined); // undefined = still loading
  const [kind, setKind] = useState<AnalysisKind>('spending');
  const [privacyMode, setPrivacyMode] = useState(true);
  const [profile, setProfile] = useState<AiProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      setHasAiKey((await listAiKeys(db)).length > 0);
      setProfile(
        await settingsRepo.getJsonSetting(
          db,
          PROFILE_SETTING_KEY,
          EMPTY_PROFILE,
        ),
      );
    })();
  }, []);

  const saveProfile = async (next: AiProfile) => {
    setProfile(next);
    const db = await getDb();
    await settingsRepo.setJsonSetting(db, PROFILE_SETTING_KEY, next);
  };

  const netWorth = useMemo(
    () =>
      computeNetWorth(
        accounts.map((a) => ({
          type: a.account.type,
          balanceCents: a.balanceCents,
          houseValueCents: houseValues.get(a.account.id),
        })),
      ),
    [accounts, houseValues],
  );

  const run = async () => {
    if (!hasAiKey) return;
    setLoading(true);
    setErrorKey(null);
    setResult(null);
    try {
      const db = await getDb();
      const assignedByCategory = await budgetsRepo.assignedThisMonthByCategory(
        db,
        boardId,
        month,
      );
      const spentByCategory = new Map(
        spending.map((s) => [s.categoryId, s.spentCents]),
      );
      const variance = categories
        .filter((c) => c.archivedAt == null)
        .map((c) => ({
          categoryId: c.id,
          name: c.name,
          assignedCents: assignedByCategory[c.id] ?? 0,
          spentCents: spentByCategory.get(c.id) ?? 0,
        }))
        .filter((v) => v.assignedCents !== 0 || v.spentCents !== 0);
      const trend = trendPoints.map((p) => ({
        categoryId: p.categoryId,
        name: p.name,
        month: p.month,
        spentCents: p.spentCents,
      }));

      const hasProfile = Object.values(profile).some((v) => v.trim());
      let context: AnalysisContext = {
        month,
        netWorthCents: netWorth.netWorthCents,
        assetsCents: netWorth.assetsCents,
        debtsCents: netWorth.debtsCents,
        variance,
        trend,
        profile: hasProfile ? profile : undefined,
      };
      if (privacyMode) context = redactForPrivacy(context);

      const text = await runWithAiKeys(
        db,
        buildAnalysisMessages(kind, formatContextForPrompt(context)),
      );
      setResult(text);
    } catch (e) {
      setErrorKey(
        ERROR_MESSAGE_KEY[e instanceof AiClientError ? e.code : 'unknown'],
      );
    } finally {
      setLoading(false);
    }
  };

  if (hasAiKey === undefined) return <ScreenContainer />;

  if (!hasAiKey) {
    return (
      <ScreenContainer>
        <View style={styles.card}>
          <Text style={styles.hint}>{t('aiAnalysis.noKeyHint')}</Text>
          <Pressable style={styles.settingsLink} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsLinkText}>
              {t('aiAnalysis.openSettings')}
            </Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.card}>
        <Text style={styles.title}>{t('aiAnalysis.profileHeading')}</Text>
        <Text style={styles.hint}>{t('aiAnalysis.profileHint')}</Text>
        <View style={styles.row}>
          <View style={styles.half}>
            <TextField
              label={t('aiAnalysis.cityLabel')}
              value={profile.city}
              onChangeText={(v) => saveProfile({ ...profile, city: v })}
            />
          </View>
          <View style={styles.half}>
            <TextField
              label={t('aiAnalysis.countryLabel')}
              value={profile.country}
              onChangeText={(v) => saveProfile({ ...profile, country: v })}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <TextField
              label={t('aiAnalysis.ageLabel')}
              value={profile.age}
              onChangeText={(v) => saveProfile({ ...profile, age: v })}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.half}>
            <TextField
              label={t('aiAnalysis.familySizeLabel')}
              value={profile.familySize}
              onChangeText={(v) => saveProfile({ ...profile, familySize: v })}
              keyboardType="number-pad"
            />
          </View>
        </View>
      </View>

      <View style={styles.segmented}>
        {ANALYSIS_KINDS.map((k) => (
          <Pressable
            key={k}
            style={[styles.segment, kind === k && styles.segmentActive]}
            onPress={() => setKind(k)}
          >
            <Text
              style={[
                styles.segmentText,
                kind === k && styles.segmentTextActive,
              ]}
            >
              {t(KIND_LABEL_KEY[k])}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.checkboxRow}
        onPress={() => setPrivacyMode((v) => !v)}
      >
        <View style={[styles.checkbox, privacyMode && styles.checkboxChecked]}>
          {privacyMode ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
        <View style={styles.checkboxTextGroup}>
          <Text style={styles.checkboxLabel}>
            {t('aiAnalysis.privacyModeLabel')}
          </Text>
          <Text style={styles.hint}>{t('aiAnalysis.privacyModeHint')}</Text>
        </View>
      </Pressable>

      <Pressable style={styles.runButton} onPress={run} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.runButtonText}>{t('aiAnalysis.runButton')}</Text>
        )}
      </Pressable>

      {errorKey ? <Text style={styles.errorText}>{t(errorKey)}</Text> : null}

      {result ? (
        <View style={styles.card}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      ) : null}
    </ScreenContainer>
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
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  settingsLink: { alignSelf: 'flex-start' },
  settingsLinkText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segment: {
    flexGrow: 1,
    flexBasis: '31%',
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkboxTextGroup: { flex: 1, gap: 2 },
  checkboxLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  runButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  runButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorText: { color: colors.negative, fontSize: 13 },
  resultText: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
