import type { SQLiteDatabase } from '../../db/driver';
import * as boardsRepo from '../repositories/boardsRepo';
import * as accountsRepo from '../repositories/accountsRepo';
import * as accountRateHistoryRepo from '../repositories/accountRateHistoryRepo';
import * as accountValueHistoryRepo from '../repositories/accountValueHistoryRepo';
import * as categoriesRepo from '../repositories/categoriesRepo';
import * as transactionsRepo from '../repositories/transactionsRepo';
import * as budgetsRepo from '../repositories/budgetsRepo';
import * as scheduledTransactionsRepo from '../repositories/scheduledTransactionsRepo';
import * as paymentReviewRepo from '../repositories/paymentReviewRepo';
import * as customGoalsRepo from '../repositories/customGoalsRepo';
import * as housesRepo from '../repositories/housesRepo';
import * as communityPricesRepo from '../repositories/communityPricesRepo';
import * as settingsRepo from '../repositories/settingsRepo';
import { currentDateISO, currentMonth, lastNMonths, nextMonth } from '../../domain/month';
import { addMonths } from '../../finance-tools/amortization';
import { formatPurchaseItems } from '../../domain/purchaseItems';
import { DETECTION_WINDOW_MONTHS, addDays, buildReviewItems, detectRecurring, reviewOnAfterDecision } from '../../domain/paymentReview';
import type { Decision } from '../../domain/paymentReview';
import type { ScheduleFrequency } from '../../domain/recurrence';
import { houseListings, communityBenchmarks } from './demoHouseHunt';

export const DEMO_BOARD_NAME = 'Demo';

const cents = (dollars: number) => Math.round(dollars * 100);
const day = (month: string, d: number) => `${month}-${String(d).padStart(2, '0')}`;
const calendarMonth = (month: string) => Number(month.slice(5, 7));

// Fixed seed: every install draws the same numbers, so screenshots match.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface AmortStep {
  interestCents: number;
  principalCents: number;
  balanceCents: number;
}

// Same payment every month off the original principal/term.
function amortize(principalCents: number, annualRateBps: number, termMonths: number, numMonths: number): AmortStep[] {
  const r = annualRateBps / 10000 / 12;
  const payment = r === 0 ? principalCents / termMonths : (principalCents * r) / (1 - (1 + r) ** -termMonths);
  const steps: AmortStep[] = [];
  let balance = principalCents;
  for (let i = 0; i < numMonths; i++) {
    const interest = balance * r;
    const principal = Math.min(payment - interest, balance);
    balance -= principal;
    steps.push({ interestCents: Math.round(interest), principalCents: Math.round(principal), balanceCents: Math.round(balance) });
  }
  return steps;
}

// Repeated "Create Demo Board" taps get "Demo 2", "Demo 3", …
async function uniqueBoardName(db: SQLiteDatabase, base: string): Promise<string> {
  const existing = new Set((await boardsRepo.listBoards(db)).map((b) => b.name));
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

// [name, base price] — prices drift up ~0.4%/month (see itemPrice).
const GROCERY_ITEMS: [string, number][] = [
  ['Milk 4L', 5.79],
  ['Eggs (dozen)', 4.29],
  ['Sourdough Bread', 5.49],
  ['Bananas', 1.89],
  ['Chicken Breast', 14.99],
  ['Olive Oil', 11.99],
  ['Butter', 6.49],
  ['Coffee Beans', 16.99],
  ['Avocados', 4.99],
  ['Greek Yogurt', 6.99],
];
const COSTCO_ITEMS: [string, number][] = [
  ['Kirkland Paper Towels', 24.99],
  ['Kirkland Olive Oil 3L', 32.99],
  ['Rotisserie Chicken', 7.99],
  ['Atlantic Salmon', 29.99],
];
const COFFEE_SHOPS: [string, string, number][] = [
  ['Starbucks', 'Oat Latte', 5.95],
  ['Tim Hortons', 'Medium Double-Double', 2.29],
  ['Matchstick Coffee', 'Cortado', 4.75],
];

// Invented, middle-class Vancouver-area household — two earners, two kids,
// one mortgaged home, a paid-off cabin, cards, car loan/lease, student loan,
// line of credit, RRSP/TFSA/RESP. ~24 months, deterministic, dated relative
// to today. Every number is fictional.
export async function seedDemoBoard(db: SQLiteDatabase): Promise<number> {
  let boardId = 0;
  await db.withTransactionAsync(async () => {
    boardId = await seed(db);
  });
  return boardId;
}

async function seed(db: SQLiteDatabase): Promise<number> {
  const random = seededRandom(20240917);
  const rand = (min: number, max: number) => min + random() * (max - min);
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  const chance = (p: number) => random() < p;

  const today = currentDateISO();
  const thisMonth = currentMonth();
  const boardId = await boardsRepo.createBoard(db, await uniqueBoardName(db, DEMO_BOARD_NAME));
  const months = lastNMonths(thisMonth, 24); // oldest → newest
  const waterDue = day([...months].reverse().find((m) => calendarMonth(m) % 3 === 1)!, 1);

  const logValue = async (accountId: number, valueCents: number, date: string, note: string | null = null) => {
    if (date <= today) await accountValueHistoryRepo.addValueChange(db, accountId, valueCents, date, note);
  };

  // --- categories (before accounts: loans name their payment category) ---
  const cat = async (groupId: number, name: string) => categoriesRepo.createCategory(db, boardId, { groupId, name, icon: null });
  const housingGroup = await categoriesRepo.createCategoryGroup(db, boardId, 'Mortgages & Housing');
  const catHouse = await cat(housingGroup, '🏡 Mortgage Payment');
  const catPropertyTax = await cat(housingGroup, '🧾 Property Tax');
  const catHomeInsurance = await cat(housingGroup, '🛡️ Home Insurance');
  const catUtilities = await cat(housingGroup, '💡 Utilities');
  const catPhoneInternet = await cat(housingGroup, '📶 Phone & Internet');
  const catHomeMaintenance = await cat(housingGroup, '🛠️ Home Maintenance');

  const everydayGroup = await categoriesRepo.createCategoryGroup(db, boardId, 'Everyday Expenses');
  const catGroceries = await cat(everydayGroup, '🛒 Groceries');
  const catDining = await cat(everydayGroup, '🍽️ Dining Out');
  const catCoffee = await cat(everydayGroup, '☕ Coffee & Quick Stops');
  const catTransport = await cat(everydayGroup, '⛽ Transportation & Gas');
  const catCarCare = await cat(everydayGroup, '🔧 Car Insurance & Care');
  const catShopping = await cat(everydayGroup, '🛍️ Shopping');
  const catKids = await cat(everydayGroup, '🧒 Kids & Activities');
  const catSubscriptions = await cat(everydayGroup, '📱 Subscriptions');
  const catInterest = await cat(everydayGroup, '💳 Interest & Fees');

  const qolGroup = await categoriesRepo.createCategoryGroup(db, boardId, 'Quality of Life');
  const catTravel = await cat(qolGroup, '✈️ Travel & Vacation');
  const catGifts = await cat(qolGroup, '🎄 Holidays & Gifts');
  const catHobbies = await cat(qolGroup, '🎉 Hobbies & Recreation');
  const catGym = await cat(qolGroup, '💪 Gym & Wellness');

  const givingGroup = await categoriesRepo.createCategoryGroup(db, boardId, 'Giving');
  const catCharity = await cat(givingGroup, '🎁 Charitable Giving');

  const savingsGroup = await categoriesRepo.createCategoryGroup(db, boardId, 'Savings Goals');
  const catRrsp = await cat(savingsGroup, '🏦 RRSP Contributions');
  const catTfsa = await cat(savingsGroup, '💰 TFSA Contributions');
  const catResp = await cat(savingsGroup, '🎓 RESP for the Kids');
  const catInvest = await cat(savingsGroup, '📈 Investment Contributions');

  const loansGroup = await categoriesRepo.createCategoryGroup(db, boardId, 'Loans & Financing');
  const catCarLoan = await cat(loansGroup, '🚙 Highlander Loan Payment');
  const catCarLease = await cat(loansGroup, '🚗 CR-V Lease Payment');
  const catStudentLoan = await cat(loansGroup, '📚 Student Loan Payment');
  const catLocDraw = await cat(loansGroup, '🛠️ Line of Credit Draws');

  // --- accounts ---
  const checkingId = await accountsRepo.createAccount(db, boardId, { name: 'Everyday Chequing', type: 'cash', openingBalanceCents: cents(4000) });
  const savingsId = await accountsRepo.createAccount(db, boardId, {
    name: 'High-Interest Savings',
    type: 'savings',
    openingBalanceCents: cents(12000),
    note: 'Emergency fund — 4 months of spending.',
  });
  const ccId = await accountsRepo.createAccount(db, boardId, { name: 'Rewards Visa', type: 'credit_card', openingBalanceCents: 0 });
  const cc2Id = await accountsRepo.createAccount(db, boardId, { name: 'Cashback Mastercard', type: 'credit_card', openingBalanceCents: 0 });

  // Primary residence — a year into its term when the window starts.
  const housePrincipal = cents(640000);
  const houseSchedule = amortize(housePrincipal, 575, 300, 36);
  const houseOpeningCents = -houseSchedule[11].balanceCents;
  const housePayments = houseSchedule.slice(12);
  const houseId = await accountsRepo.createAccount(db, boardId, {
    name: 'Maple Street House Mortgage',
    type: 'mortgage',
    openingBalanceCents: houseOpeningCents,
    interestRateBps: 575,
    termMonths: 300,
    originalPrincipalCents: housePrincipal,
    originationDate: addMonths(day(months[0], 1), -12),
    originalHousePriceCents: cents(800000),
    loanPaymentCategoryId: catHouse,
    note: '5-year fixed with Coastal Credit Union, renews in 2028.',
  });
  await accountRateHistoryRepo.addRateChange(db, houseId, 575, addMonths(day(months[0], 1), -12), '5-year fixed');
  await accountValueHistoryRepo.addValueChange(db, houseId, -houseOpeningCents, day(months[12], 1), 'Annual statement', 'principal');
  const houseValues = [800000, 812000, 826000, 819000, 834000, 851000];
  for (let k = 0; k < houseValues.length; k++) {
    const note = k === 0 ? 'Purchase price' : k % 2 === 0 ? 'BC Assessment' : 'Realtor estimate';
    await logValue(houseId, cents(houseValues[k]), day(months[Math.min(23, k * 4 + (k ? 3 : 0))], 1), note);
  }

  const cabinId = await accountsRepo.createAccount(db, boardId, { name: 'Whistler Cabin', type: 'asset', openingBalanceCents: cents(350000) });
  for (const [m, v] of [[0, 350000], [6, 356000], [11, 365000], [17, 371000], [23, 380000]] as const) {
    await logValue(cabinId, cents(v), day(months[m], 1));
  }

  const belongingsId = await accountsRepo.createAccount(db, boardId, { name: 'Personal Belongings', type: 'asset', openingBalanceCents: cents(9600) });
  for (const [m, v] of [[0, 9600], [7, 8700], [8, 10200], [15, 9300], [23, 8100]] as const) {
    await logValue(belongingsId, cents(v), day(months[m], m === 8 || m === 23 ? 15 : 1));
  }

  const carLoanSchedule = amortize(cents(28000), 649, 60, 14 + months.length);
  const carLoanId = await accountsRepo.createAccount(db, boardId, {
    name: 'Highlander Auto Loan',
    type: 'loan',
    openingBalanceCents: -carLoanSchedule[13].balanceCents,
    interestRateBps: 649,
    termMonths: 60,
    originalPrincipalCents: cents(28000),
    originationDate: addMonths(day(months[0], 1), -14),
    loanPaymentCategoryId: catCarLoan,
  });
  await accountRateHistoryRepo.addRateChange(db, carLoanId, 649, addMonths(day(months[0], 1), -14));
  const carLoanPayments = carLoanSchedule.slice(14);

  const carLeasePrincipalCents = cents(420 * 36);
  const carLeaseId = await accountsRepo.createAccount(db, boardId, {
    name: 'CR-V Lease',
    type: 'loan',
    openingBalanceCents: -carLeasePrincipalCents,
    interestRateBps: 0,
    termMonths: 36,
    originalPrincipalCents: carLeasePrincipalCents,
    originationDate: day(months[0], 1),
    loanPaymentCategoryId: catCarLease,
  });
  await accountRateHistoryRepo.addRateChange(db, carLeaseId, 0, day(months[0], 1));

  const studentLoanSchedule = amortize(cents(22000), 549, 120, 30 + months.length);
  const studentLoanId = await accountsRepo.createAccount(db, boardId, {
    name: 'Student Loan',
    type: 'loan',
    openingBalanceCents: -studentLoanSchedule[29].balanceCents,
    interestRateBps: 549,
    termMonths: 120,
    originalPrincipalCents: cents(22000),
    originationDate: addMonths(day(months[0], 1), -30),
    loanPaymentCategoryId: catStudentLoan,
  });
  await accountRateHistoryRepo.addRateChange(db, studentLoanId, 549, addMonths(day(months[0], 1), -30));
  const studentLoanPayments = studentLoanSchedule.slice(30);

  const locId = await accountsRepo.createAccount(db, boardId, { name: 'Personal Line of Credit', type: 'credit_card', openingBalanceCents: -cents(3500) });

  const rrspId = await accountsRepo.createAccount(db, boardId, { name: 'RRSP', type: 'tracking', openingBalanceCents: cents(45000), trackingKind: 'ca_rrsp' });
  const tfsaId = await accountsRepo.createAccount(db, boardId, { name: 'TFSA', type: 'tracking', openingBalanceCents: cents(22000), trackingKind: 'ca_tfsa' });
  const respId = await accountsRepo.createAccount(db, boardId, { name: 'Family RESP', type: 'tracking', openingBalanceCents: cents(14000), trackingKind: 'ca_resp' });
  const investId = await accountsRepo.createAccount(db, boardId, {
    name: 'Non-Registered Investments',
    type: 'tracking',
    openingBalanceCents: cents(12000),
    trackingKind: 'general',
  });

  // --- posting helpers: nothing dated after today is written ---
  let checkingBalance = cents(4000);
  let savingsBalance = cents(12000);
  const CHECKING_FLOOR = cents(300);
  const cardOwed = new Map<number, number>([[ccId, 0], [cc2Id, 0], [locId, cents(3500)]]);

  const post = async (
    accountId: number,
    categoryId: number | null,
    payeeName: string,
    amountCents: number,
    date: string,
    memo: string | null = null,
    purchaseItems: string | null = null,
  ): Promise<boolean> => {
    if (date > today) return false;
    if (accountId === checkingId) {
      // Overdraft protection from Savings rather than going negative.
      const shortfall = amountCents < 0 ? CHECKING_FLOOR - (checkingBalance + amountCents) : 0;
      const cover = Math.min(Math.max(0, shortfall), Math.max(0, savingsBalance));
      if (cover > 0) {
        savingsBalance -= cover;
        checkingBalance += cover;
        await transactionsRepo.createTransfer(db, boardId, { fromAccountId: savingsId, toAccountId: checkingId, amountCents: cover, date, memo: 'Overdraft protection' });
      }
      checkingBalance += amountCents;
    } else if (cardOwed.has(accountId)) {
      cardOwed.set(accountId, cardOwed.get(accountId)! - amountCents);
    }
    await transactionsRepo.createTransaction(db, boardId, { accountId, categoryId, payeeName, memo, amountCents, date, purchaseItems });
    return true;
  };
  const payCard = async (cardId: number, payee: string, fraction: number, date: string) => {
    const owed = cardOwed.get(cardId)!;
    const amount = Math.round(owed * fraction);
    if (amount <= 0 || date > today) return;
    cardOwed.set(cardId, owed - amount);
    await post(checkingId, null, payee, -amount, date);
  };
  const transferToSavings = async (amount: number, date: string) => {
    if (amount <= 0 || date > today) return;
    checkingBalance -= amount;
    savingsBalance += amount;
    await transactionsRepo.createTransfer(db, boardId, { fromAccountId: checkingId, toAccountId: savingsId, amountCents: amount, date, memo: 'Monthly sweep' });
  };

  const itemPrice = (base: number, i: number) => (base * (1 + 0.004 * i) * rand(0.97, 1.03)).toFixed(2);
  const basket = (catalogue: [string, number][], i: number, n: number) => {
    const chosen = [...catalogue].sort(() => random() - 0.5).slice(0, n);
    const items = chosen.map(([key, base]) => ({ key, value: itemPrice(base, i) }));
    return { items, totalCents: items.reduce((s, it) => s + cents(Number(it.value)), 0) };
  };

  // Fixed monthly bills (the scheduled ones below continue these).
  const NETFLIX_OLD = 20.99;
  const NETFLIX_NEW = 23.99;
  const ICLOUD_OLD = 3.99;
  const ICLOUD_NEW = 12.99;

  const salaryBase = 3350;
  const partnerBase = 2050;
  const rrspContribution = cents(400);
  const tfsaContribution = cents(300);
  const respContribution = cents(208);
  const investContribution = cents(150);
  let rrspValue = cents(45000);
  let tfsaValue = cents(22000);
  let respValue = cents(14000);
  let investValue = cents(12000);

  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    const cal = calendarMonth(month);
    const inflation = 1 + i * 0.002;
    const winter = cal === 11 || cal === 12 || cal === 1 || cal === 2;
    const yearsIn = months.slice(1, i + 1).filter((m) => calendarMonth(m) === 1).length;

    // --- income: several payers, raises over time ---
    const salary = cents(salaryBase * 1.035 ** yearsIn);
    await post(checkingId, null, 'Meridian Robotics Inc', salary, day(month, 1));
    await post(checkingId, null, 'Meridian Robotics Inc', salary, day(month, 15));
    const partner = cents(partnerBase * (i >= 14 ? 1.08 : 1)); // promotion
    await post(checkingId, null, 'Alderbrook Consulting Group', partner, day(month, 1));
    await post(checkingId, null, 'Alderbrook Consulting Group', partner, day(month, 15));
    if (chance(0.6)) await post(checkingId, null, 'Northwind Studio', cents(rand(400, 1200)), day(month, 8), 'Logo + brand refresh');
    if (chance(0.35)) await post(checkingId, null, 'Brightline Media', cents(rand(600, 1600)), day(month, 22), 'Freelance illustration');
    await post(checkingId, null, 'Canada Child Benefit', cents(248.5), day(month, 20));
    if (cal === 5) await post(checkingId, null, 'Canada Revenue Agency', cents(rand(800, 1400)), day(month, 9), 'Tax refund');
    if (cal === 12) await post(checkingId, null, 'Meridian Robotics Inc', cents(rand(2500, 3500)), day(month, 19), 'Year-end bonus');

    // --- loans ---
    const house = housePayments[i];
    await post(checkingId, catHouse, 'Maple Street House Mortgage', -(house.principalCents + house.interestCents), day(month, 1));
    const carLoan = carLoanPayments[i];
    await post(checkingId, catCarLoan, 'Highlander Auto Loan', -(carLoan.principalCents + carLoan.interestCents), day(month, 4));
    await post(checkingId, catCarLease, 'CR-V Lease', -cents(420), day(month, 4));
    const studentLoan = studentLoanPayments[i];
    await post(checkingId, catStudentLoan, 'Student Loan', -(studentLoan.principalCents + studentLoan.interestCents), day(month, 20));

    if (i % 7 === 3) {
      await post(locId, catLocDraw, 'Rona', -cents(rand(500, 1400)), day(month, 10), pick(['Deck boards', 'Fence repair', 'Bathroom fan + tile']));
    }
    await post(locId, catInterest, 'Line of Credit Interest', -Math.round(cardOwed.get(locId)! * 0.0075), day(month, 25));
    await payCard(locId, 'Personal Line of Credit', rand(0.1, 0.2), day(month, 26));

    // --- housing ---
    if (cal === 7) await post(checkingId, catPropertyTax, 'City of Burnaby', -cents(4300 * inflation), day(month, 2), 'Property tax, net of home owner grant');
    await post(checkingId, catHomeInsurance, 'Coastal Insurance Co.', -cents(148.2), day(month, 3));
    await post(checkingId, catUtilities, 'BC Hydro', -cents(rand(85, 110) * (winter ? 1.7 : 1)), day(month, 9));
    await post(checkingId, catUtilities, 'FortisBC Gas', -cents(winter ? rand(150, 195) : rand(40, 60)), day(month, 11));
    if (cal % 3 === 1 && day(month, 1) < waterDue) await post(checkingId, catUtilities, 'City Water & Sewer', -cents(212.4), day(month, 1));
    await post(checkingId, catPhoneInternet, 'Telus Mobility', -cents(95), day(month, 8));
    await post(checkingId, catPhoneInternet, 'Shaw Internet', -cents(85), day(month, 10));
    if (chance(0.3)) await post(checkingId, catHomeMaintenance, 'Home Depot', -cents(rand(60, 320)), day(month, 12), pick(['Paint', 'Air filters', 'Garden soil', null]));
    if (cal === 10) await post(checkingId, catHomeMaintenance, 'Reliance Home Comfort', -cents(189), day(month, 14), 'Furnace service');

    // --- groceries with itemized baskets ---
    for (let g = 0; g < 4; g++) {
      const store = g === 3 ? 'Whole Foods' : 'Save-On-Foods';
      const b = basket(GROCERY_ITEMS, i, 4 + Math.floor(random() * 3));
      await post(checkingId, catGroceries, store, -(b.totalCents + cents(rand(70, 140))), day(month, 3 + g * 7), null, formatPurchaseItems(b.items));
    }
    const costco = basket(COSTCO_ITEMS, i, 3);
    await post(ccId, catGroceries, 'Costco', -(costco.totalCents + cents(rand(140, 260))), day(month, 13), null, formatPurchaseItems(costco.items));

    // --- dining / coffee / transport ---
    for (let d = 0; d < 4; d++) {
      await post(cc2Id, catDining, pick(['The Keg Steakhouse', 'Uber Eats', 'Nando’s', 'Sushi Town', 'Local Bistro']), -cents(rand(35, 110)), day(month, 5 + d * 6));
    }
    for (let c = 0; c < 7; c++) {
      const [shop, item, base] = pick(COFFEE_SHOPS);
      const price = itemPrice(base, i);
      await post(cc2Id, catCoffee, shop, -cents(Number(price) * (chance(0.3) ? 2 : 1)), day(month, 2 + c * 4), null, formatPurchaseItems([{ key: item, value: price }]));
    }
    for (let g = 0; g < 3; g++) {
      const perLitre = (1.68 + 0.18 * Math.sin(((cal - 2) / 12) * 2 * Math.PI) + rand(-0.04, 0.04)).toFixed(3);
      const litres = rand(40, 55);
      await post(cc2Id, catTransport, pick(['Chevron', 'Shell', 'Petro-Canada']), -cents(Number(perLitre) * litres), day(month, 6 + g * 8), null, formatPurchaseItems([{ key: 'Regular Gas per L', value: perLitre }]));
    }
    await post(cc2Id, catTransport, 'TransLink Compass', -cents(50), day(month, 2));
    if (i % 4 === 1) await post(checkingId, catCarCare, 'Jiffy Lube', -cents(rand(85, 110)), day(month, 16), 'Oil change');
    if (cal === 11) await post(checkingId, catCarCare, 'Kal Tire', -cents(rand(120, 160)), day(month, 3), 'Winter tire swap');
    if (cal === 3) await post(checkingId, catCarCare, 'ICBC', -cents(1980 * inflation), day(month, 15), 'Annual Autoplan renewal');

    // --- shopping, seasonal ---
    const shoppingTrips = cal === 12 ? 2 : cal === 11 ? 3 : 2;
    for (let s = 0; s < shoppingTrips; s++) {
      await post(ccId, catShopping, pick(['Amazon', 'Canadian Tire', 'Best Buy', 'Winners', 'IKEA']), -cents(rand(40, 160)), day(month, 9 + s * 7));
    }
    if (cal === 11) await post(ccId, catShopping, 'Best Buy', -cents(rand(350, 600)), day(month, 28), 'Black Friday');
    if (cal === 12) {
      await post(ccId, catGifts, 'Amazon', -cents(rand(300, 450)), day(month, 6), 'Christmas gifts');
      await post(ccId, catGifts, 'Indigo', -cents(rand(80, 150)), day(month, 12), 'Books for the kids');
      await post(ccId, catGifts, 'Toys"R"Us', -cents(rand(150, 260)), day(month, 16));
      await post(ccId, catGifts, 'Lululemon', -cents(rand(180, 280)), day(month, 18));
    }
    if (cal === 8) await post(ccId, catKids, 'Staples', -cents(rand(140, 220)), day(month, 24), 'Back to school');

    // --- kids, hobbies, gym, giving ---
    await post(checkingId, catKids, 'Burnaby Parks & Rec', -cents(cal >= 7 && cal <= 8 ? rand(300, 420) : rand(60, 120)), day(month, 7), cal >= 7 && cal <= 8 ? 'Summer day camp' : 'Swim lessons');
    if (chance(0.5)) await post(cc2Id, catHobbies, pick(['Cineplex', 'Steve’s Music', 'MEC']), -cents(rand(30, 90)), day(month, 21));
    await post(checkingId, catGym, 'GoodLife Fitness', -cents(69.99), day(month, 4));
    await post(checkingId, catCharity, 'Greater Vancouver Food Bank', -cents(80), day(month, 20));
    if (cal === 12) await post(checkingId, catCharity, 'BC Children’s Hospital Foundation', -cents(250), day(month, 15));

    // --- subscriptions: fixed amounts, monthly and annual ---
    await post(ccId, catSubscriptions, 'Netflix', -cents(i < 10 ? NETFLIX_OLD : NETFLIX_NEW), day(month, 5));
    await post(ccId, catSubscriptions, 'Spotify', -cents(21.99), day(month, 7));
    await post(ccId, catSubscriptions, 'Disney+', -cents(14.99), day(month, 12));
    await post(ccId, catSubscriptions, 'YouTube Premium', -cents(13.99), day(month, 18));
    await post(ccId, catSubscriptions, 'iCloud+', -cents(i < 12 ? ICLOUD_OLD : ICLOUD_NEW), day(month, 14));
    if (cal === 3) await post(ccId, catSubscriptions, 'Microsoft 365', -cents(139), day(month, 11));
    if (cal === 8) await post(ccId, catSubscriptions, 'Namecheap', -cents(18.98), day(month, 3), 'Domain renewal');
    if (cal === 6) await post(ccId, catSubscriptions, 'Amazon Prime', -cents(99), day(month, 17));
    if (cal === 4) await post(checkingId, catShopping, 'Costco Membership', -cents(130), day(month, 22));
    if (cal === 9) await post(checkingId, catCarCare, 'BCAA', -cents(124), day(month, 2), 'Roadside membership');

    // --- travel, seasonal ---
    if (cal === 7) {
      await post(ccId, catTravel, 'Air Canada', -cents(rand(1800, 2400)), day(month, 2), 'Flights to Halifax');
      await post(ccId, catTravel, 'Airbnb', -cents(rand(1300, 1700)), day(month, 3), 'Summer trip — 8 nights');
      await post(ccId, catTravel, 'Enterprise Rent-A-Car', -cents(rand(420, 560)), day(month, 18));
    }
    if (cal === 3) await post(ccId, catTravel, 'WestJet', -cents(rand(700, 950)), day(month, 9), 'Spring break in Kelowna');
    if (cal === 2) await post(cc2Id, catTravel, 'Whistler Blackcomb', -cents(rand(380, 520)), day(month, 14), 'Family ski day');

    // --- card payments ---
    await payCard(ccId, 'Rewards Visa', rand(0.85, 1), day(month, 26));
    await payCard(cc2Id, 'Cashback Mastercard', 1, day(month, 26));

    // --- contributions (transfers via linked payees) + statement values ---
    await post(checkingId, catRrsp, 'RRSP', -rrspContribution, day(month, 27));
    await post(checkingId, catTfsa, 'TFSA', -tfsaContribution, day(month, 27));
    await post(checkingId, catResp, 'Family RESP', -respContribution, day(month, 27));
    await post(checkingId, catInvest, 'Non-Registered Investments', -investContribution, day(month, 27));
    rrspValue = Math.round(rrspValue * (1 + rand(-0.02, 0.03))) + rrspContribution;
    tfsaValue = Math.round(tfsaValue * (1 + rand(-0.02, 0.03))) + tfsaContribution;
    respValue = Math.round(respValue * (1 + rand(-0.01, 0.02))) + Math.round(respContribution * 1.2); // + CESG
    investValue = Math.round(investValue * (1 + rand(-0.025, 0.035))) + investContribution;
    if (day(month, 28) <= today) {
      await accountValueHistoryRepo.addValueChange(db, rrspId, rrspValue, day(month, 28), 'Statement');
      await accountValueHistoryRepo.addValueChange(db, tfsaId, tfsaValue, day(month, 28), 'Statement');
      await accountValueHistoryRepo.addValueChange(db, respId, respValue, day(month, 28), 'Statement');
      await accountValueHistoryRepo.addValueChange(db, investId, investValue, day(month, 28), 'Statement');
    }

    // --- savings sweep + interest ---
    await transferToSavings(Math.floor(Math.max(0, checkingBalance - cents(3000)) / cents(50)) * cents(50), day(month, 28));
    const savingsInterest = Math.round(savingsBalance * 0.0028);
    if (await post(savingsId, null, 'Savings Interest', savingsInterest, day(month, 28))) savingsBalance += savingsInterest;

    // --- budget: what the month needs, with a little buffer ---
    const assignments: [number, number][] = [
      [catHouse, house.principalCents + house.interestCents],
      [catCarLoan, carLoan.principalCents + carLoan.interestCents],
      [catCarLease, cents(420)],
      [catStudentLoan, studentLoan.principalCents + studentLoan.interestCents],
      [catLocDraw, cents(100)],
      [catPropertyTax, cents(360)],
      [catHomeInsurance, cents(149)],
      [catUtilities, cents(winter ? 380 : 240)],
      [catPhoneInternet, cents(180)],
      [catHomeMaintenance, cents(150)],
      [catGroceries, cents(1150)],
      [catDining, cents(320)],
      [catCoffee, cents(60)],
      [catTransport, cents(300)],
      [catCarCare, cents(200)],
      [catShopping, cents(300)],
      [catKids, cents(cal >= 7 && cal <= 8 ? 400 : 120)],
      [catSubscriptions, cents(100)],
      [catInterest, cents(30)],
      [catTravel, cents(450)],
      [catGifts, cents(cal >= 10 ? 300 : 50)],
      [catHobbies, cents(60)],
      [catGym, cents(70)],
      [catCharity, cents(cal === 12 ? 330 : 80)],
      [catRrsp, rrspContribution],
      [catTfsa, tfsaContribution],
      [catResp, respContribution],
      [catInvest, investContribution],
    ];
    for (const [categoryId, base] of assignments) {
      await budgetsRepo.setAssignedCents(db, boardId, categoryId, month, Math.round(base * inflation));
    }
  }

  // --- belongings: itemized big-ticket purchases ---
  const belongingsPurchases: [string, string, number, number, number][] = [
    ['iPad Air', 'Apple Store', 650, 2, 14],
    ['Sony WH-1000XM5 Headphones', 'Best Buy', 380, 5, 20],
    ['Apple Watch Ultra 2', 'Apple Store', 850, 8, 9],
    ['Dyson V15 Vacuum', 'Best Buy', 650, 8, 11],
    ['PlayStation 5', 'Best Buy', 500, 12, 5],
    ['Sectional Sofa', 'IKEA', 700, 18, 22],
    ['Canon EOS R50 Camera', 'Canon Store', 680, 21, 9],
  ];
  for (const [item, merchant, price, m, d] of belongingsPurchases) {
    await post(belongingsId, null, item, cents(price), day(months[m], d), merchant);
  }

  // --- a few rows that need a look (Flagged) ---
  const recent = months[months.length - 2];
  await post(ccId, null, 'Amazon', -cents(64.38), day(recent, 19), 'Not sure what this was');
  await post(checkingId, catDining, 'Uber Eats', -cents(42.17), day(recent, 23));
  await post(checkingId, catDining, 'Uber Eats', -cents(42.17), day(recent, 23));
  await post(checkingId, catHobbies, '', -cents(60), day(recent, 24), 'ATM withdrawal');

  // --- schedules: bills and subscriptions continuing the history above ---
  const nextMonthly = (d: number) => (day(thisMonth, d) > today ? day(thisMonth, d) : day(nextMonth(thisMonth), d));
  const nextYearly = (cal: number, d: number) => {
    const thisYear = `${thisMonth.slice(0, 4)}-${String(cal).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return thisYear > today ? thisYear : addMonths(thisYear, 12);
  };
  const schedule = async (
    accountId: number,
    categoryId: number | null,
    payeeName: string,
    amountCents: number,
    frequency: ScheduleFrequency,
    nextDate: string,
    intervalN = 1,
    memo: string | null = null,
  ) =>
    scheduledTransactionsRepo.createScheduledTransaction(db, boardId, {
      accountId, categoryId, payeeName, memo, amountCents, frequency, intervalN, daysOfWeekMask: null, nextDate, endDate: null,
    });
  const lastSalary = cents(salaryBase * 1.035 ** months.slice(1).filter((m) => calendarMonth(m) === 1).length);
  await schedule(checkingId, null, 'Meridian Robotics Inc', lastSalary, 'monthly', nextMonthly(1));
  await schedule(checkingId, null, 'Meridian Robotics Inc', lastSalary, 'monthly', nextMonthly(15));
  await schedule(checkingId, catHouse, 'Maple Street House Mortgage', -(housePayments[23].principalCents + housePayments[23].interestCents), 'monthly', nextMonthly(1));
  await schedule(checkingId, catCarLoan, 'Highlander Auto Loan', -(carLoanPayments[23].principalCents + carLoanPayments[23].interestCents), 'monthly', nextMonthly(4));
  await schedule(checkingId, catCarLease, 'CR-V Lease', -cents(420), 'monthly', nextMonthly(4));
  await schedule(checkingId, catHomeInsurance, 'Coastal Insurance Co.', -cents(148.2), 'monthly', nextMonthly(3));
  await schedule(checkingId, catPhoneInternet, 'Telus Mobility', -cents(95), 'monthly', nextMonthly(8));
  await schedule(checkingId, catPhoneInternet, 'Shaw Internet', -cents(85), 'monthly', nextMonthly(10));
  await schedule(checkingId, catGym, 'GoodLife Fitness', -cents(69.99), 'monthly', nextMonthly(4));
  await schedule(ccId, catSubscriptions, 'Netflix', -cents(NETFLIX_NEW), 'monthly', nextMonthly(5));
  await schedule(ccId, catSubscriptions, 'iCloud+', -cents(ICLOUD_NEW), 'monthly', nextMonthly(14), 1, '2 TB family plan');
  await schedule(ccId, catSubscriptions, 'Amazon Prime', -cents(99), 'yearly', nextYearly(6, 17));
  await schedule(checkingId, catShopping, 'Costco Membership', -cents(130), 'yearly', nextYearly(4, 22));
  await schedule(checkingId, catCarCare, 'BCAA', -cents(124), 'yearly', nextYearly(9, 2));
  await schedule(checkingId, catRrsp, 'RRSP', -rrspContribution, 'monthly', nextMonthly(27));
  // Quarterly, left unapproved — shows as waiting for approval.
  await schedule(checkingId, catUtilities, 'City Water & Sewer', -cents(212.4), 'monthly', waterDue, 3);

  // --- QBR: a few decisions — two kept, two left as To Do ---
  const schedules = await paymentReviewRepo.listReviewableSchedules(db, boardId);
  const repeated = await paymentReviewRepo.listRepeatedCharges(db, boardId, addMonths(today, -DETECTION_WINDOW_MONTHS), today);
  const items = buildReviewItems(schedules, detectRecurring(repeated, today), today);
  const decisions: [string, Decision, string | null, number][] = [
    ['Spotify', 'keep', 'Whole family uses it daily', 0],
    ['Microsoft 365', 'keep', 'Cheaper than buying Office', 0],
    ['Disney+', 'cancel', 'Kids moved on — cancel before next charge', 7],
    ['YouTube Premium', 'alternative', 'Check a family plan or drop ads-free', 30],
  ];
  for (const [name, decision, note, dueDays] of decisions) {
    const item = items.find((it) => it.name === name);
    if (!item) continue;
    await paymentReviewRepo.decide(db, boardId, item, decision, {
      note,
      dueOn: dueDays ? addDays(today, dueDays) : null,
      nextReviewOn: reviewOnAfterDecision(today),
      today,
    });
  }
  await settingsRepo.setJsonSetting(db, `qbr.excluded:${boardId}`, { payeeIds: [], categoryIds: [catCharity] });

  // --- goals, Baby Steps, tax settings ---
  await customGoalsRepo.createGoal(db, boardId, { name: 'Emergency Fund', targetCents: cents(40000), linkedAccountId: savingsId, manualProgressCents: null });
  await customGoalsRepo.createGoal(db, boardId, { name: 'Japan Trip 2027', targetCents: cents(9000), linkedAccountId: null, manualProgressCents: cents(3650) });
  await customGoalsRepo.createGoal(db, boardId, { name: 'Kitchen Renovation', targetCents: cents(35000), linkedAccountId: null, manualProgressCents: cents(8200) });
  const setJson = (key: string, value: unknown) => settingsRepo.setJsonSetting(db, `${key}:${boardId}`, value);
  await setJson('babySteps.step1AccountIds', [savingsId]);
  await setJson('babySteps.step3AccountIds', [savingsId]);
  await setJson('babySteps.home', `mortgage:${houseId}`);
  await setJson('babySteps.step4AccountIds', [rrspId, tfsaId]);
  await setJson('babySteps.step5AccountIds', [respId]);
  await setJson('babySteps.step7CategoryIds', [catCharity]);
  await settingsRepo.setSetting(db, `taxInsights.country:${boardId}`, 'CA');
  await settingsRepo.setSetting(db, `taxInsights.province:${boardId}`, 'BC');

  // --- house hunt ---
  for (const house of houseListings(months)) {
    await housesRepo.createHouse(db, boardId, { ...housesRepo.emptyHouse(), ...house });
  }
  for (const price of communityBenchmarks(months)) {
    await communityPricesRepo.addPrice(db, boardId, price);
  }

  return boardId;
}
