import type { TranslationKey } from '../../../i18n';
import {
  ABROAD_OPTIONS,
  LOAN_OPTIONS,
  OTHER_OPTIONS,
  SAVINGS_OPTIONS,
  SETUP_COUNTRIES,
  SETUP_HOUSING,
  dailyOptions,
  investOptions,
} from '../../../domain/accountSetup';
import type { SetupAnswers, SetupCountry } from '../../../domain/accountSetup';

export interface SetupOption {
  // `<list>:<value>` — which SetupAnswers list it toggles, and the value.
  key: string;
  glyph: string;
  glyphIsText?: boolean;
  label: TranslationKey;
  sub?: TranslationKey;
}

export type SingleStep = 'country' | 'home' | 'cards';
export type MultiStep = 'daily' | 'saving' | 'loans' | 'else';
export type SetupStep = SingleStep | MultiStep | 'review';

export const STEPS: SetupStep[] = [
  'country',
  'home',
  'daily',
  'cards',
  'saving',
  'loans',
  'else',
  'review',
];

export const STEP_TITLE: Record<SetupStep, [TranslationKey, TranslationKey]> = {
  country: ['accountSetup.step.country', 'accountSetup.step.country.sub'],
  home: ['accountSetup.step.home', 'accountSetup.step.home.sub'],
  daily: ['accountSetup.step.daily', 'accountSetup.step.daily.sub'],
  cards: ['accountSetup.step.cards', 'accountSetup.step.cards.sub'],
  saving: ['accountSetup.step.saving', 'accountSetup.step.saving.sub'],
  loans: ['accountSetup.step.loans', 'accountSetup.step.loans.sub'],
  else: ['accountSetup.step.else', 'accountSetup.step.else.sub'],
  review: ['accountSetup.step.review', 'accountSetup.step.review.sub'],
};

export function isSingle(step: SetupStep): step is SingleStep {
  return step === 'country' || step === 'home' || step === 'cards';
}

const GLYPH: Record<string, string> = {
  'country:us': '🇺🇸',
  'country:ca': '🇨🇦',
  'country:uk': '🇬🇧',
  'country:cn': '🇨🇳',
  'country:other': '🌍',
  'housing:rent': '🔑',
  'housing:mortgage': '🏡',
  'housing:owned': '🏠',
  'housing:family': '👨‍👩‍👧',
  'daily:bank': '🏦',
  'daily:bank2': '👥',
  'daily:wallet': '👛',
  'daily:alipay': '📱',
  'daily:wechat': '💬',
  'savings:emergency': '🛟',
  'savings:goal': '🎯',
  'invest:brokerage': '📈',
  'invest:us_401k': '🧓',
  'invest:us_ira': '🧓',
  'invest:us_roth_ira': '🌱',
  'invest:us_529': '🎓',
  'invest:ca_rrsp': '🧓',
  'invest:ca_tfsa': '🌱',
  'invest:ca_fhsa': '🏡',
  'invest:ca_resp': '🎓',
  'invest:uk_pension': '🧓',
  'invest:uk_isa': '🌱',
  'invest:cn_housing_fund': '🏘️',
  'invest:cn_pension': '🧓',
  'invest:pension': '🧓',
  'loans:car': '🚗',
  'loans:student': '🎓',
  'loans:personal': '🧾',
  'loans:line_of_credit': '🔁',
  'abroad:property': '🌏',
  'abroad:mortgage': '🌏',
  'abroad:bank': '💱',
  'other:car': '🚙',
  'other:giving': '🎁',
};

// Only options whose label alone leaves someone guessing get a second line.
const WITH_SUB = new Set([
  'daily:bank',
  'savings:emergency',
  'invest:brokerage',
  'invest:us_401k',
  'invest:us_ira',
  'invest:us_roth_ira',
  'invest:us_529',
  'invest:ca_rrsp',
  'invest:ca_tfsa',
  'invest:ca_fhsa',
  'invest:ca_resp',
  'invest:uk_pension',
  'invest:uk_isa',
  'invest:cn_housing_fund',
  'invest:cn_pension',
  'loans:line_of_credit',
  'abroad:bank',
]);

function option(list: string, value: string): SetupOption {
  const key = `${list}:${value}`;
  return {
    key,
    glyph: GLYPH[key],
    label: `accountSetup.${list}.${value}` as TranslationKey,
    sub: WITH_SUB.has(key)
      ? (`accountSetup.${list}.${value}.sub` as TranslationKey)
      : undefined,
  };
}

export function stepOptions(
  step: SetupStep,
  country: SetupCountry,
): SetupOption[] {
  switch (step) {
    case 'country':
      return SETUP_COUNTRIES.map((c) => option('country', c));
    case 'home':
      return SETUP_HOUSING.map((h) => option('housing', h));
    case 'cards':
      return [0, 1, 2, 3, 4].map((n) => ({
        key: `cards:${n}`,
        glyph: n === 4 ? '4+' : String(n),
        glyphIsText: true,
        label: `accountSetup.cards.${n}` as TranslationKey,
      }));
    case 'daily':
      return dailyOptions(country).map((d) => option('daily', d));
    case 'saving':
      return [
        ...SAVINGS_OPTIONS.map((s) => option('savings', s)),
        ...investOptions(country).map((i) => option('invest', i)),
      ];
    case 'loans':
      return LOAN_OPTIONS.map((l) => option('loans', l));
    case 'else':
      return [
        ...ABROAD_OPTIONS.map((a) => option('abroad', a)),
        ...OTHER_OPTIONS.map((o) => option('other', o)),
      ];
    case 'review':
      return [];
  }
}

type ListField = 'daily' | 'savings' | 'invest' | 'loans' | 'abroad' | 'other';

export function isPicked(answers: SetupAnswers, key: string): boolean {
  const [list, value] = key.split(':');
  if (list === 'country') return answers.country === value;
  if (list === 'housing') return answers.housing === value;
  if (list === 'cards') return answers.creditCards === Number(value);
  return (answers[list as ListField] as string[]).includes(value);
}

export function pick(answers: SetupAnswers, key: string): SetupAnswers {
  const [list, value] = key.split(':');
  if (list === 'country') return { ...answers, country: value as SetupCountry };
  if (list === 'housing')
    return { ...answers, housing: value as SetupAnswers['housing'] };
  if (list === 'cards') return { ...answers, creditCards: Number(value) };
  const field = list as ListField;
  const current = answers[field] as string[];
  return {
    ...answers,
    [field]: current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value],
  };
}

// Whether a multi-choice step has anything ticked — the Next button reads
// "None of these" until it does.
export function anyPicked(step: SetupStep, answers: SetupAnswers): boolean {
  return stepOptions(step, answers.country).some((o) =>
    isPicked(answers, o.key),
  );
}
