import {
  amountCanBeNegative,
  amountMeaning,
  clashingNames,
  countryFromLocale,
  defaultAnswers,
  openingEntries,
  suggestAccounts,
} from './accountSetup';

describe('suggestAccounts', () => {
  it('starts a renter with a bank account, a card and an emergency fund', () => {
    expect(suggestAccounts(defaultAnswers('ca')).map((s) => [s.nameKey, s.type])).toEqual([
      ['accountSetup.name.bank.ca', 'cash'],
      ['accountSetup.name.creditCard', 'credit_card'],
      ['accountSetup.name.emergency', 'savings'],
    ]);
  });

  it('numbers credit cards only when there is more than one', () => {
    const cards = suggestAccounts({ ...defaultAnswers('us'), creditCards: 2 }).filter((s) => s.type === 'credit_card');
    expect(cards.map((c) => c.nameVars)).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('tags registered plans and drops plans from another country', () => {
    const list = suggestAccounts({ ...defaultAnswers('ca'), invest: ['ca_tfsa', 'us_401k', 'brokerage'] });
    const tracking = list.filter((s) => s.type === 'tracking');
    expect(tracking.map((s) => s.trackingKind)).toEqual(['ca_tfsa', 'general']);
  });

  it('offers mobile wallets only in China', () => {
    const daily = ['bank', 'alipay'] as const;
    expect(suggestAccounts({ ...defaultAnswers('us'), daily: [...daily] }).some((s) => s.id === 'alipay')).toBe(false);
    expect(suggestAccounts({ ...defaultAnswers('cn'), daily: [...daily] }).some((s) => s.id === 'alipay')).toBe(true);
  });

  it('makes a mortgaged home one mortgage account and an owned one an asset', () => {
    expect(suggestAccounts({ ...defaultAnswers('us'), housing: 'mortgage' }).find((s) => s.id === 'mortgage')?.type).toBe(
      'mortgage',
    );
    expect(suggestAccounts({ ...defaultAnswers('us'), housing: 'owned' }).find((s) => s.id === 'home')?.type).toBe('asset');
    expect(suggestAccounts({ ...defaultAnswers('us'), housing: 'rent' }).some((s) => s.type === 'mortgage')).toBe(false);
  });

  it('folds a mortgaged property abroad into its mortgage, and keeps foreign cash off budget', () => {
    const list = suggestAccounts({ ...defaultAnswers('cn'), abroad: ['property', 'mortgage', 'bank'] });
    expect(list.filter((s) => s.id.endsWith('Abroad')).map((s) => [s.id, s.type])).toEqual([
      ['mortgageAbroad', 'mortgage'],
      ['bankAbroad', 'savings'],
    ]);
  });

  it('keeps the first card id when the count changes', () => {
    const one = suggestAccounts(defaultAnswers('us')).find((s) => s.type === 'credit_card');
    const two = suggestAccounts({ ...defaultAnswers('us'), creditCards: 2 }).find((s) => s.type === 'credit_card');
    expect(one?.id).toBe(two?.id);
  });

  it('gives every suggestion a unique id', () => {
    const list = suggestAccounts({
      country: 'us',
      housing: 'mortgage',
      daily: ['bank', 'bank2', 'wallet'],
      creditCards: 4,
      savings: ['emergency', 'goal'],
      invest: ['us_401k', 'us_ira', 'us_roth_ira', 'us_529', 'brokerage'],
      loans: ['car', 'student', 'personal', 'line_of_credit'],
      abroad: ['mortgage', 'bank'],
      other: ['car', 'giving'],
    });
    expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
  });
});

describe('openingEntries', () => {
  it('posts a ledger balance as a correction, a card balance as debt', () => {
    expect(openingEntries('cash', 1_000, null)).toEqual({ correctionCents: 1_000 });
    expect(openingEntries('credit_card', 500, null)).toEqual({ correctionCents: -500 });
  });

  it('logs a loan as principal owed and a mortgage home as its value', () => {
    expect(openingEntries('mortgage', 30_000_000, 45_000_000)).toEqual({ principalCents: 30_000_000, valueCents: 45_000_000 });
    expect(openingEntries('mortgage', null, 45_000_000)).toEqual({ valueCents: 45_000_000 });
  });

  it('logs what an investment or asset is worth', () => {
    expect(openingEntries('tracking', 2_000, null)).toEqual({ valueCents: 2_000 });
    expect(openingEntries('asset', 0, null)).toEqual({});
  });
});

describe('openingEntries with a signed balance', () => {
  it('posts an overdraft as negative and a card in credit as positive', () => {
    expect(openingEntries('cash', -1_000, null)).toEqual({ correctionCents: -1_000 });
    expect(openingEntries('credit_card', -300, null)).toEqual({ correctionCents: 300 });
  });
});

describe('amountMeaning', () => {
  it('reads debts as owed, ledgers as balance, the rest as worth', () => {
    expect(['cash', 'savings', 'credit_card', 'loan', 'mortgage', 'tracking', 'asset', 'giving'].map((t) => amountMeaning(t as never))).toEqual([
      'balance',
      'balance',
      'owed',
      'owed',
      'owed',
      'worth',
      'worth',
      'worth',
    ]);
    expect(amountCanBeNegative('cash')).toBe(true);
    expect(amountCanBeNegative('mortgage')).toBe(false);
  });
});

describe('countryFromLocale', () => {
  it('reads the region, not the language', () => {
    expect(countryFromLocale('en-CA')).toBe('ca');
    expect(countryFromLocale('fr-CA')).toBe('ca');
    expect(countryFromLocale('en-GB')).toBe('uk');
    expect(countryFromLocale('zh-Hans-CN')).toBe('cn');
    expect(countryFromLocale('en_US')).toBe('us');
    expect(countryFromLocale('de-DE')).toBeNull();
    expect(countryFromLocale('en')).toBeNull();
    expect(countryFromLocale(undefined)).toBeNull();
  });
});

describe('clashingNames', () => {
  it('flags a name already on the board and a name used twice', () => {
    expect(clashingNames(['Amex', ' amex ', 'Checking', 'Visa', ''], new Set(['checking']))).toEqual(new Set(['amex', 'checking']));
  });
});
