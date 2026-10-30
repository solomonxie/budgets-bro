// Rough Canadian income tax for one employee: brackets and the basic
// personal amount, federal plus one province, CPP and EI. Ignores surtaxes,
// most credits and indexing past the table's year — close enough to say
// "about $X back", which is all Tax Insights claims.

type Bracket = [upTo: number, rate: number];

interface Schedule {
  brackets: Bracket[];
  basicPersonal: number;
}

const FEDERAL: Record<number, Schedule> = {
  2025: {
    brackets: [[57_375, 0.145], [114_750, 0.205], [177_882, 0.26], [253_414, 0.29], [Infinity, 0.33]],
    basicPersonal: 16_129,
  },
  2026: {
    brackets: [[58_523, 0.14], [117_045, 0.205], [181_440, 0.26], [258_482, 0.29], [Infinity, 0.33]],
    basicPersonal: 16_452,
  },
};

// 2025 tables, used for every year.
const PROVINCIAL: Record<string, Schedule> = {
  AB: { brackets: [[60_000, 0.08], [151_234, 0.1], [181_481, 0.12], [241_974, 0.13], [362_961, 0.14], [Infinity, 0.15]], basicPersonal: 22_323 },
  BC: { brackets: [[49_279, 0.0506], [98_560, 0.077], [113_158, 0.105], [137_407, 0.1229], [186_306, 0.147], [259_829, 0.168], [Infinity, 0.205]], basicPersonal: 12_932 },
  MB: { brackets: [[47_000, 0.108], [100_000, 0.1275], [Infinity, 0.174]], basicPersonal: 15_780 },
  NB: { brackets: [[51_306, 0.094], [102_614, 0.14], [190_060, 0.16], [Infinity, 0.195]], basicPersonal: 13_396 },
  NL: { brackets: [[44_192, 0.087], [88_382, 0.145], [157_792, 0.158], [220_910, 0.178], [282_214, 0.198], [564_429, 0.208], [1_128_858, 0.213], [Infinity, 0.218]], basicPersonal: 11_067 },
  NS: { brackets: [[30_507, 0.0879], [61_015, 0.1495], [95_883, 0.1667], [154_650, 0.175], [Infinity, 0.21]], basicPersonal: 11_744 },
  NT: { brackets: [[51_964, 0.059], [103_930, 0.086], [168_967, 0.122], [Infinity, 0.1405]], basicPersonal: 17_842 },
  NU: { brackets: [[54_707, 0.04], [109_413, 0.07], [177_881, 0.09], [Infinity, 0.115]], basicPersonal: 19_274 },
  ON: { brackets: [[52_886, 0.0505], [105_775, 0.0915], [150_000, 0.1116], [220_000, 0.1216], [Infinity, 0.1316]], basicPersonal: 12_747 },
  PE: { brackets: [[33_328, 0.095], [64_656, 0.1347], [105_000, 0.166], [140_000, 0.1762], [Infinity, 0.19]], basicPersonal: 14_250 },
  QC: { brackets: [[53_255, 0.14], [106_495, 0.19], [129_590, 0.24], [Infinity, 0.2575]], basicPersonal: 18_571 },
  SK: { brackets: [[53_463, 0.105], [152_750, 0.125], [Infinity, 0.145]], basicPersonal: 19_491 },
  YT: { brackets: [[57_375, 0.064], [114_750, 0.09], [177_882, 0.109], [500_000, 0.128], [Infinity, 0.15]], basicPersonal: 16_129 },
};

// Quebec residents get 16.5% off federal tax, paid for by the provincial one.
const QUEBEC_ABATEMENT = 0.165;

const CPP = { exemption: 3_500, ceiling: 71_300, rate: 0.0595, ceiling2: 81_200, rate2: 0.04 };
const EI = { ceiling: 65_700, rate: 0.0164 };

const RRSP_DOLLAR_LIMIT: Record<number, number> = { 2025: 32_490, 2026: 33_810 };
const RRSP_EARNED_INCOME_SHARE = 0.18;
export const FHSA_ANNUAL_LIMIT = 8_000;
export const US_401K_LIMIT: Record<number, number> = { 2025: 23_500, 2026: 24_500 };
export const US_IRA_LIMIT: Record<number, number> = { 2025: 7_000, 2026: 7_500 };

// Nearest year on file at or before `year`, else the earliest.
export function forYear<T>(table: Record<number, T>, year: number): T {
  const years = Object.keys(table).map(Number).sort((a, b) => a - b);
  const at = years.filter((y) => y <= year).pop() ?? years[0];
  return table[at];
}

function bracketTax({ brackets, basicPersonal }: Schedule, income: number): number {
  let tax = 0;
  let from = 0;
  for (const [upTo, rate] of brackets) {
    if (income <= from) break;
    tax += (Math.min(income, upTo) - from) * rate;
    from = upTo;
  }
  return Math.max(0, tax - basicPersonal * brackets[0][1]);
}

export function incomeTax(taxable: number, province: string, year: number): number {
  const federal = bracketTax(forYear(FEDERAL, year), taxable);
  const schedule = PROVINCIAL[province];
  const provincial = schedule ? bracketTax(schedule, taxable) : 0;
  return federal * (province === 'QC' ? 1 - QUEBEC_ABATEMENT : 1) + provincial;
}

function payrollDeductions(gross: number): number {
  const cpp =
    Math.max(0, Math.min(gross, CPP.ceiling) - CPP.exemption) * CPP.rate +
    Math.max(0, Math.min(gross, CPP.ceiling2) - CPP.ceiling) * CPP.rate2;
  return cpp + Math.min(gross, EI.ceiling) * EI.rate;
}

// Gross pay that leaves `net` after withholding, assuming the employer
// withheld about what the year's tax comes to.
export function grossFromNet(net: number, province: string, year: number): number {
  if (net <= 0) return 0;
  let lo = net;
  let hi = net * 3;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const left = mid - incomeTax(mid, province, year) - payrollDeductions(mid);
    if (left < net) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function rrspRoomEstimate(lastYearEarned: number, year: number): number {
  return Math.min(lastYearEarned * RRSP_EARNED_INCOME_SHARE, forYear(RRSP_DOLLAR_LIMIT, year));
}

// Federal plus provincial, at the lowest rate on the first $200 and the top
// rate past it.
export function donationCredit(donated: number, province: string, year: number): number {
  const fed = forYear(FEDERAL, year).brackets;
  const prov = PROVINCIAL[province]?.brackets ?? [[Infinity, 0]];
  const first = Math.min(donated, 200);
  const rest = Math.max(0, donated - 200);
  const federal = first * fed[0][1] + rest * 0.29;
  const provincial = first * prov[0][1] + rest * prov[prov.length - 1][1];
  return federal * (province === 'QC' ? 1 - QUEBEC_ABATEMENT : 1) + provincial;
}

export interface RefundInput {
  year: number;
  province: string;
  grossPay: number;
  // Taxed but never withheld from.
  untaxedIncome: number;
  deductions: number;
  donations: number;
}

export interface RefundEstimate {
  taxableIncome: number;
  // Positive: money back. Negative: owing.
  refund: number;
  fromDeductions: number;
  fromDonations: number;
  fromUntaxedIncome: number;
}

// Pay is taken as already correctly withheld, so the refund is only what
// the return changes on top of it.
export function estimateRefund(input: RefundInput): RefundEstimate {
  const { year, province, grossPay } = input;
  const base = incomeTax(grossPay, province, year);
  const withIncome = incomeTax(grossPay + input.untaxedIncome, province, year);
  const taxableIncome = Math.max(0, grossPay + input.untaxedIncome - input.deductions);
  const final = incomeTax(taxableIncome, province, year);
  const fromUntaxedIncome = base - withIncome;
  const fromDeductions = withIncome - final;
  const fromDonations = Math.min(donationCredit(input.donations, province, year), final);
  return {
    taxableIncome,
    refund: fromUntaxedIncome + fromDeductions + fromDonations,
    fromDeductions,
    fromDonations,
    fromUntaxedIncome,
  };
}
