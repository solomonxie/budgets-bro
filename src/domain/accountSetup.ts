import type { TranslationKey } from '../i18n';
import type { AccountType, TrackingKind } from './types';

// The questionnaire behind "Set up my accounts": a handful of answers turned
// into the accounts someone in that situation usually keeps.

export type SetupCountry = 'us' | 'ca' | 'uk' | 'cn' | 'other';
export type SetupHousing = 'rent' | 'mortgage' | 'owned' | 'family';
export type DailyOption = 'bank' | 'bank2' | 'wallet' | 'alipay' | 'wechat';
export type SavingsOption = 'emergency' | 'goal';
export type InvestOption =
  | 'brokerage'
  | 'us_401k'
  | 'us_ira'
  | 'us_roth_ira'
  | 'us_529'
  | 'ca_rrsp'
  | 'ca_tfsa'
  | 'ca_fhsa'
  | 'ca_resp'
  | 'uk_pension'
  | 'uk_isa'
  | 'cn_housing_fund'
  | 'cn_pension'
  | 'pension';
export type LoanOption = 'car' | 'student' | 'personal' | 'line_of_credit';
export type AbroadOption = 'property' | 'mortgage' | 'bank';
export type OtherOption = 'car' | 'giving';

export interface SetupAnswers {
  country: SetupCountry;
  housing: SetupHousing;
  daily: DailyOption[];
  creditCards: number;
  savings: SavingsOption[];
  invest: InvestOption[];
  loans: LoanOption[];
  abroad: AbroadOption[];
  other: OtherOption[];
}

export interface SuggestedAccount {
  id: string;
  nameKey: TranslationKey;
  nameVars?: Record<string, number>;
  type: AccountType;
  trackingKind?: TrackingKind;
}

export const SETUP_HOUSING: SetupHousing[] = ['rent', 'mortgage', 'owned', 'family'];
export const SAVINGS_OPTIONS: SavingsOption[] = ['emergency', 'goal'];
export const LOAN_OPTIONS: LoanOption[] = ['car', 'student', 'personal', 'line_of_credit'];
export const ABROAD_OPTIONS: AbroadOption[] = ['property', 'mortgage', 'bank'];
export const OTHER_OPTIONS: OtherOption[] = ['car', 'giving'];
export const MAX_CREDIT_CARDS = 4;

// Device locale tag ("en-CA", "zh-Hans-CN") to the country whose account
// names and savings plans setup offers.
export function countryFromLocale(tag: string | undefined): SetupCountry | null {
  const region = tag?.split(/[-_]/).find((part, i) => i > 0 && /^[A-Z]{2}$/.test(part));
  if (region === 'US') return 'us';
  if (region === 'CA') return 'ca';
  if (region === 'GB') return 'uk';
  if (region === 'CN') return 'cn';
  return null;
}

// Which account types take a signed amount: an overdrawn bank account or a
// card in credit.
export function amountCanBeNegative(type: AccountType): boolean {
  return type === 'cash' || type === 'savings' || type === 'credit_card';
}

export function dailyOptions(country: SetupCountry): DailyOption[] {
  return country === 'cn' ? ['bank', 'bank2', 'wallet', 'alipay', 'wechat'] : ['bank', 'bank2', 'wallet'];
}

const INVEST_BY_COUNTRY: Record<SetupCountry, InvestOption[]> = {
  us: ['us_401k', 'us_ira', 'us_roth_ira', 'us_529', 'brokerage'],
  ca: ['ca_rrsp', 'ca_tfsa', 'ca_fhsa', 'ca_resp', 'brokerage'],
  uk: ['uk_pension', 'uk_isa', 'brokerage'],
  cn: ['cn_housing_fund', 'cn_pension', 'brokerage'],
  other: ['pension', 'brokerage'],
};

export function investOptions(country: SetupCountry): InvestOption[] {
  return INVEST_BY_COUNTRY[country];
}

export function defaultAnswers(country: SetupCountry): SetupAnswers {
  return {
    country,
    housing: 'rent',
    daily: ['bank'],
    creditCards: 1,
    savings: ['emergency'],
    invest: [],
    loans: [],
    abroad: [],
    other: [],
  };
}

const PLAN_KIND: Partial<Record<InvestOption, TrackingKind>> = {
  us_401k: 'us_401k',
  us_ira: 'us_ira',
  us_roth_ira: 'us_roth_ira',
  us_529: 'us_529',
  ca_rrsp: 'ca_rrsp',
  ca_tfsa: 'ca_tfsa',
  ca_fhsa: 'ca_fhsa',
  ca_resp: 'ca_resp',
};

export function suggestAccounts(a: SetupAnswers): SuggestedAccount[] {
  const out: SuggestedAccount[] = [];
  const add = (id: string, type: AccountType, extra?: Partial<SuggestedAccount>) =>
    out.push({ id, type, nameKey: `accountSetup.name.${id}` as TranslationKey, ...extra });

  const daily = dailyOptions(a.country);
  for (const d of daily.filter((o) => a.daily.includes(o))) {
    if (d === 'bank') add('bank', 'cash', { nameKey: `accountSetup.name.bank.${a.country}` as TranslationKey });
    else add(d, 'cash');
  }

  const cards = Math.max(0, Math.min(MAX_CREDIT_CARDS, Math.round(a.creditCards)));
  // Ids stay put when the count changes, so a name or amount typed for the
  // first card survives going back and adding a second.
  for (let n = 1; n <= cards; n++) {
    add(`creditCard${n}`, 'credit_card', {
      nameKey: cards === 1 ? 'accountSetup.name.creditCard' : 'accountSetup.name.creditCardN',
      nameVars: cards === 1 ? undefined : { n },
    });
  }

  for (const s of SAVINGS_OPTIONS.filter((o) => a.savings.includes(o))) add(s, 'savings');

  for (const i of investOptions(a.country).filter((o) => a.invest.includes(o))) {
    add(i, 'tracking', { trackingKind: PLAN_KIND[i] ?? 'general' });
  }

  if (a.housing === 'mortgage') add('mortgage', 'mortgage');
  if (a.housing === 'owned') add('home', 'asset');

  for (const l of LOAN_OPTIONS.filter((o) => a.loans.includes(o))) add(`${l}Loan`, 'loan');

  // A mortgage account already carries its home's value, so a mortgaged
  // property abroad is one account, not a debt plus an asset.
  if (a.abroad.includes('mortgage')) add('mortgageAbroad', 'mortgage');
  else if (a.abroad.includes('property')) add('propertyAbroad', 'asset');
  // Savings, not cash: off-budget, so a balance in another currency never
  // lands in Unassigned Cash.
  if (a.abroad.includes('bank')) add('bankAbroad', 'savings');

  if (a.other.includes('car')) add('car', 'asset');
  if (a.other.includes('giving')) add('giving', 'giving');

  return out;
}

// What the review row's amount means for each type, and where it is written.
// A ledger account gets a correction transaction (what the edit form's
// Current Balance posts); a loan a principal reading; anything valued by
// hand a value reading. A mortgage's home is a value reading on the same
// account.
export type AmountMeaning = 'balance' | 'owed' | 'worth';

export function amountMeaning(type: AccountType): AmountMeaning {
  if (type === 'credit_card' || type === 'loan' || type === 'mortgage') return 'owed';
  if (type === 'cash' || type === 'savings') return 'balance';
  return 'worth';
}

export interface OpeningEntries {
  correctionCents?: number;
  principalCents?: number;
  valueCents?: number;
}

export function openingEntries(type: AccountType, amountCents: number | null, homeWorthCents: number | null): OpeningEntries {
  const out: OpeningEntries = {};
  if (type === 'mortgage' && homeWorthCents) out.valueCents = homeWorthCents;
  if (!amountCents) return out;
  if (type === 'cash' || type === 'savings') out.correctionCents = amountCents;
  else if (type === 'credit_card') out.correctionCents = -amountCents;
  else if (type === 'loan' || type === 'mortgage') out.principalCents = amountCents;
  else out.valueCents = amountCents;
  return out;
}

// Names that would make a second account of the same name: one already on
// the board, or two rows in this batch. Lowercased, trimmed.
export function clashingNames(names: string[], existing: Set<string>): Set<string> {
  const seen = new Set<string>();
  const clash = new Set<string>();
  for (const raw of names) {
    const name = raw.trim().toLowerCase();
    if (name === '') continue;
    if (existing.has(name) || seen.has(name)) clash.add(name);
    seen.add(name);
  }
  return clash;
}
