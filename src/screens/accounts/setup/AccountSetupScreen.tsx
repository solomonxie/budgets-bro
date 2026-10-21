import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { getDb } from '../../../db/client';
import * as accountsRepo from '../../../db/repositories/accountsRepo';
import { createSetupAccounts } from '../../../db/repositories/accountSetupRepo';
import {
  clashingNames,
  countryFromLocale,
  defaultAnswers,
  suggestAccounts,
} from '../../../domain/accountSetup';
import type { SetupAnswers } from '../../../domain/accountSetup';
import { parseMoneyToCents } from '../../../domain/money';
import { useAppStore } from '../../../state/useAppStore';
import { useI18n } from '../../../i18n';
import type { RootStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import {
  STEPS,
  STEP_TITLE,
  anyPicked,
  isPicked,
  isSingle,
  pick,
  stepOptions,
} from './options';
import { SetupOptionRow } from './SetupOptionRow';
import { SetupReview } from './SetupReview';
import type { ReviewEdits } from './SetupReview';

// Long enough to see the tapped card light up before the next question.
const ADVANCE_DELAY_MS = 160;

// One question per screen, then the list it adds up to. A single-choice
// question moves on as soon as it is answered; a pick-all-that-apply one
// waits for Next.
export function AccountSetupScreen() {
  const { t, language } = useI18n();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AccountSetup'>>();
  const boardId = useAppStore((s) => s.currentBoardId);
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const advancing = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [index, setIndex] = useState(() =>
    Math.max(0, STEPS.indexOf(route.params?.step ?? 'country')),
  );
  const [answers, setAnswers] = useState<SetupAnswers>(() =>
    defaultAnswers(
      countryFromLocale(Intl.DateTimeFormat().resolvedOptions().locale) ??
        (language === 'zh' ? 'cn' : 'us'),
    ),
  );
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<ReviewEdits>({
    names: {},
    amounts: {},
    homeWorths: {},
    unticked: new Set(),
  });
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const step = STEPS[index];

  useEffect(() => {
    getDb()
      .then((db) => accountsRepo.listAccountNames(db, boardId))
      .then((names) =>
        setExisting(new Set(names.map((n) => n.trim().toLowerCase()))),
      )
      .catch(() => setExisting(new Set()));
  }, [boardId]);

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    advancing.current = false;
  }, [index]);

  const rows = useMemo(
    () =>
      suggestAccounts(answers).map((s) => {
        const name = t(s.nameKey, s.nameVars);
        return { ...s, name, exists: existing.has(name.toLowerCase()) };
      }),
    // `t` is a fresh function every render; `language` is what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answers, existing, language],
  );

  const toAdd = rows
    .filter((r) => !r.exists && !edits.unticked.has(r.id))
    .map((r) => ({ ...r, name: (edits.names[r.id] ?? r.name).trim() }))
    .filter((r) => r.name !== '');
  const clashes = clashingNames(
    toAdd.map((r) => r.name),
    existing,
  );
  const canCreate = toAdd.length > 0 && clashes.size === 0 && !busy;

  const goBack = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(STEPS.length - 1, i + 1));

  const choose = (key: string) => {
    setAnswers((a) => pick(a, key));
    if (!isSingle(step) || advancing.current) return;
    advancing.current = true;
    setAnswered((s) => new Set(s).add(step));
    advanceTimer.current = setTimeout(goNext, ADVANCE_DELAY_MS);
  };

  const create = async () => {
    setBusy(true);
    try {
      const cents = (text: string | undefined) =>
        text ? parseMoneyToCents(text) : null;
      await createSetupAccounts(
        await getDb(),
        boardId,
        toAdd.map((r) => ({
          name: r.name,
          type: r.type,
          trackingKind: r.trackingKind ?? null,
          amountCents: cents(edits.amounts[r.id]),
          homeWorthCents: cents(edits.homeWorths[r.id]),
        })),
      );
      bumpDataVersion();
      navigation.goBack();
    } catch {
      Alert.alert(t('accountSetup.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (index === 0) return navigation.goBack();
    Alert.alert(t('accountSetup.leaveTitle'), t('accountSetup.leaveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('accountSetup.leave'),
        style: 'destructive',
        onPress: () => navigation.goBack(),
      },
    ]);
  };

  const single = isSingle(step);
  const options = stepOptions(step, answers.country);
  const [titleKey, subKey] = STEP_TITLE[step];

  return (
    // Insets from the root provider, not a SafeAreaView: inside a
    // full-screen modal the view measures none and the page runs under the
    // status bar and home indicator.
    <View
      style={[
        styles.safe,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={close}
          hitSlop={12}
          accessibilityLabel={t('common.cancel')}
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${((index + 1) / STEPS.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.count}>
          {index + 1}/{STEPS.length}
        </Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Text style={styles.title}>
            {t(titleKey)}
          </Text>
          <Text style={styles.subtitle}>
            {t(subKey)}
          </Text>
          {/* Said once, up front: the list here is for thinking about money,
              not a mirror of every statement. */}
          {step === 'country' ? (
            <View style={styles.tip}>
              <Text style={styles.tipTitle}>{t('accountSetup.tipTitle')}</Text>
              <Text style={styles.tipBody}>{t('accountSetup.tipBody')}</Text>
            </View>
          ) : null}

          {step === 'review' ? (
            <SetupReview
              rows={rows}
              edits={edits}
              clashes={clashes}
              onChange={setEdits}
            />
          ) : (
            <View style={styles.options}>
              {options.map((o) => (
                <SetupOptionRow
                  key={o.key}
                  glyph={o.glyph}
                  glyphIsText={o.glyphIsText}
                  label={t(o.label)}
                  sub={o.sub ? t(o.sub) : undefined}
                  picked={
                    (!single || answered.has(step)) && isPicked(answers, o.key)
                  }
                  multi={!single}
                  onPress={() => choose(o.key)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {index > 0 ? (
            <Pressable onPress={goBack} hitSlop={10} style={styles.back}>
              <Text style={styles.backText}>{t('common.back')}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {step === 'review' ? (
            <Pressable
              style={[styles.primary, !canCreate && styles.disabled]}
              disabled={!canCreate}
              onPress={create}
            >
              <Text style={styles.primaryText}>
                {toAdd.length === 1
                  ? t('accountSetup.createOne')
                  : t('accountSetup.create', { count: toAdd.length })}
              </Text>
            </Pressable>
          ) : !single ? (
            <Pressable style={styles.primary} onPress={goNext}>
              <Text style={styles.primaryText}>
                {anyPicked(step, answers)
                  ? t('common.next')
                  : t('accountSetup.noneOfThese')}
              </Text>
            </Pressable>
          ) : answered.has(step) ? (
            <Pressable style={styles.primary} onPress={goNext}>
              <Text style={styles.primaryText}>{t('common.next')}</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  close: { fontSize: 20, color: colors.textMuted, width: 24 },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  count: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    minWidth: 24,
    textAlign: 'right',
  },
  content: {
    padding: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  options: { gap: spacing.sm },
  tip: {
    backgroundColor: colors.tint,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tipTitle: { fontSize: 14, fontWeight: '700', color: colors.accent },
  tipBody: { fontSize: 13, color: colors.text, lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  back: { paddingVertical: 12 },
  backText: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    minWidth: 140,
    alignItems: 'center',
  },
  primaryText: { color: colors.background, fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.4 },
});
