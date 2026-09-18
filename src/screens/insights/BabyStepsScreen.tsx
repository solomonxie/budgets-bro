import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { TextField } from '../../components/ui/TextField';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { DropdownOption, DropdownGroupLabel } from '../../components/ui/DropdownField';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
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
import type { AccountWithBalance } from '../../db/repositories/accountsRepo';
import { useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

// Board-scoped — each board has its own account links, categories and
// checkboxes. `emergencyFundKey` is legacy (a single shared account for
// both Steps 1 and 3, before each step got its own multi-account picker) —
// only read once, to seed the new per-step keys on first load.
const emergencyFundKey = (boardId: number) => `babySteps.emergencyFundAccountId:${boardId}`;
const step1AccountsKey = (boardId: number) => `babySteps.step1AccountIds:${boardId}`;
const step3AccountsKey = (boardId: number) => `babySteps.step3AccountIds:${boardId}`;
const step4AccountsKey = (boardId: number) => `babySteps.step4AccountIds:${boardId}`;
const step5AccountsKey = (boardId: number) => `babySteps.step5AccountIds:${boardId}`;
const step5TargetKey = (boardId: number) => `babySteps.step5TargetCents:${boardId}`;
const step7CategoriesKey = (boardId: number) => `babySteps.step7CategoryIds:${boardId}`;
const manualStepsKey = (boardId: number) => `babySteps.manual:${boardId}`;

const STARTER_FUND_CENTS = 100_000; // $1,000
const RETIREMENT_TARGET_PERCENT = 15;
const DEFAULT_COLLEGE_FUND_TARGET_CENTS = 5_000_000; // $50,000 — just a starting point, editable
const RETIREMENT_NAME_PATTERN = /401\s*\(?k\)?|403\s*\(?b\)?|\bira\b|\brrsp\b|\btfsa\b|pension|retirement/i;

interface ManualSteps {
  step5: boolean;
  step7: boolean;
}

function trailingThreeMonthWindow() {
  const month = currentMonth();
  const threeMonthsAgo = previousMonth(previousMonth(previousMonth(month)));
  return { startDate: `${threeMonthsAgo}-01`, endDateExclusive: `${month}-01` };
}

function currentYearWindow() {
  const year = new Date().getFullYear();
  return { startDate: `${year}-01-01`, endDateExclusive: `${year + 1}-01-01`, year };
}

function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

// Dave Ramsey's 7 Baby Steps, with progress computed from real ledger data
// where possible. Steps 1/3/4/5 link to one or more accounts the user
// picks (Step 4 tries to auto-detect a retirement account by name first);
// Step 7 links to one or more giving/donation categories. Any step with
// nothing linked yet falls back to a manual "Mark Done" checkbox. Each
// link is a small inline text link (not a boxed field) that opens a
// bottom sheet to pick — kept inline with the step's own progress caption.
export function BabyStepsScreen() {
  const t = useT();
  const { accounts } = useAccounts();
  const { groups, categories } = useCategories();
  const { goals, refresh: refreshGoals } = useCustomGoals();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const [step1AccountIds, setStep1AccountIds] = useState<number[]>([]);
  const [step3AccountIds, setStep3AccountIds] = useState<number[]>([]);
  const [step4AccountIds, setStep4AccountIds] = useState<number[]>([]);
  const [step5AccountIds, setStep5AccountIds] = useState<number[]>([]);
  const [step5TargetCents, setStep5TargetCents] = useState(DEFAULT_COLLEGE_FUND_TARGET_CENTS);
  const [step7CategoryIds, setStep7CategoryIds] = useState<number[]>([]);
  const [avgMonthlySpendingCents, setAvgMonthlySpendingCents] = useState(0);
  const [avgMonthlyIncomeCents, setAvgMonthlyIncomeCents] = useState(0);
  const [avgMonthlyRetirementCents, setAvgMonthlyRetirementCents] = useState(0);
  const [donationCentsThisYear, setDonationCentsThisYear] = useState(0);
  const [manual, setManual] = useState<ManualSteps>({ step5: false, step7: false });
  const [editingStep5Target, setEditingStep5Target] = useState(false);
  const [step5TargetInput, setStep5TargetInput] = useState('');

  const [step1PickerOpen, setStep1PickerOpen] = useState(false);
  const [step3PickerOpen, setStep3PickerOpen] = useState(false);
  const [step4PickerOpen, setStep4PickerOpen] = useState(false);
  const [step5PickerOpen, setStep5PickerOpen] = useState(false);
  const [step7PickerOpen, setStep7PickerOpen] = useState(false);

  // Goal editing is inline, not a modal — 'new' while adding, a goal id
  // while editing that one, null otherwise. Only one goal (or the new-goal
  // slot) can be open at a time.
  const [editingGoalId, setEditingGoalId] = useState<number | 'new' | null>(null);
  const [goalDraftName, setGoalDraftName] = useState('');
  const [goalDraftTargetInput, setGoalDraftTargetInput] = useState('');
  const [goalDraftAccountId, setGoalDraftAccountId] = useState<number | null>(null);
  const [goalDraftManualProgressInput, setGoalDraftManualProgressInput] = useState('');
  const [goalAccountPickerOpen, setGoalAccountPickerOpen] = useState(false);

  // Settings + averages that don't depend on the live accounts list.
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const legacyEmergencyId = await settingsRepo.getSetting(db, emergencyFundKey(boardId));

      const loadOrSeedAccountIds = async (key: string): Promise<number[]> => {
        const raw = await settingsRepo.getSetting(db, key);
        if (raw != null) return JSON.parse(raw) as number[];
        const seeded = legacyEmergencyId ? [Number(legacyEmergencyId)] : [];
        await settingsRepo.setJsonSetting(db, key, seeded);
        return seeded;
      };
      setStep1AccountIds(await loadOrSeedAccountIds(step1AccountsKey(boardId)));
      setStep3AccountIds(await loadOrSeedAccountIds(step3AccountsKey(boardId)));

      setStep5AccountIds(await settingsRepo.getJsonSetting<number[]>(db, step5AccountsKey(boardId), []));
      setStep5TargetCents(await settingsRepo.getJsonSetting<number>(db, step5TargetKey(boardId), DEFAULT_COLLEGE_FUND_TARGET_CENTS));
      setStep7CategoryIds(await settingsRepo.getJsonSetting<number[]>(db, step7CategoriesKey(boardId), []));
      setManual(await settingsRepo.getJsonSetting<ManualSteps>(db, manualStepsKey(boardId), { step5: false, step7: false }));

      const { startDate, endDateExclusive } = trailingThreeMonthWindow();
      const totals = await reportsRepo.incomeAndSpendingInRange(db, boardId, startDate, endDateExclusive);
      setAvgMonthlySpendingCents(Math.round(totals.spendingCents / 3));
      setAvgMonthlyIncomeCents(Math.round(totals.incomeCents / 3));
    })();
  }, [boardId]);

  // Step 4's retirement account(s): auto-detected by name once per board,
  // then whatever the user picks after that sticks.
  useEffect(() => {
    if (accounts.length === 0) return;
    (async () => {
      const db = await getDb();
      const raw = await settingsRepo.getSetting(db, step4AccountsKey(boardId));
      if (raw != null) {
        setStep4AccountIds(JSON.parse(raw));
        return;
      }
      const detected = accounts.filter((a) => RETIREMENT_NAME_PATTERN.test(a.account.name)).map((a) => a.account.id);
      setStep4AccountIds(detected);
      await settingsRepo.setJsonSetting(db, step4AccountsKey(boardId), detected);
    })();
  }, [boardId, accounts]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const { startDate, endDateExclusive } = trailingThreeMonthWindow();
      const totalCents = await reportsRepo.depositsIntoAccountsInRange(db, boardId, step4AccountIds, startDate, endDateExclusive);
      setAvgMonthlyRetirementCents(Math.round(totalCents / 3));
    })();
  }, [boardId, step4AccountIds]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const { startDate, endDateExclusive } = currentYearWindow();
      const totalCents = await reportsRepo.categorySpendingInRange(db, boardId, step7CategoryIds, startDate, endDateExclusive);
      setDonationCentsThisYear(totalCents);
    })();
  }, [boardId, step7CategoryIds]);

  const cashLikeAccounts = accounts.filter((a) => ['Cash', 'Savings'].includes(accountKind(a.account.type)));
  // Broader pool for retirement/college funds — tracking/asset accounts
  // (brokerage, 529, etc.) count too, just not debt or the Income tag.
  const investableAccounts = accounts.filter((a) => !['credit_card', 'loan', 'mortgage'].includes(a.account.type));

  const sumBalances = (ids: number[]) =>
    accounts.filter((a) => ids.includes(a.account.id)).reduce((sum, a) => sum + a.balanceCents, 0);
  const step1Cents = sumBalances(step1AccountIds);
  const step3Cents = sumBalances(step3AccountIds);
  const step5Cents = sumBalances(step5AccountIds);

  const nonMortgageDebtCents = accounts
    .filter((a) => a.account.type === 'credit_card' || a.account.type === 'loan')
    .reduce((sum, a) => sum + Math.max(0, -a.balanceCents), 0);
  const mortgageDebtCents = accounts
    .filter((a) => a.account.type === 'mortgage')
    .reduce((sum, a) => sum + Math.max(0, -a.balanceCents), 0);
  const fullEmergencyFundTargetCents = avgMonthlySpendingCents * 4; // midpoint of 3–6 months
  const retirementPercent = avgMonthlyIncomeCents > 0 ? (avgMonthlyRetirementCents / avgMonthlyIncomeCents) * 100 : 0;

  const persistAccountIds = async (key: string, ids: number[]) => {
    const db = await getDb();
    await settingsRepo.setJsonSetting(db, key, ids);
  };

  const toggleStep1Account = (id: number) => {
    const next = toggleId(step1AccountIds, id);
    setStep1AccountIds(next);
    persistAccountIds(step1AccountsKey(boardId), next);
  };
  const toggleStep3Account = (id: number) => {
    const next = toggleId(step3AccountIds, id);
    setStep3AccountIds(next);
    persistAccountIds(step3AccountsKey(boardId), next);
  };
  const toggleStep4Account = (id: number) => {
    const next = toggleId(step4AccountIds, id);
    setStep4AccountIds(next);
    persistAccountIds(step4AccountsKey(boardId), next);
  };
  const toggleStep5Account = (id: number) => {
    const next = toggleId(step5AccountIds, id);
    setStep5AccountIds(next);
    persistAccountIds(step5AccountsKey(boardId), next);
  };
  const toggleStep7Category = (id: number) => {
    const next = toggleId(step7CategoryIds, id);
    setStep7CategoryIds(next);
    (async () => {
      const db = await getDb();
      await settingsRepo.setJsonSetting(db, step7CategoriesKey(boardId), next);
    })();
  };

  const startEditingStep5Target = () => {
    setStep5TargetInput(String(step5TargetCents / 100));
    setEditingStep5Target(true);
  };
  const saveStep5Target = async () => {
    const cents = Math.round((parseFloat(step5TargetInput) || 0) * 100);
    setStep5TargetCents(cents);
    setEditingStep5Target(false);
    const db = await getDb();
    await settingsRepo.setJsonSetting(db, step5TargetKey(boardId), cents);
  };

  const toggleManual = async (key: keyof ManualSteps) => {
    const next = { ...manual, [key]: !manual[key] };
    setManual(next);
    const db = await getDb();
    await settingsRepo.setJsonSetting(db, manualStepsKey(boardId), next);
  };

  const startAddGoal = () => {
    setEditingGoalId('new');
    setGoalDraftName('');
    setGoalDraftTargetInput('');
    setGoalDraftAccountId(null);
    setGoalDraftManualProgressInput('');
  };
  const startEditGoal = (goal: CustomGoalWithProgress) => {
    setEditingGoalId(goal.id);
    setGoalDraftName(goal.name);
    setGoalDraftTargetInput(String(goal.targetCents / 100));
    setGoalDraftAccountId(goal.linkedAccountId);
    setGoalDraftManualProgressInput(goal.manualProgressCents != null ? String(goal.manualProgressCents / 100) : '');
  };
  const cancelEditGoal = () => setEditingGoalId(null);
  const saveGoal = async () => {
    if (!goalDraftName.trim()) return;
    const db = await getDb();
    const input = {
      name: goalDraftName.trim(),
      targetCents: Math.round((parseFloat(goalDraftTargetInput) || 0) * 100),
      linkedAccountId: goalDraftAccountId,
      manualProgressCents: goalDraftAccountId == null ? Math.round((parseFloat(goalDraftManualProgressInput) || 0) * 100) : null,
    };
    if (typeof editingGoalId === 'number') await customGoalsRepo.updateGoal(db, editingGoalId, input);
    else await customGoalsRepo.createGoal(db, boardId, input);
    bumpDataVersion();
    await refreshGoals();
    setEditingGoalId(null);
  };
  const deleteGoal = async () => {
    if (typeof editingGoalId !== 'number') return;
    const db = await getDb();
    await customGoalsRepo.deleteGoal(db, editingGoalId);
    bumpDataVersion();
    await refreshGoals();
    setEditingGoalId(null);
  };

  // A small inline "Field label ▾" text link plus the bottom sheet it
  // opens, kept as separate pieces (not one JSX tree) — the sheet is
  // rendered as a sibling of whichever step card is currently showing
  // rather than nested inside it, so switching a step between its
  // auto-tracked and manual layouts (e.g. Step 5 once an account gets
  // linked) doesn't remount the Modal mid-interaction and make it flicker
  // closed-then-open.
  const accountLinkLabel = (ids: number[], pool: AccountWithBalance[], fieldLabel: string) => {
    if (ids.length === 0) return fieldLabel;
    if (ids.length === 1) return pool.find((a) => a.account.id === ids[0])?.account.name ?? fieldLabel;
    return t('babySteps.accountsCount', { count: ids.length });
  };

  const accountPicker = (
    pool: AccountWithBalance[],
    ids: number[],
    onToggle: (id: number) => void,
    open: boolean,
    setOpen: (v: boolean) => void,
    fieldLabel: string,
  ) => ({
    trigger: (
      <Text style={styles.linkText} onPress={() => setOpen(true)}>
        {accountLinkLabel(ids, pool, fieldLabel)} ▾
      </Text>
    ),
    modal: (
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <BottomSheet title={fieldLabel} onClose={() => setOpen(false)}>
          {pool.map((a) => (
            <DropdownOption key={a.account.id} label={a.account.name} selected={ids.includes(a.account.id)} onPress={() => onToggle(a.account.id)} />
          ))}
          {pool.length === 0 ? <Text style={styles.hint}>{t('babySteps.noAccountsAvailable')}</Text> : null}
        </BottomSheet>
      </Modal>
    ),
  });

  const categoryLinkLabel = (ids: number[], fieldLabel: string) => {
    if (ids.length === 0) return fieldLabel;
    if (ids.length === 1) return categories.find((c) => c.id === ids[0])?.name ?? fieldLabel;
    return t('babySteps.categoriesCount', { count: ids.length });
  };

  const categoryPicker = (ids: number[], onToggle: (id: number) => void, open: boolean, setOpen: (v: boolean) => void, fieldLabel: string) => ({
    trigger: (
      <Text style={styles.linkText} onPress={() => setOpen(true)}>
        {categoryLinkLabel(ids, fieldLabel)} ▾
      </Text>
    ),
    modal: (
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <BottomSheet title={fieldLabel} onClose={() => setOpen(false)}>
          {groups.map((group) => {
            const groupCategories = categories.filter((c) => c.groupId === group.id);
            if (groupCategories.length === 0) return null;
            return (
              <View key={group.id}>
                <DropdownGroupLabel label={group.name} />
                {groupCategories.map((c) => (
                  <DropdownOption
                    key={c.id}
                    label={`${c.icon ? c.icon + ' ' : ''}${c.name}`}
                    selected={ids.includes(c.id)}
                    onPress={() => onToggle(c.id)}
                  />
                ))}
              </View>
            );
          })}
          {categories.length === 0 ? <Text style={styles.hint}>{t('babySteps.noCategoriesAvailable')}</Text> : null}
        </BottomSheet>
      </Modal>
    ),
  });

  const step1Picker = accountPicker(cashLikeAccounts, step1AccountIds, toggleStep1Account, step1PickerOpen, setStep1PickerOpen, t('babySteps.emergencyFundAccountsLabel'));
  const step3Picker = accountPicker(cashLikeAccounts, step3AccountIds, toggleStep3Account, step3PickerOpen, setStep3PickerOpen, t('babySteps.emergencyFundAccountsLabel'));
  const step4Picker = accountPicker(investableAccounts, step4AccountIds, toggleStep4Account, step4PickerOpen, setStep4PickerOpen, t('babySteps.retirementAccountsLabel'));
  const step5Picker = accountPicker(investableAccounts, step5AccountIds, toggleStep5Account, step5PickerOpen, setStep5PickerOpen, t('babySteps.educationAccountsLabel'));
  const step7Picker = categoryPicker(step7CategoryIds, toggleStep7Category, step7PickerOpen, setStep7PickerOpen, t('babySteps.givingCategoriesLabel'));

  // Single-select — a goal links to at most one account. The first sheet
  // option unlinks back to manual tracking, same idea as a category
  // picker's "Uncategorized" option.
  const goalAccountLabel =
    goalDraftAccountId == null ? t('babySteps.goalAccountLabel') : accounts.find((a) => a.account.id === goalDraftAccountId)?.account.name ?? t('babySteps.goalAccountLabel');
  const goalAccountPickerModal = (
    <Modal visible={goalAccountPickerOpen} transparent animationType="slide" onRequestClose={() => setGoalAccountPickerOpen(false)}>
      <BottomSheet title={t('babySteps.goalAccountLabel')} onClose={() => setGoalAccountPickerOpen(false)}>
        <DropdownOption
          label={t('customGoalModal.modeManual')}
          selected={goalDraftAccountId == null}
          onPress={() => {
            setGoalDraftAccountId(null);
            setGoalAccountPickerOpen(false);
          }}
        />
        {accounts.map((a) => (
          <DropdownOption
            key={a.account.id}
            label={a.account.name}
            selected={goalDraftAccountId === a.account.id}
            onPress={() => {
              setGoalDraftAccountId(a.account.id);
              setGoalAccountPickerOpen(false);
            }}
          />
        ))}
      </BottomSheet>
    </Modal>
  );

  const { year: currentYear } = currentYearWindow();

  return (
    <ScreenContainer scroll>
      <Step
        number={1}
        title={t('babySteps.step1Title')}
        current={step1Cents}
        target={STARTER_FUND_CENTS}
        pickerTrigger={step1Picker.trigger}
      />
      {step1Picker.modal}
      <Step
        number={2}
        title={t('babySteps.step2Title')}
        current={nonMortgageDebtCents === 0 ? 1 : 0}
        target={1}
        captionOverride={nonMortgageDebtCents === 0 ? t('common.done') : t('babySteps.remaining', { amount: formatMoney(nonMortgageDebtCents) })}
      />
      <Step
        number={3}
        title={t('babySteps.step3Title')}
        current={step3Cents}
        target={fullEmergencyFundTargetCents}
        pickerTrigger={step3Picker.trigger}
        captionOverride={
          avgMonthlySpendingCents > 0
            ? t('babySteps.step3Caption', {
                current: formatMoney(step3Cents),
                target: formatMoney(fullEmergencyFundTargetCents),
                avg: formatMoney(avgMonthlySpendingCents),
              })
            : t('babySteps.notEnoughHistory')
        }
      />
      {step3Picker.modal}
      <Step
        number={4}
        title={t('babySteps.step4Title')}
        current={retirementPercent}
        target={RETIREMENT_TARGET_PERCENT}
        pickerTrigger={step4Picker.trigger}
        captionOverride={
          step4AccountIds.length === 0
            ? t('babySteps.step4NoAccounts')
            : avgMonthlyIncomeCents > 0
              ? t('babySteps.step4Caption', { percent: retirementPercent.toFixed(1) })
              : t('babySteps.notEnoughHistory')
        }
      />
      {step4Picker.modal}
      {step5AccountIds.length > 0 ? (
        <Step
          number={5}
          title={t('babySteps.step5Title')}
          current={step5Cents}
          target={step5TargetCents}
          pickerTrigger={step5Picker.trigger}
          captionSuffix={
            editingStep5Target ? null : (
              <Text style={styles.linkText} onPress={startEditingStep5Target}>
                {t('babySteps.editTarget', { target: formatMoney(step5TargetCents) })}
              </Text>
            )
          }
          footer={editingStep5Target ? <Step5TargetEditRow /> : null}
        />
      ) : (
        <ManualStep
          number={5}
          title={t('babySteps.step5Title')}
          checked={manual.step5}
          onToggle={() => toggleManual('step5')}
          pickerTrigger={step5Picker.trigger}
        />
      )}
      {step5Picker.modal}
      <Step
        number={6}
        title={t('babySteps.step6Title')}
        current={mortgageDebtCents === 0 ? 1 : 0}
        target={1}
        captionOverride={mortgageDebtCents === 0 ? t('babySteps.step6Done') : t('babySteps.remaining', { amount: formatMoney(mortgageDebtCents) })}
      />
      {step7CategoryIds.length > 0 ? (
        <StatStep
          number={7}
          title={t('babySteps.step7Title')}
          caption={t('babySteps.step7Caption', { amount: formatMoney(donationCentsThisYear), year: currentYear })}
          pickerTrigger={step7Picker.trigger}
        />
      ) : (
        <ManualStep
          number={7}
          title={t('babySteps.step7Title')}
          checked={manual.step7}
          onToggle={() => toggleManual('step7')}
          pickerTrigger={step7Picker.trigger}
        />
      )}
      {step7Picker.modal}

      <View style={styles.goalsHeaderRow}>
        <Text style={styles.title}>{t('babySteps.goalsHeading')}</Text>
        <Pressable onPress={startAddGoal}>
          <Text style={styles.addGoalText}>{t('babySteps.addGoal')}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>{t('babySteps.goalsHint')}</Text>
      {goals.length === 0 && editingGoalId !== 'new' ? <Text style={styles.hint}>{t('babySteps.goalsEmpty')}</Text> : null}
      {editingGoalId === 'new' ? <GoalEditCard /> : null}
      {goals.map((goal) => {
        if (editingGoalId === goal.id) return <GoalEditCard key={goal.id} />;
        const percent = goal.targetCents > 0 ? Math.min(100, Math.round((goal.progressCents / goal.targetCents) * 100)) : 0;
        const linkedAccountName = goal.linkedAccountId != null ? accounts.find((a) => a.account.id === goal.linkedAccountId)?.account.name : null;
        return (
          <Pressable key={goal.id} style={styles.card} onPress={() => startEditGoal(goal)}>
            <Text style={styles.stepTitle}>{goal.name}</Text>
            <ProgressBar percent={percent} color={percent >= 100 ? colors.positive : colors.accent} />
            <Text style={styles.hint}>
              {t('babySteps.progressCaption', { current: formatMoney(goal.progressCents), target: formatMoney(goal.targetCents) })}
              {linkedAccountName ? ` · ${linkedAccountName}` : ''}
            </Text>
          </Pressable>
        );
      })}
      {goalAccountPickerModal}
    </ScreenContainer>
  );

  function Step5TargetEditRow() {
    return (
      <View style={styles.targetEditRow}>
        <TextField
          style={styles.targetEditInput}
          value={step5TargetInput}
          onChangeText={setStep5TargetInput}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
          autoFocus
        />
        <Pressable onPress={saveStep5Target}>
          <Text style={styles.linkText}>{t('common.save')}</Text>
        </Pressable>
      </View>
    );
  }

  function GoalEditCard() {
    const isNew = editingGoalId === 'new';
    return (
      <View style={styles.card}>
        <TextField
          label={t('customGoalModal.nameLabel')}
          value={goalDraftName}
          onChangeText={setGoalDraftName}
          placeholder={t('customGoalModal.namePlaceholder')}
          autoFocus={isNew}
        />
        <TextField
          label={t('customGoalModal.targetLabel')}
          value={goalDraftTargetInput}
          onChangeText={setGoalDraftTargetInput}
          keyboardType="decimal-pad"
          placeholder={t('common.amountPlaceholder')}
        />
        <Text style={styles.linkText} onPress={() => setGoalAccountPickerOpen(true)}>
          {goalAccountLabel} ▾
        </Text>
        {goalDraftAccountId == null ? (
          <TextField
            label={t('customGoalModal.progressLabel')}
            value={goalDraftManualProgressInput}
            onChangeText={setGoalDraftManualProgressInput}
            keyboardType="decimal-pad"
            placeholder={t('common.amountPlaceholder')}
          />
        ) : null}
        <View style={styles.goalActionsRow}>
          {isNew ? <View /> : (
            <Pressable onPress={deleteGoal}>
              <Text style={styles.deleteLinkText}>{t('common.delete')}</Text>
            </Pressable>
          )}
          <View style={styles.goalActionsRight}>
            <Pressable onPress={cancelEditGoal}>
              <Text style={styles.hint}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable onPress={saveGoal}>
              <Text style={styles.linkText}>{t('common.save')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
}

function Step({
  number,
  title,
  current,
  target,
  captionOverride,
  captionSuffix,
  pickerTrigger,
  footer,
}: {
  number: number;
  title: string;
  current: number;
  target: number;
  captionOverride?: string;
  // Rendered on the same row as the caption, pinned to the right (e.g. an
  // "edit target" link) — unlike pickerTrigger, which always gets its own
  // line below so a long caption (Step 3's) doesn't wrap into it.
  captionSuffix?: ReactNode;
  pickerTrigger?: ReactNode;
  footer?: ReactNode;
}) {
  const t = useT();
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const captionText = captionOverride ?? t('babySteps.progressCaption', { current: formatMoney(current), target: formatMoney(target) });
  return (
    <View style={styles.card}>
      <Text style={styles.stepTitle}>{t('babySteps.stepPrefix', { number, title })}</Text>
      <ProgressBar percent={percent} color={percent >= 100 ? colors.positive : colors.accent} />
      {captionSuffix ? (
        <View style={styles.captionRow}>
          <Text style={[styles.hint, styles.captionText]}>{captionText}</Text>
          {captionSuffix}
        </View>
      ) : (
        <Text style={styles.hint}>{captionText}</Text>
      )}
      {pickerTrigger ? <Text style={styles.hint}>{pickerTrigger}</Text> : null}
      {footer}
    </View>
  );
}

// Open-ended stat with no fixed target (e.g. lifetime/annual giving) — a
// caption, no progress bar.
function StatStep({ number, title, caption, pickerTrigger }: { number: number; title: string; caption: string; pickerTrigger?: ReactNode }) {
  const t = useT();
  return (
    <View style={styles.card}>
      <Text style={styles.stepTitle}>{t('babySteps.stepPrefix', { number, title })}</Text>
      <Text style={styles.hint}>{caption}</Text>
      {pickerTrigger ? <Text style={styles.hint}>{pickerTrigger}</Text> : null}
    </View>
  );
}

function ManualStep({
  number,
  title,
  checked,
  onToggle,
  pickerTrigger,
}: {
  number: number;
  title: string;
  checked: boolean;
  onToggle: () => void;
  pickerTrigger?: ReactNode;
}) {
  const t = useT();
  return (
    <View style={styles.card}>
      <Pressable style={styles.manualHeaderRow} onPress={onToggle}>
        <Text style={styles.stepTitle}>{t('babySteps.stepPrefix', { number, title })}</Text>
        <View style={[styles.statusPill, checked && styles.statusPillDone]}>
          <Text style={[styles.statusPillText, checked && styles.statusPillTextDone]}>
            {checked ? t('babySteps.markedDone') : t('babySteps.markDone')}
          </Text>
        </View>
      </Pressable>
      <Text style={styles.hint}>{pickerTrigger}</Text>
    </View>
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
  captionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  captionText: { flex: 1 },
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
  linkText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  deleteLinkText: { fontSize: 12, fontWeight: '700', color: colors.negative },
  targetEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  targetEditInput: { flex: 1, paddingVertical: 6, fontSize: 13 },
  goalsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  addGoalText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  goalActionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  goalActionsRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
