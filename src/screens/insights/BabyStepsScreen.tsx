import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { Chip } from '../../components/ui/Chip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { CustomGoalModal } from '../../components/ui/CustomGoalModal';
import type { CustomGoalValue } from '../../components/ui/CustomGoalModal';
import { useAccounts } from '../../hooks/useAccounts';
import { useCustomGoals } from '../../hooks/useCustomGoals';
import { getDb } from '../../db/client';
import * as settingsRepo from '../../db/repositories/settingsRepo';
import * as reportsRepo from '../../db/repositories/reportsRepo';
import * as customGoalsRepo from '../../db/repositories/customGoalsRepo';
import { accountKind } from '../../domain/accountKind';
import { currentMonth, previousMonth } from '../../domain/month';
import { formatMoney } from '../../domain/money';
import { useAppStore } from '../../state/useAppStore';
import type { CustomGoalWithProgress } from '../../domain/types';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Board-scoped — each board has its own emergency fund pick and checkboxes.
const emergencyFundKey = (boardId: number) => `babySteps.emergencyFundAccountId:${boardId}`;
const manualStepsKey = (boardId: number) => `babySteps.manual:${boardId}`;
const STARTER_FUND_CENTS = 100_000; // $1,000

interface ManualSteps {
  step4: boolean;
  step5: boolean;
  step7: boolean;
}

// Dave Ramsey's 7 Baby Steps, with progress computed from real ledger data
// where possible (emergency fund, debt, mortgage) and manual checkboxes for
// the steps this app has no data for (retirement %, college fund, giving).
export function BabyStepsScreen() {
  const t = useT();
  const { accounts } = useAccounts();
  const { goals, refresh: refreshGoals } = useCustomGoals();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);
  const [emergencyFundAccountId, setEmergencyFundAccountId] = useState<number | null>(null);
  const [avgMonthlySpendingCents, setAvgMonthlySpendingCents] = useState(0);
  const [manual, setManual] = useState<ManualSteps>({ step4: false, step5: false, step7: false });
  const [goalModal, setGoalModal] = useState<{ editing: CustomGoalWithProgress | null } | null>(null);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const savedId = await settingsRepo.getSetting(db, emergencyFundKey(boardId));
      setEmergencyFundAccountId(savedId ? Number(savedId) : null);
      const savedManual = await settingsRepo.getJsonSetting<ManualSteps>(db, manualStepsKey(boardId), {
        step4: false,
        step5: false,
        step7: false,
      });
      setManual(savedManual);

      const month = currentMonth();
      const threeMonthsAgo = previousMonth(previousMonth(previousMonth(month)));
      const totals = await reportsRepo.incomeAndSpendingInRange(db, boardId, `${threeMonthsAgo}-01`, `${month}-01`);
      setAvgMonthlySpendingCents(Math.round(totals.spendingCents / 3));
    })();
  }, [boardId]);

  const cashLikeAccounts = accounts.filter((a) => ['Cash', 'Savings'].includes(accountKind(a.account.type)));
  const emergencyFundCents = accounts.find((a) => a.account.id === emergencyFundAccountId)?.balanceCents ?? 0;
  const nonMortgageDebtCents = accounts
    .filter((a) => a.account.type === 'credit_card' || a.account.type === 'loan')
    .reduce((sum, a) => sum + Math.max(0, -a.balanceCents), 0);
  const mortgageDebtCents = accounts
    .filter((a) => a.account.type === 'mortgage')
    .reduce((sum, a) => sum + Math.max(0, -a.balanceCents), 0);
  const fullEmergencyFundTargetCents = avgMonthlySpendingCents * 4; // midpoint of 3–6 months

  const selectEmergencyFund = async (accountId: number) => {
    setEmergencyFundAccountId(accountId);
    const db = await getDb();
    await settingsRepo.setSetting(db, emergencyFundKey(boardId), String(accountId));
  };

  const submitGoal = async (value: CustomGoalValue) => {
    const db = await getDb();
    const input = {
      name: value.name,
      targetCents: Math.round((parseFloat(value.targetAmount) || 0) * 100),
      linkedAccountId: value.linkedAccountId,
      manualProgressCents: value.linkedAccountId == null ? Math.round((parseFloat(value.manualProgressAmount) || 0) * 100) : null,
    };
    if (goalModal?.editing) await customGoalsRepo.updateGoal(db, goalModal.editing.id, input);
    else await customGoalsRepo.createGoal(db, boardId, input);
    bumpDataVersion();
    await refreshGoals();
    setGoalModal(null);
  };

  const deleteGoal = async () => {
    if (!goalModal?.editing) return;
    const db = await getDb();
    await customGoalsRepo.deleteGoal(db, goalModal.editing.id);
    bumpDataVersion();
    await refreshGoals();
    setGoalModal(null);
  };

  const toggleManual = async (key: keyof ManualSteps) => {
    const next = { ...manual, [key]: !manual[key] };
    setManual(next);
    const db = await getDb();
    await settingsRepo.setJsonSetting(db, manualStepsKey(boardId), next);
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.card}>
        <Text style={styles.title}>{t('babySteps.emergencyFundHeading')}</Text>
        <Text style={styles.hint}>{t('babySteps.emergencyFundHint')}</Text>
        <View style={styles.chipRow}>
          {cashLikeAccounts.map(({ account }) => (
            <Chip
              key={account.id}
              label={account.name}
              selected={emergencyFundAccountId === account.id}
              onPress={() => selectEmergencyFund(account.id)}
            />
          ))}
        </View>
      </View>

      <Step
        number={1}
        title={t('babySteps.step1Title')}
        auto
        current={emergencyFundCents}
        target={STARTER_FUND_CENTS}
      />
      <Step
        number={2}
        title={t('babySteps.step2Title')}
        auto
        current={nonMortgageDebtCents === 0 ? 1 : 0}
        target={1}
        captionOverride={nonMortgageDebtCents === 0 ? t('common.done') : t('babySteps.remaining', { amount: formatMoney(nonMortgageDebtCents) })}
      />
      <Step
        number={3}
        title={t('babySteps.step3Title')}
        auto
        current={emergencyFundCents}
        target={fullEmergencyFundTargetCents}
        captionOverride={
          avgMonthlySpendingCents > 0
            ? t('babySteps.step3Caption', {
                current: formatMoney(emergencyFundCents),
                target: formatMoney(fullEmergencyFundTargetCents),
                avg: formatMoney(avgMonthlySpendingCents),
              })
            : t('babySteps.notEnoughHistory')
        }
      />
      <ManualStep
        number={4}
        title={t('babySteps.step4Title')}
        checked={manual.step4}
        onToggle={() => toggleManual('step4')}
      />
      <ManualStep number={5} title={t('babySteps.step5Title')} checked={manual.step5} onToggle={() => toggleManual('step5')} />
      <Step
        number={6}
        title={t('babySteps.step6Title')}
        auto
        current={mortgageDebtCents === 0 ? 1 : 0}
        target={1}
        captionOverride={mortgageDebtCents === 0 ? t('babySteps.step6Done') : t('babySteps.remaining', { amount: formatMoney(mortgageDebtCents) })}
      />
      <ManualStep number={7} title={t('babySteps.step7Title')} checked={manual.step7} onToggle={() => toggleManual('step7')} />

      <View style={styles.goalsHeaderRow}>
        <Text style={styles.title}>{t('babySteps.goalsHeading')}</Text>
        <Pressable onPress={() => setGoalModal({ editing: null })}>
          <Text style={styles.addGoalText}>{t('babySteps.addGoal')}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>{t('babySteps.goalsHint')}</Text>
      {goals.length === 0 ? <Text style={styles.hint}>{t('babySteps.goalsEmpty')}</Text> : null}
      {goals.map((goal) => {
        const percent = goal.targetCents > 0 ? Math.min(100, Math.round((goal.progressCents / goal.targetCents) * 100)) : 0;
        return (
          <Pressable key={goal.id} style={styles.card} onPress={() => setGoalModal({ editing: goal })}>
            <Text style={styles.stepTitle}>{goal.name}</Text>
            <ProgressBar percent={percent} color={percent >= 100 ? colors.positive : colors.accent} />
            <Text style={styles.hint}>
              {t('babySteps.progressCaption', { current: formatMoney(goal.progressCents), target: formatMoney(goal.targetCents) })}
              {goal.linkedAccountId != null ? ` · ${t('customGoalModal.modeLinked')}` : ''}
            </Text>
          </Pressable>
        );
      })}

      <CustomGoalModal
        visible={goalModal != null}
        initial={{
          name: goalModal?.editing?.name ?? '',
          targetAmount: goalModal?.editing ? String(goalModal.editing.targetCents / 100) : '',
          linkedAccountId: goalModal?.editing?.linkedAccountId ?? null,
          manualProgressAmount: goalModal?.editing?.manualProgressCents != null ? String(goalModal.editing.manualProgressCents / 100) : '',
        }}
        accounts={accounts.map((a) => ({ id: a.account.id, name: a.account.name }))}
        onCancel={() => setGoalModal(null)}
        onSubmit={submitGoal}
        onDelete={goalModal?.editing ? deleteGoal : undefined}
      />
    </ScreenContainer>
  );
}

function Step({
  number,
  title,
  current,
  target,
  captionOverride,
}: {
  number: number;
  title: string;
  auto: true;
  current: number;
  target: number;
  captionOverride?: string;
}) {
  const t = useT();
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <View style={styles.card}>
      <Text style={styles.stepTitle}>{t('babySteps.stepPrefix', { number, title })}</Text>
      <ProgressBar percent={percent} color={percent >= 100 ? colors.positive : colors.accent} />
      <Text style={styles.hint}>
        {captionOverride ?? t('babySteps.progressCaption', { current: formatMoney(current), target: formatMoney(target) })}
      </Text>
    </View>
  );
}

function ManualStep({
  number,
  title,
  checked,
  onToggle,
}: {
  number: number;
  title: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <Pressable style={styles.card} onPress={onToggle}>
      <View style={styles.manualHeaderRow}>
        <Text style={styles.stepTitle}>{t('babySteps.stepPrefix', { number, title })}</Text>
        <View style={[styles.statusPill, checked && styles.statusPillDone]}>
          <Text style={[styles.statusPillText, checked && styles.statusPillTextDone]}>
            {checked ? t('babySteps.markedDone') : t('babySteps.markDone')}
          </Text>
        </View>
      </View>
    </Pressable>
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
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.sm },
  manualHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  statusPillDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  statusPillText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  statusPillTextDone: { color: '#fff' },
  goalsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  addGoalText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
