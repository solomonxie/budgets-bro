import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScrollView } from 'react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { CollapsibleText } from '../../components/ui/CollapsibleText';
import { GuideSection } from '../../components/ui/GuideSection';
import { TextField } from '../../components/ui/TextField';
import { MoneyField } from '../../components/ui/MoneyField';
import { BottomSheet } from '../../components/ui/BottomSheet';
import {
  DropdownOption,
  DropdownGroupLabel,
} from '../../components/ui/DropdownField';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useCustomGoals } from '../../hooks/useCustomGoals';
import { getDb } from '../../db/client';
import * as settingsRepo from '../../db/repositories/settingsRepo';
import * as reportsRepo from '../../db/repositories/reportsRepo';
import * as customGoalsRepo from '../../db/repositories/customGoalsRepo';
import { accountKind } from '../../domain/accountKind';
import {
  currentMonth,
  formatMonthLabel,
  previousMonth,
} from '../../domain/month';
import { formatMoney } from '../../domain/money';
import {
  paceToPayoff,
  paceToTarget,
  projectYearEnd,
} from '../../domain/babyStepPace';
import type { Pace } from '../../domain/babyStepPace';
import { useAppStore } from '../../state/useAppStore';
import type { CustomGoalWithProgress } from '../../domain/types';
import type { AccountWithBalance } from '../../db/repositories/accountsRepo';
import { localeTag, useT } from '../../i18n';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ExpandingFieldGroup } from '../../components/ui/ExpandingField';

// Whose plan this is. The page reads the seven steps off your ledger; it
// does not try to be the book.
const BABY_STEPS_URL =
  'https://www.ramseysolutions.com/dave-ramsey-7-baby-steps';

// Board-scoped — each board has its own account links, categories and
// checkboxes. `emergencyFundKey` is legacy (a single shared account for
// both Steps 1 and 3, before each step got its own multi-account picker) —
// only read once, to seed the new per-step keys on first load.
const emergencyFundKey = (boardId: number) =>
  `babySteps.emergencyFundAccountId:${boardId}`;
const step1AccountsKey = (boardId: number) =>
  `babySteps.step1AccountIds:${boardId}`;
const step3AccountsKey = (boardId: number) =>
  `babySteps.step3AccountIds:${boardId}`;
const step3bAccountsKey = (boardId: number) =>
  `babySteps.step3bAccountIds:${boardId}`;
const step3bTargetKey = (boardId: number) =>
  `babySteps.step3bTargetCents:${boardId}`;
const step3bHomePriceKey = (boardId: number) =>
  `babySteps.step3bHomePriceCents:${boardId}`;
const step3bDownPaymentKey = (boardId: number) =>
  `babySteps.step3bDownPaymentCents:${boardId}`;
// Where you live: 'rent', 'owned' (no mortgage), or 'mortgage:<accountId>'
// for the one mortgage that is on your own home. Unset until answered.
const homeKey = (boardId: number) => `babySteps.home:${boardId}`;
const step4AccountsKey = (boardId: number) =>
  `babySteps.step4AccountIds:${boardId}`;
const step5AccountsKey = (boardId: number) =>
  `babySteps.step5AccountIds:${boardId}`;
const step5TargetKey = (boardId: number) =>
  `babySteps.step5TargetCents:${boardId}`;
const step7CategoriesKey = (boardId: number) =>
  `babySteps.step7CategoryIds:${boardId}`;
const step7AccountsKey = (boardId: number) =>
  `babySteps.step7AccountIds:${boardId}`;
const manualStepsKey = (boardId: number) => `babySteps.manual:${boardId}`;

const STARTER_FUND_CENTS = 100_000; // $1,000
const RETIREMENT_TARGET_PERCENT = 15;
const DEFAULT_COLLEGE_FUND_TARGET_CENTS = 5_000_000; // $50,000 — just a starting point, editable
const DEFAULT_DOWN_PAYMENT_CENTS = 5_000_000; // $50,000 — 20% of $250,000, editable
const DOWN_PAYMENT_PERCENT = 20;
// The window every pace on this page is read over.
const PACE_MONTHS = 12;
const RETIREMENT_NAME_PATTERN =
  /401\s*\(?k\)?|403\s*\(?b\)?|\bira\b|\brrsp\b|\btfsa\b|pension|retirement/i;

interface ManualSteps {
  step3b: boolean;
  step5: boolean;
  step7: boolean;
}

const NO_MANUAL_STEPS: ManualSteps = {
  step3b: false,
  step5: false,
  step7: false,
};

function trailingMonthsWindow(count: number) {
  const month = currentMonth();
  let start = month;
  for (let i = 0; i < count; i++) start = previousMonth(start);
  return { startDate: `${start}-01`, endDateExclusive: `${month}-01` };
}

function trailingThreeMonthWindow() {
  return trailingMonthsWindow(3);
}

function currentYearWindow() {
  const year = new Date().getFullYear();
  return {
    startDate: `${year}-01-01`,
    endDateExclusive: `${year + 1}-01-01`,
    year,
  };
}

type Home = 'rent' | 'owned' | `mortgage:${number}` | null;

// Three to six months of your own spending; four is the midpoint.
function fullEmergencyFundTargetCentsFor(avgMonthlySpendingCents: number) {
  return avgMonthlySpendingCents * 4;
}

function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

// Dave Ramsey's 7 Baby Steps, with progress computed from real ledger data
// where possible. Steps 1/3/3.5/4/5 link to one or more accounts the user
// picks (Step 4 tries to auto-detect a retirement account by name first);
// Step 7 reads the giving categories picked for it plus every giving
// account on the board. Any step with
// nothing linked yet falls back to a manual "Mark Done" checkbox. Each
// link is a small inline text link (not a boxed field) that opens a
// bottom sheet to pick — kept inline with the step's own progress caption.
// Under every step's numbers sits a short brief in Ramsey's own terms, so
// the plan explains itself where you are reading it.
export function BabyStepsScreen() {
  const t = useT();
  const { accounts } = useAccounts();
  const { groups, categories } = useCategories();
  const { goals, refresh: refreshGoals } = useCustomGoals();
  const bumpDataVersion = useAppStore((s) => s.bumpDataVersion);
  const boardId = useAppStore((s) => s.currentBoardId);

  const [step1AccountIds, setStep1AccountIds] = useState<number[]>([]);
  const [step3AccountIds, setStep3AccountIds] = useState<number[]>([]);
  const [step3bAccountIds, setStep3bAccountIds] = useState<number[]>([]);
  const [downPaymentTargetCents, setDownPaymentTargetCents] = useState(
    DEFAULT_DOWN_PAYMENT_CENTS,
  );
  const [home, setHome] = useState<Home>(null);
  const [homePickerOpen, setHomePickerOpen] = useState(false);
  // Net flow per account over the pace window.
  const [flows, setFlows] = useState<Map<number, number>>(new Map());
  const [step4AccountIds, setStep4AccountIds] = useState<number[]>([]);
  const [step5AccountIds, setStep5AccountIds] = useState<number[]>([]);
  const [step5TargetCents, setStep5TargetCents] = useState(
    DEFAULT_COLLEGE_FUND_TARGET_CENTS,
  );
  const [step7CategoryIds, setStep7CategoryIds] = useState<number[]>([]);
  // Null until picked: every giving-type account counts by default.
  const [step7AccountIds, setStep7AccountIds] = useState<number[] | null>(null);
  const [avgMonthlySpendingCents, setAvgMonthlySpendingCents] = useState(0);
  const [avgMonthlyIncomeCents, setAvgMonthlyIncomeCents] = useState(0);
  const [avgMonthlyRetirementCents, setAvgMonthlyRetirementCents] = useState(0);
  const [donationCentsThisYear, setDonationCentsThisYear] = useState(0);
  const [manual, setManual] = useState<ManualSteps>(NO_MANUAL_STEPS);
  const [editingStep5Target, setEditingStep5Target] = useState(false);
  const [step5TargetInput, setStep5TargetInput] = useState('');
  const [editingStep3bTarget, setEditingStep3bTarget] = useState(false);
  const [step3bTargetInput, setStep3bTargetInput] = useState('');

  const [step1PickerOpen, setStep1PickerOpen] = useState(false);
  const [step3PickerOpen, setStep3PickerOpen] = useState(false);
  const [step3bPickerOpen, setStep3bPickerOpen] = useState(false);
  const [step4PickerOpen, setStep4PickerOpen] = useState(false);
  const [step5PickerOpen, setStep5PickerOpen] = useState(false);
  const [step7PickerOpen, setStep7PickerOpen] = useState(false);
  const [step7AccountPickerOpen, setStep7AccountPickerOpen] = useState(false);

  // Goal editing is inline, not a modal — 'new' while adding, a goal id
  // while editing that one, null otherwise. Only one goal (or the new-goal
  // slot) can be open at a time.
  const scrollRef = useRef<ScrollView>(null);
  const [editingGoalId, setEditingGoalId] = useState<number | 'new' | null>(
    null,
  );
  const [goalDraftName, setGoalDraftName] = useState('');
  const [goalDraftTargetInput, setGoalDraftTargetInput] = useState('');
  const [goalDraftAccountId, setGoalDraftAccountId] = useState<number | null>(
    null,
  );
  const [goalDraftManualProgressInput, setGoalDraftManualProgressInput] =
    useState('');
  const [goalAccountPickerOpen, setGoalAccountPickerOpen] = useState(false);

  // Settings + averages that don't depend on the live accounts list.
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const legacyEmergencyId = await settingsRepo.getSetting(
        db,
        emergencyFundKey(boardId),
      );

      const loadOrSeedAccountIds = async (key: string): Promise<number[]> => {
        const raw = await settingsRepo.getSetting(db, key);
        if (raw != null) return JSON.parse(raw) as number[];
        const seeded = legacyEmergencyId ? [Number(legacyEmergencyId)] : [];
        await settingsRepo.setJsonSetting(db, key, seeded);
        return seeded;
      };
      setStep1AccountIds(await loadOrSeedAccountIds(step1AccountsKey(boardId)));
      setStep3AccountIds(await loadOrSeedAccountIds(step3AccountsKey(boardId)));

      setStep3bAccountIds(
        await settingsRepo.getJsonSetting<number[]>(
          db,
          step3bAccountsKey(boardId),
          [],
        ),
      );
      // Older builds stored a home price (20% of it is the down payment),
      // and before that a typed target; the newest one set wins.
      const legacyHomePrice = await settingsRepo.getJsonSetting<number | null>(
        db,
        step3bHomePriceKey(boardId),
        null,
      );
      const legacyTarget = await settingsRepo.getJsonSetting<number | null>(
        db,
        step3bTargetKey(boardId),
        null,
      );
      setDownPaymentTargetCents(
        await settingsRepo.getJsonSetting<number>(
          db,
          step3bDownPaymentKey(boardId),
          legacyHomePrice != null
            ? Math.round((legacyHomePrice * DOWN_PAYMENT_PERCENT) / 100)
            : (legacyTarget ?? DEFAULT_DOWN_PAYMENT_CENTS),
        ),
      );
      setHome(
        await settingsRepo.getJsonSetting<Home>(db, homeKey(boardId), null),
      );
      setStep5AccountIds(
        await settingsRepo.getJsonSetting<number[]>(
          db,
          step5AccountsKey(boardId),
          [],
        ),
      );
      setStep5TargetCents(
        await settingsRepo.getJsonSetting<number>(
          db,
          step5TargetKey(boardId),
          DEFAULT_COLLEGE_FUND_TARGET_CENTS,
        ),
      );
      setStep7CategoryIds(
        await settingsRepo.getJsonSetting<number[]>(
          db,
          step7CategoriesKey(boardId),
          [],
        ),
      );
      setStep7AccountIds(
        await settingsRepo.getJsonSetting<number[] | null>(
          db,
          step7AccountsKey(boardId),
          null,
        ),
      );
      setManual(
        await settingsRepo.getJsonSetting<ManualSteps>(
          db,
          manualStepsKey(boardId),
          NO_MANUAL_STEPS,
        ),
      );

      const { startDate, endDateExclusive } = trailingThreeMonthWindow();
      const totals = await reportsRepo.incomeAndSpendingInRange(
        db,
        boardId,
        startDate,
        endDateExclusive,
      );
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
      const detected = accounts
        .filter((a) => RETIREMENT_NAME_PATTERN.test(a.account.name))
        .map((a) => a.account.id);
      setStep4AccountIds(detected);
      await settingsRepo.setJsonSetting(
        db,
        step4AccountsKey(boardId),
        detected,
      );
    })();
  }, [boardId, accounts]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const { startDate, endDateExclusive } = trailingThreeMonthWindow();
      const totalCents = await reportsRepo.depositsIntoAccountsInRange(
        db,
        boardId,
        step4AccountIds,
        startDate,
        endDateExclusive,
      );
      setAvgMonthlyRetirementCents(Math.round(totalCents / 3));
    })();
  }, [boardId, step4AccountIds]);

  // Giving is counted from both ends: what was spent out of the categories
  // picked for it, and what was moved into the accounts picked for it —
  // money set aside to give is given as far as this step is concerned,
  // whether or not it has left yet. Until accounts are picked, every giving
  // account counts (see domain/accountKind).
  const defaultGivingAccountIds = useMemo(
    () =>
      accounts
        .filter((a) => a.account.type === 'giving')
        .map((a) => a.account.id),
    [accounts],
  );
  const givingAccountIds = step7AccountIds ?? defaultGivingAccountIds;

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const { startDate, endDateExclusive } = currentYearWindow();
      const [categoryCents, setAsideCents] = await Promise.all([
        reportsRepo.categorySpendingInRange(
          db,
          boardId,
          step7CategoryIds,
          startDate,
          endDateExclusive,
        ),
        reportsRepo.depositsIntoAccountsInRange(
          db,
          boardId,
          givingAccountIds,
          startDate,
          endDateExclusive,
        ),
      ]);
      setDonationCentsThisYear(categoryCents + setAsideCents);
    })();
  }, [boardId, step7CategoryIds, givingAccountIds]);

  const debtAccountIds = useMemo(
    () =>
      accounts
        .filter(
          (a) => a.account.type === 'credit_card' || a.account.type === 'loan',
        )
        .map((a) => a.account.id),
    [accounts],
  );
  const mortgageAccounts = useMemo(
    () => accounts.filter((a) => a.account.type === 'mortgage'),
    [accounts],
  );

  // Every pace on the page from one grouped read of the linked accounts.
  const paceAccountKey = [
    ...step1AccountIds,
    ...step3AccountIds,
    ...step3bAccountIds,
    ...step5AccountIds,
    ...debtAccountIds,
    ...mortgageAccounts.map((a) => a.account.id),
  ].join(',');
  useEffect(() => {
    const ids = [
      ...new Set(paceAccountKey.split(',').filter(Boolean).map(Number)),
    ];
    (async () => {
      const db = await getDb();
      const { startDate, endDateExclusive } = trailingMonthsWindow(PACE_MONTHS);
      setFlows(
        await reportsRepo.netFlowByAccountInRange(
          db,
          boardId,
          ids,
          startDate,
          endDateExclusive,
        ),
      );
    })();
  }, [boardId, paceAccountKey]);

  const monthlyFlow = (ids: number[]) =>
    Math.round(
      ids.reduce((sum, id) => sum + (flows.get(id) ?? 0), 0) / PACE_MONTHS,
    );

  const cashLikeAccounts = accounts.filter((a) =>
    ['Cash', 'Savings'].includes(accountKind(a.account.type)),
  );
  // Broader pool for retirement/college funds — tracking/asset accounts
  // (brokerage, 529, etc.) count too, just not debt or the Income tag.
  const investableAccounts = accounts.filter(
    (a) => !['credit_card', 'loan', 'mortgage'].includes(a.account.type),
  );

  const sumBalances = (ids: number[]) =>
    accounts
      .filter((a) => ids.includes(a.account.id))
      .reduce((sum, a) => sum + a.balanceCents, 0);
  const step1Cents = sumBalances(step1AccountIds);
  const step3Cents = sumBalances(step3AccountIds);
  const step3bCents = sumBalances(step3bAccountIds);
  const step5Cents = sumBalances(step5AccountIds);

  // Step 3.5 is for anyone who doesn't own the home they live in: save 20%
  // down before buying, with Steps 4–6 paused until then. A mortgage on the
  // board doesn't settle it — a rental or a second property isn't your home
  // — so the page asks, and until it's answered a board with no mortgage at
  // all is taken to be renting.
  const homeMortgage =
    home?.startsWith('mortgage:') === true
      ? mortgageAccounts.find((a) => `mortgage:${a.account.id}` === home)
      : undefined;
  const ownsHome = home === 'owned' || homeMortgage != null;
  const rentsHome =
    home === 'rent' ||
    (home?.startsWith('mortgage:') === true && homeMortgage == null) ||
    (home == null && mortgageAccounts.length === 0);
  const showStep3b = !ownsHome;
  const step3bSaved =
    step3bAccountIds.length > 0 && step3bCents >= downPaymentTargetCents;
  const step3bDone = step3bSaved || manual.step3b;
  const pausedForHome = rentsHome && !step3bDone;

  const owed = (list: AccountWithBalance[]) =>
    list.reduce((sum, a) => sum + Math.max(0, -a.balanceCents), 0);
  const nonMortgageDebtCents = owed(
    accounts.filter((a) => debtAccountIds.includes(a.account.id)),
  );
  const mortgageDebtCents = homeMortgage ? owed([homeMortgage]) : 0;
  const otherMortgageDebtCents = owed(
    mortgageAccounts.filter((a) => a !== homeMortgage),
  );

  const month = currentMonth();
  const step1Pace = paceToTarget(
    step1Cents,
    STARTER_FUND_CENTS,
    monthlyFlow(step1AccountIds),
    month,
  );
  const step2Pace = paceToPayoff(
    nonMortgageDebtCents,
    monthlyFlow(debtAccountIds),
    month,
  );
  const step3Pace = paceToTarget(
    step3Cents,
    fullEmergencyFundTargetCentsFor(avgMonthlySpendingCents),
    monthlyFlow(step3AccountIds),
    month,
  );
  const step3bPace = paceToTarget(
    step3bCents,
    downPaymentTargetCents,
    monthlyFlow(step3bAccountIds),
    month,
  );
  const step5Pace = paceToTarget(
    step5Cents,
    step5TargetCents,
    monthlyFlow(step5AccountIds),
    month,
  );
  const step6Pace = homeMortgage
    ? paceToPayoff(
        mortgageDebtCents,
        monthlyFlow([homeMortgage.account.id]),
        month,
      )
    : null;
  const monthsIntoYear = new Date().getMonth() + 1;
  const retirementTargetMonthlyCents = Math.round(
    (avgMonthlyIncomeCents * RETIREMENT_TARGET_PERCENT) / 100,
  );
  const fullEmergencyFundTargetCents = fullEmergencyFundTargetCentsFor(
    avgMonthlySpendingCents,
  );
  const retirementPercent =
    avgMonthlyIncomeCents > 0
      ? (avgMonthlyRetirementCents / avgMonthlyIncomeCents) * 100
      : 0;

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

  const toggleStep7Account = (id: number) => {
    const next = toggleId(givingAccountIds, id);
    setStep7AccountIds(next);
    persistAccountIds(step7AccountsKey(boardId), next);
  };

  const chooseHome = async (next: Home) => {
    setHome(next);
    setHomePickerOpen(false);
    const db = await getDb();
    await settingsRepo.setJsonSetting(db, homeKey(boardId), next);
  };

  const toggleStep3bAccount = async (id: number) => {
    const next = toggleId(step3bAccountIds, id);
    setStep3bAccountIds(next);
    const db = await getDb();
    await settingsRepo.setJsonSetting(db, step3bAccountsKey(boardId), next);
  };
  const startEditingStep3bTarget = () => {
    setStep3bTargetInput(String(downPaymentTargetCents / 100));
    setEditingStep3bTarget(true);
  };
  const saveStep3bTarget = async () => {
    const cents = Math.round((parseFloat(step3bTargetInput) || 0) * 100);
    setDownPaymentTargetCents(cents);
    setEditingStep3bTarget(false);
    const db = await getDb();
    await settingsRepo.setJsonSetting(db, step3bDownPaymentKey(boardId), cents);
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
    // The goals live at the foot of a long page, so a new one opens exactly
    // where the keyboard is about to be. Wait a frame for the card to lay
    // out, then bring it up with it.
    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
  };
  const startEditGoal = (goal: CustomGoalWithProgress) => {
    setEditingGoalId(goal.id);
    setGoalDraftName(goal.name);
    setGoalDraftTargetInput(String(goal.targetCents / 100));
    setGoalDraftAccountId(goal.linkedAccountId);
    setGoalDraftManualProgressInput(
      goal.manualProgressCents != null
        ? String(goal.manualProgressCents / 100)
        : '',
    );
  };
  const cancelEditGoal = () => setEditingGoalId(null);
  const saveGoal = async () => {
    if (!goalDraftName.trim()) return;
    const db = await getDb();
    const input = {
      name: goalDraftName.trim(),
      targetCents: Math.round((parseFloat(goalDraftTargetInput) || 0) * 100),
      linkedAccountId: goalDraftAccountId,
      manualProgressCents:
        goalDraftAccountId == null
          ? Math.round((parseFloat(goalDraftManualProgressInput) || 0) * 100)
          : null,
    };
    if (typeof editingGoalId === 'number')
      await customGoalsRepo.updateGoal(db, editingGoalId, input);
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
  const accountLinkLabel = (
    ids: number[],
    pool: AccountWithBalance[],
    fieldLabel: string,
  ) => {
    if (ids.length === 0) return fieldLabel;
    if (ids.length === 1)
      return (
        pool.find((a) => a.account.id === ids[0])?.account.name ?? fieldLabel
      );
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
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <BottomSheet title={fieldLabel} onClose={() => setOpen(false)}>
          {pool.map((a) => (
            <DropdownOption
              key={a.account.id}
              label={a.account.name}
              selected={ids.includes(a.account.id)}
              onPress={() => onToggle(a.account.id)}
            />
          ))}
          {pool.length === 0 ? (
            <Text style={styles.hint}>
              {t('babySteps.noAccountsAvailable')}
            </Text>
          ) : null}
        </BottomSheet>
      </Modal>
    ),
  });

  const categoryLinkLabel = (ids: number[], fieldLabel: string) => {
    if (ids.length === 0) return fieldLabel;
    if (ids.length === 1)
      return categories.find((c) => c.id === ids[0])?.name ?? fieldLabel;
    return t('babySteps.categoriesCount', { count: ids.length });
  };

  const step1Picker = accountPicker(
    cashLikeAccounts,
    step1AccountIds,
    toggleStep1Account,
    step1PickerOpen,
    setStep1PickerOpen,
    t('babySteps.emergencyFundAccountsLabel'),
  );
  const step3Picker = accountPicker(
    cashLikeAccounts,
    step3AccountIds,
    toggleStep3Account,
    step3PickerOpen,
    setStep3PickerOpen,
    t('babySteps.emergencyFundAccountsLabel'),
  );
  const step3bPicker = accountPicker(
    investableAccounts,
    step3bAccountIds,
    toggleStep3bAccount,
    step3bPickerOpen,
    setStep3bPickerOpen,
    t('babySteps.downPaymentAccountsLabel'),
  );
  const step4Picker = accountPicker(
    investableAccounts,
    step4AccountIds,
    toggleStep4Account,
    step4PickerOpen,
    setStep4PickerOpen,
    t('babySteps.retirementAccountsLabel'),
  );
  const step5Picker = accountPicker(
    investableAccounts,
    step5AccountIds,
    toggleStep5Account,
    step5PickerOpen,
    setStep5PickerOpen,
    t('babySteps.educationAccountsLabel'),
  );
  // Giving is either spent out of a category or set aside in an account —
  // one picker each, both multi-select, both counted.
  const step7CategoryPicker = {
    trigger: (
      <Text style={styles.linkText} onPress={() => setStep7PickerOpen(true)}>
        {categoryLinkLabel(
          step7CategoryIds,
          t('babySteps.givingCategoriesLabel'),
        )}{' '}
        ▾
      </Text>
    ),
    modal: (
      <Modal
        visible={step7PickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setStep7PickerOpen(false)}
      >
        <BottomSheet
          title={t('babySteps.givingCategoriesLabel')}
          onClose={() => setStep7PickerOpen(false)}
        >
          {groups.map((group) => {
            const groupCategories = categories.filter(
              (c) => c.groupId === group.id,
            );
            if (groupCategories.length === 0) return null;
            return (
              <View key={group.id}>
                <DropdownGroupLabel label={group.name} />
                {groupCategories.map((c) => (
                  <DropdownOption
                    key={c.id}
                    label={`${c.icon ? c.icon + ' ' : ''}${c.name}`}
                    selected={step7CategoryIds.includes(c.id)}
                    onPress={() => toggleStep7Category(c.id)}
                  />
                ))}
              </View>
            );
          })}
          {categories.length === 0 ? (
            <Text style={styles.hint}>
              {t('babySteps.noCategoriesAvailable')}
            </Text>
          ) : null}
        </BottomSheet>
      </Modal>
    ),
  };
  const step7AccountPicker = accountPicker(
    investableAccounts,
    givingAccountIds,
    toggleStep7Account,
    step7AccountPickerOpen,
    setStep7AccountPickerOpen,
    t('babySteps.givingAccountsLabel'),
  );
  const step7Triggers = (
    <>
      {step7CategoryPicker.trigger}
      {'   '}
      {step7AccountPicker.trigger}
    </>
  );

  // Single-select — a goal links to at most one account. The first sheet
  // option unlinks back to manual tracking, same idea as a category
  // picker's "Uncategorized" option.
  const goalAccountLabel =
    goalDraftAccountId == null
      ? t('babySteps.goalAccountLabel')
      : (accounts.find((a) => a.account.id === goalDraftAccountId)?.account
          .name ?? t('babySteps.goalAccountLabel'));
  const goalAccountPickerModal = (
    <Modal
      visible={goalAccountPickerOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setGoalAccountPickerOpen(false)}
    >
      <BottomSheet
        title={t('babySteps.goalAccountLabel')}
        onClose={() => setGoalAccountPickerOpen(false)}
      >
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
  const language = useAppStore((s) => s.language);

  const paceText = (pace: Pace | null): string | null => {
    if (!pace || pace.kind === 'done') return null;
    if (pace.kind === 'stalled') return t('babySteps.paceStalled');
    if (pace.kind === 'far')
      return t('babySteps.paceFar', { pace: formatMoney(pace.monthlyCents) });
    return t('babySteps.paceEta', {
      pace: formatMoney(pace.monthlyCents),
      date: formatMonthLabel(pace.doneBy, localeTag(language)),
    });
  };

  const homeLabel =
    home === 'rent'
      ? t('babySteps.homeRent')
      : home === 'owned'
        ? t('babySteps.homeOwned')
        : homeMortgage
          ? t('babySteps.homeWithMortgage', { name: homeMortgage.account.name })
          : t('babySteps.homeLabel');
  const homeTrigger = (
    <Text style={styles.linkText} onPress={() => setHomePickerOpen(true)}>
      {homeLabel} ▾
    </Text>
  );
  const homePickerModal = (
    <Modal
      visible={homePickerOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setHomePickerOpen(false)}
    >
      <BottomSheet
        title={t('babySteps.homeLabel')}
        onClose={() => setHomePickerOpen(false)}
      >
        <DropdownOption
          label={t('babySteps.homeRent')}
          selected={home === 'rent'}
          onPress={() => chooseHome('rent')}
        />
        <DropdownOption
          label={t('babySteps.homeOwned')}
          selected={home === 'owned'}
          onPress={() => chooseHome('owned')}
        />
        {mortgageAccounts.map((a) => (
          <DropdownOption
            key={a.account.id}
            label={t('babySteps.homeWithMortgage', { name: a.account.name })}
            selected={home === `mortgage:${a.account.id}`}
            onPress={() => chooseHome(`mortgage:${a.account.id}`)}
          />
        ))}
      </BottomSheet>
    </Modal>
  );

  return (
    <ScreenContainer scroll scrollRef={scrollRef}>
      <ExpandingFieldGroup>
        {/* One line above the first bar, not a paragraph: anyone who wants
            the shape of the plan before the numbers can have it from the
            man who wrote it, and everyone else gets straight to their own
            progress. The prose waits at the bottom. */}
        <Pressable hitSlop={8} onPress={() => Linking.openURL(BABY_STEPS_URL)}>
          <Text style={styles.learnMore}>{t('babySteps.learnMore')}</Text>
        </Pressable>
        <Step
          number={1}
          title={t('babySteps.step1Title')}
          blurb={t('babySteps.step1Blurb')}
          current={step1Cents}
          target={STARTER_FUND_CENTS}
          pickerTrigger={step1Picker.trigger}
          pace={step1AccountIds.length > 0 ? paceText(step1Pace) : null}
        />
        {step1Picker.modal}
        <Step
          number={2}
          title={t('babySteps.step2Title')}
          blurb={t('babySteps.step2Blurb')}
          current={nonMortgageDebtCents === 0 ? 1 : 0}
          target={1}
          captionOverride={
            nonMortgageDebtCents === 0
              ? t('common.done')
              : t('babySteps.remaining', {
                  amount: formatMoney(nonMortgageDebtCents),
                })
          }
          pace={paceText(step2Pace)}
        />
        <Step
          number={3}
          title={t('babySteps.step3Title')}
          blurb={t('babySteps.step3Blurb')}
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
          pace={
            step3AccountIds.length > 0 && avgMonthlySpendingCents > 0
              ? paceText(step3Pace)
              : null
          }
        />
        {step3Picker.modal}
        {showStep3b ? (
          <>
            {step3bAccountIds.length > 0 ? (
              <Step
                number={3.5}
                title={t('babySteps.step3bTitle')}
                blurb={t('babySteps.step3bBlurb')}
                current={step3bCents}
                target={downPaymentTargetCents}
                captionOverride={t('babySteps.step3bCaption', {
                  current: formatMoney(step3bCents),
                  target: formatMoney(downPaymentTargetCents),
                })}
                markDone={{
                  checked: step3bDone,
                  onToggle: step3bSaved
                    ? undefined
                    : () => toggleManual('step3b'),
                }}
                pickerTrigger={
                  <>
                    {step3bPicker.trigger}
                    {editingStep3bTarget ? null : (
                      <>
                        {'   '}
                        <Text
                          style={styles.linkText}
                          onPress={startEditingStep3bTarget}
                        >
                          {t('babySteps.editDownPayment', {
                            amount: formatMoney(downPaymentTargetCents),
                          })}
                        </Text>
                      </>
                    )}
                  </>
                }
                footer={editingStep3bTarget ? step3bTargetEditRow() : null}
                pace={paceText(step3bPace)}
              />
            ) : (
              <ManualStep
                number={3.5}
                title={t('babySteps.step3bTitle')}
                blurb={t('babySteps.step3bBlurb')}
                checked={manual.step3b}
                onToggle={() => toggleManual('step3b')}
                pickerTrigger={step3bPicker.trigger}
              />
            )}
            {step3bPicker.modal}
          </>
        ) : null}
        <Step
          number={4}
          title={t('babySteps.step4Title')}
          blurb={t('babySteps.step4Blurb')}
          current={retirementPercent}
          target={RETIREMENT_TARGET_PERCENT}
          pickerTrigger={step4Picker.trigger}
          captionOverride={
            step4AccountIds.length === 0
              ? t('babySteps.step4NoAccounts')
              : avgMonthlyIncomeCents > 0
                ? t('babySteps.step4Caption', {
                    percent: retirementPercent.toFixed(1),
                  })
                : t('babySteps.notEnoughHistory')
          }
          paused={pausedForHome}
          pace={
            step4AccountIds.length > 0 &&
            avgMonthlyIncomeCents > 0 &&
            avgMonthlyRetirementCents < retirementTargetMonthlyCents
              ? t('babySteps.step4Gap', {
                  gap: formatMoney(
                    retirementTargetMonthlyCents - avgMonthlyRetirementCents,
                  ),
                })
              : null
          }
        />
        {step4Picker.modal}
        {step5AccountIds.length > 0 ? (
          <Step
            number={5}
            title={t('babySteps.step5Title')}
            blurb={t('babySteps.step5Blurb')}
            current={step5Cents}
            target={step5TargetCents}
            pickerTrigger={step5Picker.trigger}
            captionSuffix={
              editingStep5Target ? null : (
                <Text style={styles.linkText} onPress={startEditingStep5Target}>
                  {t('babySteps.editTarget', {
                    target: formatMoney(step5TargetCents),
                  })}
                </Text>
              )
            }
            footer={editingStep5Target ? step5TargetEditRow() : null}
            paused={pausedForHome}
            pace={paceText(step5Pace)}
          />
        ) : (
          <ManualStep
            number={5}
            title={t('babySteps.step5Title')}
            blurb={t('babySteps.step5Blurb')}
            checked={manual.step5}
            onToggle={() => toggleManual('step5')}
            pickerTrigger={step5Picker.trigger}
            paused={pausedForHome}
          />
        )}
        {step5Picker.modal}
        <Step
          number={6}
          title={t('babySteps.step6Title')}
          blurb={t('babySteps.step6Blurb')}
          current={ownsHome && mortgageDebtCents === 0 ? 1 : 0}
          target={1}
          captionOverride={
            !ownsHome
              ? t('babySteps.step6NoHome')
              : mortgageDebtCents === 0
                ? t('babySteps.step6Done')
                : t('babySteps.remaining', {
                    amount: formatMoney(mortgageDebtCents),
                  })
          }
          paused={pausedForHome}
          pace={paceText(step6Pace)}
          pickerTrigger={ownsHome ? null : homeTrigger}
          footer={
            otherMortgageDebtCents > 0 ? (
              <Text style={styles.hint}>
                {t('babySteps.otherMortgages', {
                  amount: formatMoney(otherMortgageDebtCents),
                })}
              </Text>
            ) : null
          }
        />
        {homePickerModal}
        {step7CategoryIds.length > 0 || givingAccountIds.length > 0 ? (
          <StatStep
            number={7}
            title={t('babySteps.step7Title')}
            blurb={t('babySteps.step7Blurb')}
            caption={t('babySteps.step7Caption', {
              amount: formatMoney(donationCentsThisYear),
              year: currentYear,
            })}
            pace={
              donationCentsThisYear > 0 && monthsIntoYear < 12
                ? t('babySteps.step7Pace', {
                    amount: formatMoney(
                      projectYearEnd(donationCentsThisYear, monthsIntoYear),
                    ),
                  })
                : null
            }
            pickerTrigger={step7Triggers}
          />
        ) : (
          <ManualStep
            number={7}
            title={t('babySteps.step7Title')}
            blurb={t('babySteps.step7Blurb')}
            checked={manual.step7}
            onToggle={() => toggleManual('step7')}
            pickerTrigger={step7Triggers}
          />
        )}
        {step7CategoryPicker.modal}
        {step7AccountPicker.modal}

        <View style={styles.goalsHeaderRow}>
          <Text style={styles.title}>{t('babySteps.goalsHeading')}</Text>
          <Pressable onPress={startAddGoal}>
            <Text style={styles.addGoalText}>{t('babySteps.addGoal')}</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>{t('babySteps.goalsHint')}</Text>
        {goals.length === 0 && editingGoalId !== 'new' ? (
          <Text style={styles.hint}>{t('babySteps.goalsEmpty')}</Text>
        ) : null}
        {editingGoalId === 'new' ? goalEditCard() : null}
        {goals.map((goal) => {
          if (editingGoalId === goal.id) return goalEditCard(goal.id);
          const percent =
            goal.targetCents > 0
              ? Math.min(
                  100,
                  Math.round((goal.progressCents / goal.targetCents) * 100),
                )
              : 0;
          const linkedAccountName =
            goal.linkedAccountId != null
              ? accounts.find((a) => a.account.id === goal.linkedAccountId)
                  ?.account.name
              : null;
          return (
            <Pressable
              key={goal.id}
              style={styles.card}
              onPress={() => startEditGoal(goal)}
            >
              <Text style={styles.stepTitle}>{goal.name}</Text>
              <ProgressBar
                segments={[
                  {
                    percent,
                    color: percent >= 100 ? colors.positive : colors.accent,
                  },
                ]}
              />
              <Text style={styles.hint}>
                {t('babySteps.progressCaption', {
                  current: formatMoney(goal.progressCents),
                  target: formatMoney(goal.targetCents),
                })}
                {linkedAccountName ? ` · ${linkedAccountName}` : ''}
              </Text>
            </Pressable>
          );
        })}
        {goalAccountPickerModal}

        <GuideSection
          heading={t('babySteps.whyHeading')}
          body={t('babySteps.whyBody')}
        />
        <GuideSection
          heading={t('babySteps.introHeading')}
          body={t('babySteps.intro')}
        />
        <GuideSection
          heading={t('babySteps.measuredHeading')}
          body={t('babySteps.measuredBody')}
        />
      </ExpandingFieldGroup>
    </ScreenContainer>
  );

  // Rendered by calling these, never as <Component /> — a component
  // declared inside this one is a brand-new type on every render, so React
  // throws the subtree away and builds it again on each keystroke: the card
  // flashes, the field loses focus and the keyboard shuts.
  function step3bTargetEditRow() {
    return (
      <View style={styles.targetEditRow}>
        <MoneyField
          style={styles.targetEditInput}
          value={step3bTargetInput}
          onChangeText={setStep3bTargetInput}
          placeholder={t('common.amountPlaceholder')}
          autoFocus
        />
        <Pressable onPress={saveStep3bTarget}>
          <Text style={styles.linkText}>{t('common.save')}</Text>
        </Pressable>
      </View>
    );
  }

  function step5TargetEditRow() {
    return (
      <View style={styles.targetEditRow}>
        <MoneyField
          style={styles.targetEditInput}
          value={step5TargetInput}
          onChangeText={setStep5TargetInput}
          placeholder={t('common.amountPlaceholder')}
          autoFocus
        />
        <Pressable onPress={saveStep5Target}>
          <Text style={styles.linkText}>{t('common.save')}</Text>
        </Pressable>
      </View>
    );
  }

  function goalEditCard(key?: number) {
    const isNew = editingGoalId === 'new';
    return (
      <View key={key} style={styles.card}>
        <TextField
          label={t('customGoalModal.nameLabel')}
          value={goalDraftName}
          onChangeText={setGoalDraftName}
          placeholder={t('customGoalModal.namePlaceholder')}
          autoFocus={isNew}
        />
        <MoneyField
          label={t('customGoalModal.targetLabel')}
          value={goalDraftTargetInput}
          onChangeText={setGoalDraftTargetInput}
          placeholder={t('common.amountPlaceholder')}
        />
        <Text
          style={styles.linkText}
          onPress={() => setGoalAccountPickerOpen(true)}
        >
          {goalAccountLabel} ▾
        </Text>
        {goalDraftAccountId == null ? (
          <MoneyField
            label={t('customGoalModal.progressLabel')}
            value={goalDraftManualProgressInput}
            onChangeText={setGoalDraftManualProgressInput}
            placeholder={t('common.amountPlaceholder')}
          />
        ) : null}
        <View style={styles.goalActionsRow}>
          {isNew ? (
            <View />
          ) : (
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
  blurb,
  current,
  target,
  captionOverride,
  captionSuffix,
  pickerTrigger,
  footer,
  pace,
  paused,
  markDone,
}: {
  number: number;
  title: string;
  // Dave Ramsey's own reasoning for the step, under its numbers.
  blurb?: string;
  current: number;
  target: number;
  // Top-right pill, as on a ManualStep; no onToggle when the balance
  // already settles it.
  markDone?: { checked: boolean; onToggle?: () => void };
  // When it gets done at the recent pace (see domain/babyStepPace).
  pace?: string | null;
  // Waiting on Step 3.5: shown, dimmed, with no pace.
  paused?: boolean;
  captionOverride?: string;
  // Rendered on the same row as the caption, pinned to the right (e.g. an
  // "edit target" link) — unlike pickerTrigger, which always gets its own
  // line below so a long caption (Step 3's) doesn't wrap into it.
  captionSuffix?: ReactNode;
  pickerTrigger?: ReactNode;
  footer?: ReactNode;
}) {
  const t = useT();
  const percent =
    target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const captionText =
    captionOverride ??
    t('babySteps.progressCaption', {
      current: formatMoney(current),
      target: formatMoney(target),
    });
  return (
    <View style={[styles.card, paused && styles.cardPaused]}>
      {markDone ? (
        <Pressable
          style={styles.manualHeaderRow}
          onPress={markDone.onToggle}
          disabled={!markDone.onToggle}
        >
          <Text style={styles.stepTitle}>
            {t('babySteps.stepPrefix', { number, title })}
          </Text>
          <StatusPill checked={markDone.checked} />
        </Pressable>
      ) : (
        <Text style={styles.stepTitle}>
          {t('babySteps.stepPrefix', { number, title })}
        </Text>
      )}
      <ProgressBar
        segments={[
          { percent, color: percent >= 100 ? colors.positive : colors.accent },
        ]}
      />
      {captionSuffix ? (
        <View style={styles.captionRow}>
          <Text style={[styles.hint, styles.captionText]}>{captionText}</Text>
          {captionSuffix}
        </View>
      ) : (
        <Text style={styles.hint}>{captionText}</Text>
      )}
      <PaceLine pace={pace} paused={paused} />
      {blurb ? (
        <CollapsibleText
          text={blurb}
          maxLines={2}
          style={styles.blurb}
          background={colors.surface}
        />
      ) : null}
      {pickerTrigger ? <Text style={styles.hint}>{pickerTrigger}</Text> : null}
      {footer}
    </View>
  );
}

function PaceLine({
  pace,
  paused,
}: {
  pace?: string | null;
  paused?: boolean;
}) {
  const t = useT();
  if (paused)
    return <Text style={styles.pausedText}>{t('babySteps.paused')}</Text>;
  return pace ? <Text style={styles.paceText}>{pace}</Text> : null;
}

// Open-ended stat with no fixed target (e.g. lifetime/annual giving) — a
// caption, no progress bar.
function StatStep({
  number,
  title,
  blurb,
  caption,
  pickerTrigger,
  pace,
}: {
  number: number;
  title: string;
  blurb?: string;
  caption: string;
  pickerTrigger?: ReactNode;
  pace?: string | null;
}) {
  const t = useT();
  return (
    <View style={styles.card}>
      <Text style={styles.stepTitle}>
        {t('babySteps.stepPrefix', { number, title })}
      </Text>
      <Text style={styles.hint}>{caption}</Text>
      <PaceLine pace={pace} />
      {blurb ? (
        <CollapsibleText
          text={blurb}
          maxLines={2}
          style={styles.blurb}
          background={colors.surface}
        />
      ) : null}
      {pickerTrigger ? <Text style={styles.hint}>{pickerTrigger}</Text> : null}
    </View>
  );
}

function ManualStep({
  number,
  title,
  blurb,
  checked,
  onToggle,
  pickerTrigger,
  paused,
}: {
  number: number;
  title: string;
  blurb?: string;
  checked: boolean;
  onToggle: () => void;
  pickerTrigger?: ReactNode;
  paused?: boolean;
}) {
  const t = useT();
  return (
    <View style={[styles.card, paused && styles.cardPaused]}>
      <Pressable style={styles.manualHeaderRow} onPress={onToggle}>
        <Text style={styles.stepTitle}>
          {t('babySteps.stepPrefix', { number, title })}
        </Text>
        <StatusPill checked={checked} />
      </Pressable>
      <PaceLine paused={paused} />
      {blurb ? (
        <CollapsibleText
          text={blurb}
          maxLines={2}
          style={styles.blurb}
          background={colors.surface}
        />
      ) : null}
      <Text style={styles.hint}>{pickerTrigger}</Text>
    </View>
  );
}

function StatusPill({ checked }: { checked: boolean }) {
  const t = useT();
  return (
    <View style={[styles.statusPill, checked && styles.statusPillDone]}>
      <Text
        style={[styles.statusPillText, checked && styles.statusPillTextDone]}
      >
        {checked ? t('babySteps.markedDone') : t('babySteps.markDone')}
      </Text>
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
  cardPaused: { opacity: 0.55 },
  paceText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  pausedText: { fontSize: 12, fontWeight: '600', color: colors.amber },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  blurb: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  captionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  captionText: { flex: 1 },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  manualHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  statusPillDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  statusPillText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  statusPillTextDone: { color: '#fff' },
  linkText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  learnMore: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: spacing.md,
  },
  deleteLinkText: { fontSize: 12, fontWeight: '700', color: colors.negative },
  targetEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  targetEditInput: { flex: 1, paddingVertical: 6, fontSize: 13 },
  goalsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addGoalText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  goalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  goalActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
