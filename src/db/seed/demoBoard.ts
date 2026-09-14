import type { SQLiteDatabase } from 'expo-sqlite';
import * as boardsRepo from '../repositories/boardsRepo';
import * as accountsRepo from '../repositories/accountsRepo';
import * as accountRateHistoryRepo from '../repositories/accountRateHistoryRepo';
import * as accountValueHistoryRepo from '../repositories/accountValueHistoryRepo';
import * as categoriesRepo from '../repositories/categoriesRepo';
import * as transactionsRepo from '../repositories/transactionsRepo';
import * as budgetsRepo from '../repositories/budgetsRepo';
import * as incomeDetailHistoryRepo from '../repositories/incomeDetailHistoryRepo';
import { currentMonth, lastNMonths } from '../../domain/month';
import { addMonths } from '../../finance-tools/amortization';

export const DEMO_BOARD_NAME = 'Demo';

const cents = (dollars: number) => Math.round(dollars * 100);
const day = (month: string, d: number) => `${month}-${String(d).padStart(2, '0')}`;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

interface AmortStep {
  interestCents: number;
  principalCents: number;
  balanceCents: number;
}

// Fixed-payment amortization off the *original* principal/term — same
// payment every month, split between interest and principal as the
// balance shrinks. Real enough for a demo without modeling rate resets.
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

// Invented, middle-class household finances shaped like a real board —
// three income accounts (salary, part-time, freelance; ~$120k/yr combined),
// one mortgaged primary residence, one fully paid-off cabin, a couple of
// credit cards, car loan/lease, a student loan, a line of credit, and
// modest RRSP/TFSA/investing — for showing someone the app without
// exposing any real money. Every number here is fictional; nothing is
// derived from the caller's actual data.
export async function seedDemoBoard(db: SQLiteDatabase): Promise<number> {
  const boardId = await boardsRepo.createBoard(db, DEMO_BOARD_NAME);
  const months = lastNMonths(currentMonth(), 24); // oldest → newest, 24 entries

  const checkingId = await accountsRepo.createAccount(db, boardId, {
    name: 'Everyday Chequing',
    type: 'cash',
    openingBalanceCents: cents(4000),
  });
  const savingsId = await accountsRepo.createAccount(db, boardId, {
    name: 'High-Interest Savings',
    type: 'savings',
    openingBalanceCents: cents(12000),
  });

  // Income accounts — one per earner/gig, showcasing the type's three
  // Pay Rate History units. Each is a tag, not a ledger (see migration
  // 021): every paycheck posts as a real transaction on `checkingId`
  // below, tagged back to whichever of these three it came from.
  const salaryIncomeId = await accountsRepo.createAccount(db, boardId, {
    name: 'Meridian Robotics Salary',
    type: 'income',
    openingBalanceCents: 0,
  });
  await incomeDetailHistoryRepo.addDetail(db, salaryIncomeId, {
    amountCents: cents(72000),
    unit: 'year',
    effectiveDate: day(months[0], 1),
    note: 'Software engineer, base salary',
  });
  const partTimeIncomeId = await accountsRepo.createAccount(db, boardId, {
    name: 'Alderbrook Part-Time Work',
    type: 'income',
    openingBalanceCents: 0,
  });
  await incomeDetailHistoryRepo.addDetail(db, partTimeIncomeId, {
    amountCents: cents(28),
    unit: 'hour',
    effectiveDate: day(months[0], 1),
    note: 'Weekend retail shifts',
  });
  const freelanceIncomeId = await accountsRepo.createAccount(db, boardId, {
    name: 'Freelance Design Gigs',
    type: 'income',
    openingBalanceCents: 0,
  });
  await incomeDetailHistoryRepo.addDetail(db, freelanceIncomeId, {
    amountCents: cents(650),
    unit: 'paycheck',
    effectiveDate: day(months[0], 1),
    note: 'Per-project rate, varies with scope',
  });
  const ccId = await accountsRepo.createAccount(db, boardId, {
    name: 'Rewards Visa',
    type: 'credit_card',
    openingBalanceCents: 0,
  });
  const cc2Id = await accountsRepo.createAccount(db, boardId, {
    name: 'Cashback Mastercard',
    type: 'credit_card',
    openingBalanceCents: 0,
  });

  // Primary residence — already a year into its term when the window
  // starts; a modest ~8% down payment, not a wealthy one.
  const houseSchedule = amortize(cents(900000), 575, 300, 36);
  const houseOpeningCents = -houseSchedule[11].balanceCents;
  const housePayments = houseSchedule.slice(12);
  const houseId = await accountsRepo.createAccount(db, boardId, {
    name: 'Maple Street House Mortgage',
    type: 'mortgage',
    openingBalanceCents: houseOpeningCents,
    interestRateBps: 575,
    termMonths: 300,
    originalPrincipalCents: cents(900000),
    originationDate: day(months[0], 1),
    originalHousePriceCents: cents(980000),
  });
  await accountRateHistoryRepo.addRateChange(db, houseId, 575, day(months[0], 1));
  await accountValueHistoryRepo.addValueChange(db, houseId, cents(980000), day(months[0], 1));
  await accountValueHistoryRepo.addValueChange(db, houseId, cents(1010000), day(months[11], 1));
  await accountValueHistoryRepo.addValueChange(db, houseId, cents(1040000), day(months[23], 15));

  // A small cabin, paid off years ago — tracked as a plain Asset (no
  // loan), just a logged value that drifts up slowly. One paid-off
  // property alongside one still-mortgaged one is the point of this pair.
  const cabinId = await accountsRepo.createAccount(db, boardId, {
    name: 'Whistler Cabin',
    type: 'asset',
    openingBalanceCents: cents(350000),
  });
  await accountValueHistoryRepo.addValueChange(db, cabinId, cents(350000), day(months[0], 1));
  await accountValueHistoryRepo.addValueChange(db, cabinId, cents(365000), day(months[11], 1));
  await accountValueHistoryRepo.addValueChange(db, cabinId, cents(380000), day(months[23], 15));

  // Loans — three different repayment shapes beyond the mortgage above:
  // a standard interest-bearing installment loan (car), a fixed-payment
  // loan with no interest to break out (lease — the money factor is baked
  // into the manufacturer's residual pricing, not itemized like a real
  // loan's rate), and a long-term loan already partway through repayment
  // (student, seasoned like the house above, just further along).
  const carLoanSchedule = amortize(cents(28000), 649, 60, 14 + months.length);
  const carLoanId = await accountsRepo.createAccount(db, boardId, {
    name: 'Highlander Auto Loan',
    type: 'loan',
    openingBalanceCents: -carLoanSchedule[13].balanceCents,
    interestRateBps: 649,
    termMonths: 60,
    originalPrincipalCents: cents(28000),
    originationDate: addMonths(day(months[0], 1), -14),
  });
  await accountRateHistoryRepo.addRateChange(db, carLoanId, 649, addMonths(day(months[0], 1), -14));
  const carLoanPayments = carLoanSchedule.slice(14);

  const carLeasePrincipalCents = cents(420 * 36);
  const carLeaseSchedule = amortize(carLeasePrincipalCents, 0, 36, months.length);
  const carLeaseId = await accountsRepo.createAccount(db, boardId, {
    name: 'CR-V Lease',
    type: 'loan',
    openingBalanceCents: -carLeasePrincipalCents,
    interestRateBps: 0,
    termMonths: 36,
    originalPrincipalCents: carLeasePrincipalCents,
    originationDate: day(months[0], 1),
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
  });
  await accountRateHistoryRepo.addRateChange(db, studentLoanId, 549, addMonths(day(months[0], 1), -30));
  const studentLoanPayments = studentLoanSchedule.slice(30);

  // Revolving, not installment — modeled like the credit cards below rather
  // than a LoanDetailsCard-style amortization: a draw against it spends
  // directly from the account (no linked-payee mirror needed), interest
  // accrues monthly on whatever's outstanding, and only part of it gets
  // paid down each month.
  const locId = await accountsRepo.createAccount(db, boardId, {
    name: 'Personal Line of Credit',
    type: 'credit_card',
    openingBalanceCents: -cents(3500),
  });
  let locBalance = cents(3500);

  const rrspId = await accountsRepo.createAccount(db, boardId, { name: 'RRSP', type: 'tracking', openingBalanceCents: cents(45000) });
  const tfsaId = await accountsRepo.createAccount(db, boardId, { name: 'TFSA', type: 'tracking', openingBalanceCents: cents(22000) });
  const investId = await accountsRepo.createAccount(db, boardId, {
    name: 'Non-Registered Investments',
    type: 'tracking',
    openingBalanceCents: cents(12000),
  });

  // --- categories ---
  const housingGroup = await categoriesRepo.createCategoryGroup(db, boardId, 'Mortgages & Housing');
  const catHouse = await categoriesRepo.createCategory(db, boardId, { groupId: housingGroup, name: '🏡 Mortgage Payment', icon: null });
  const catPropertyTax = await categoriesRepo.createCategory(db, boardId, { groupId: housingGroup, name: '🧾 Property Tax', icon: null });
  const catHomeInsurance = await categoriesRepo.createCategory(db, boardId, { groupId: housingGroup, name: '🛡️ Home Insurance', icon: null });
  const catUtilities = await categoriesRepo.createCategory(db, boardId, { groupId: housingGroup, name: '💡 Utilities', icon: null });
  const catHomeMaintenance = await categoriesRepo.createCategory(db, boardId, { groupId: housingGroup, name: '🛠️ Home Maintenance', icon: null });

  const everydayGroup = await categoriesRepo.createCategoryGroup(db, boardId, 'Everyday Expenses');
  const catGroceries = await categoriesRepo.createCategory(db, boardId, { groupId: everydayGroup, name: '🛒 Groceries', icon: null });
  const catDining = await categoriesRepo.createCategory(db, boardId, { groupId: everydayGroup, name: '🍽️ Dining Out', icon: null });
  const catCoffee = await categoriesRepo.createCategory(db, boardId, { groupId: everydayGroup, name: '☕ Coffee & Quick Stops', icon: null });
  const catTransport = await categoriesRepo.createCategory(db, boardId, { groupId: everydayGroup, name: '⛽ Transportation & Gas', icon: null });
  const catShopping = await categoriesRepo.createCategory(db, boardId, { groupId: everydayGroup, name: '🛍️ Shopping', icon: null });
  const catSubscriptions = await categoriesRepo.createCategory(db, boardId, { groupId: everydayGroup, name: '📱 Subscriptions', icon: null });

  const qolGroup = await categoriesRepo.createCategoryGroup(db, boardId, 'Quality of Life');
  const catTravel = await categoriesRepo.createCategory(db, boardId, { groupId: qolGroup, name: '✈️ Travel & Vacation', icon: null });
  const catHobbies = await categoriesRepo.createCategory(db, boardId, { groupId: qolGroup, name: '🎉 Hobbies & Recreation', icon: null });
  const catGym = await categoriesRepo.createCategory(db, boardId, { groupId: qolGroup, name: '💪 Gym & Wellness', icon: null });

  const givingGroup = await categoriesRepo.createCategoryGroup(db, boardId, 'Giving');
  const catCharity = await categoriesRepo.createCategory(db, boardId, { groupId: givingGroup, name: '🎁 Charitable Giving', icon: null });

  const savingsGroup = await categoriesRepo.createCategoryGroup(db, boardId, 'Savings Goals');
  const catRrsp = await categoriesRepo.createCategory(db, boardId, { groupId: savingsGroup, name: '🏦 RRSP Contributions', icon: null });
  const catTfsa = await categoriesRepo.createCategory(db, boardId, { groupId: savingsGroup, name: '💰 TFSA Contributions', icon: null });
  const catInvest = await categoriesRepo.createCategory(db, boardId, { groupId: savingsGroup, name: '📈 Investment Contributions', icon: null });

  const loansGroup = await categoriesRepo.createCategoryGroup(db, boardId, 'Loans & Financing');
  const catCarLoan = await categoriesRepo.createCategory(db, boardId, { groupId: loansGroup, name: '🚙 Highlander Loan Payment', icon: null });
  const catCarLease = await categoriesRepo.createCategory(db, boardId, { groupId: loansGroup, name: '🚗 CR-V Lease Payment', icon: null });
  const catStudentLoan = await categoriesRepo.createCategory(db, boardId, { groupId: loansGroup, name: '🎓 Student Loan Payment', icon: null });
  const catLocDraw = await categoriesRepo.createCategory(db, boardId, { groupId: loansGroup, name: '🛠️ Line of Credit Draws', icon: null });

  // --- 24 months of transactions + budget ---
  const groceryPayees = ['Save-On-Foods', 'Whole Foods', 'Costco'];
  const diningPayees = ['The Keg Steakhouse', 'Uber Eats', 'Local Bistro'];
  const coffeePayees = ['Tim Hortons', 'Starbucks', 'Circle K'];
  const shoppingPayees = ['Amazon', 'Best Buy', 'Apple Store'];
  const travelPayees = ['Air Canada', 'WestJet'];

  // One real transaction on the cash account, tagged to its income account
  // (see migration 021) — no separate sweep-transfer pair needed anymore.
  const postIncome = async (incomeAccountId: number, payeeName: string, amountCents: number, date: string) => {
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: null,
      payeeName,
      memo: null,
      amountCents,
      date,
      incomeAccountId,
    });
  };

  let rrspBalance = cents(45000);
  let tfsaBalance = cents(22000);
  let investBalance = cents(12000);
  let savingsBalance = cents(12000);
  let ccBalance = 0;
  let cc2Balance = 0;

  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    const inflation = 1 + (i / months.length) * 0.05; // slow drift up over the 2 years

    // Household income — two earners paid twice a month (~$120k/yr
    // combined salary + part-time), plus the odd freelance gig.
    await postIncome(salaryIncomeId, 'Meridian Robotics Inc', cents(rand(2900, 3100) * inflation), day(month, 1));
    await postIncome(salaryIncomeId, 'Meridian Robotics Inc', cents(rand(2900, 3100) * inflation), day(month, 15));
    await postIncome(partTimeIncomeId, 'Alderbrook Consulting Group', cents(rand(1900, 2100) * inflation), day(month, 1));
    await postIncome(partTimeIncomeId, 'Alderbrook Consulting Group', cents(rand(1900, 2100) * inflation), day(month, 15));
    // Freelance work is lumpy — most months get one payment, some get
    // none, so the trend graph actually looks like gig income.
    if (Math.random() < 0.75) {
      await postIncome(freelanceIncomeId, 'Freelance Design Gigs', cents(rand(400, 1200) * inflation), day(month, pick([8, 22])));
    }

    // Mortgage — principal (transfer, moves the loan balance) + interest
    // (plain expense) on the same category, same day. The cabin has no
    // payment of its own — it's paid off, just a logged value.
    const house = housePayments[i];
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catHouse,
      payeeName: 'Maple Street House Mortgage',
      memo: null,
      amountCents: -house.principalCents,
      date: day(month, 1),
    });
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catHouse,
      payeeName: '',
      memo: 'Mortgage interest',
      amountCents: -house.interestCents,
      date: day(month, 1),
    });

    // Car loan, lease, student loan — same principal/interest split as the
    // mortgage above (the payeeName match on each principal leg is what
    // mirrors it onto that loan account and pays it down, see
    // transactionsRepo.postLinkedAccountLeg). The lease has no interest
    // leg — nothing to break out at 0%.
    const carLoan = carLoanPayments[i];
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catCarLoan,
      payeeName: 'Highlander Auto Loan',
      memo: null,
      amountCents: -carLoan.principalCents,
      date: day(month, 4),
    });
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catCarLoan,
      payeeName: '',
      memo: 'Auto loan interest',
      amountCents: -carLoan.interestCents,
      date: day(month, 4),
    });
    const carLease = carLeaseSchedule[i];
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catCarLease,
      payeeName: 'CR-V Lease',
      memo: null,
      amountCents: -carLease.principalCents,
      date: day(month, 4),
    });
    const studentLoan = studentLoanPayments[i];
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catStudentLoan,
      payeeName: 'Student Loan',
      memo: null,
      amountCents: -studentLoan.principalCents,
      date: day(month, 20),
    });
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catStudentLoan,
      payeeName: '',
      memo: 'Student loan interest',
      amountCents: -studentLoan.interestCents,
      date: day(month, 20),
    });

    // Line of credit — revolving, not installment: an occasional draw
    // spends directly from the account (like a card purchase, no transfer
    // leg), interest accrues on whatever's outstanding, and only part of
    // it gets paid down each month (same "don't always pay in full" shape
    // as the credit cards below).
    if (i % 7 === 3) {
      const drawCents = cents(rand(500, 1400));
      locBalance += drawCents;
      await transactionsRepo.createTransaction(db, boardId, {
        accountId: locId,
        categoryId: catLocDraw,
        payeeName: 'Rona',
        memo: null,
        amountCents: -drawCents,
        date: day(month, 10),
      });
    }
    const locInterestCents = Math.round(locBalance * (rand(0.075, 0.095) / 12));
    locBalance += locInterestCents;
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: locId,
      categoryId: null,
      payeeName: '',
      memo: 'Interest',
      amountCents: -locInterestCents,
      date: day(month, 25),
    });
    const locPaymentCents = Math.round(locBalance * rand(0.1, 0.2));
    locBalance -= locPaymentCents;
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: null,
      payeeName: 'Personal Line of Credit',
      memo: null,
      amountCents: -locPaymentCents,
      date: day(month, 26),
    });

    // Property tax — quarterly.
    if (i % 3 === 0) {
      await transactionsRepo.createTransaction(db, boardId, {
        accountId: checkingId,
        categoryId: catPropertyTax,
        payeeName: 'City Property Tax',
        memo: null,
        amountCents: -cents(rand(1000, 1200) * 3),
        date: day(month, 2),
      });
    }
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catHomeInsurance,
      payeeName: 'Coastal Insurance Co.',
      memo: null,
      amountCents: -cents(rand(130, 160)),
      date: day(month, 3),
    });
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catUtilities,
      payeeName: pick(['BC Hydro', 'Telus', 'Shaw']),
      memo: null,
      amountCents: -cents(rand(180, 260)),
      date: day(month, 8),
    });
    if (Math.random() < 0.3) {
      await transactionsRepo.createTransaction(db, boardId, {
        accountId: checkingId,
        categoryId: catHomeMaintenance,
        payeeName: 'Home Depot',
        memo: null,
        amountCents: -cents(rand(120, 500)),
        date: day(month, 12),
      });
    }

    // Everyday spend — groceries/dining on Chequing, discretionary split
    // across the two cards.
    for (let g = 0; g < 4; g++) {
      await transactionsRepo.createTransaction(db, boardId, {
        accountId: checkingId,
        categoryId: catGroceries,
        payeeName: pick(groceryPayees),
        memo: null,
        amountCents: -cents(rand(130, 230)),
        date: day(month, 3 + g * 6),
      });
    }
    for (let d = 0; d < 4; d++) {
      await transactionsRepo.createTransaction(db, boardId, {
        accountId: checkingId,
        categoryId: catDining,
        payeeName: pick(diningPayees),
        memo: null,
        amountCents: -cents(rand(40, 110)),
        date: day(month, 4 + d * 6),
      });
    }
    for (let g = 0; g < 3; g++) {
      await transactionsRepo.createTransaction(db, boardId, {
        accountId: checkingId,
        categoryId: catTransport,
        payeeName: 'Chevron',
        memo: null,
        amountCents: -cents(rand(55, 90)),
        date: day(month, 6 + g * 8),
      });
    }

    let ccCharges = 0;
    for (let s = 0; s < 3; s++) {
      const amt = cents(rand(70, 180));
      ccCharges += amt;
      await transactionsRepo.createTransaction(db, boardId, {
        accountId: ccId,
        categoryId: catShopping,
        payeeName: pick(shoppingPayees),
        memo: null,
        amountCents: -amt,
        date: day(month, 9 + s * 7),
      });
    }
    const subAmt = cents(rand(55, 70));
    ccCharges += subAmt;
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: ccId,
      categoryId: catSubscriptions,
      payeeName: 'Streaming Bundle',
      memo: null,
      amountCents: -subAmt,
      date: day(month, 5),
    });
    if (i % 6 === 2) {
      const travelAmt = cents(rand(1500, 3000));
      ccCharges += travelAmt;
      await transactionsRepo.createTransaction(db, boardId, {
        accountId: ccId,
        categoryId: catTravel,
        payeeName: pick(travelPayees),
        memo: null,
        amountCents: -travelAmt,
        date: day(month, 18),
      });
    }

    // Second card — a small, everyday-carry balance (coffee/quick stops),
    // paid off almost in full most months.
    let cc2Charges = 0;
    for (let c = 0; c < 6; c++) {
      const amt = cents(rand(4, 9));
      cc2Charges += amt;
      await transactionsRepo.createTransaction(db, boardId, {
        accountId: cc2Id,
        categoryId: catCoffee,
        payeeName: pick(coffeePayees),
        memo: null,
        amountCents: -amt,
        date: day(month, 2 + c * 4),
      });
    }

    for (let h = 0; h < 2; h++) {
      await transactionsRepo.createTransaction(db, boardId, {
        accountId: checkingId,
        categoryId: catHobbies,
        payeeName: 'Local Rec Centre',
        memo: null,
        amountCents: -cents(rand(30, 70)),
        date: day(month, 14 + h * 10),
      });
    }
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catGym,
      payeeName: 'GoodLife Fitness',
      memo: null,
      amountCents: -cents(60),
      date: day(month, 4),
    });
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catCharity,
      payeeName: 'Local Food Bank',
      memo: null,
      amountCents: -cents(80),
      date: day(month, 20),
    });

    // Pay most (not all) of each card's balance each month — a small
    // revolving balance reads more real than always paying in full.
    const owed = ccBalance + ccCharges;
    const ccPayment = Math.round(owed * rand(0.75, 0.95));
    ccBalance = owed - ccPayment;
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: null,
      payeeName: 'Rewards Visa',
      memo: null,
      amountCents: -ccPayment,
      date: day(month, 26),
    });
    const owed2 = cc2Balance + cc2Charges;
    const cc2Payment = Math.round(owed2 * rand(0.9, 1));
    cc2Balance = owed2 - cc2Payment;
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: null,
      payeeName: 'Cashback Mastercard',
      memo: null,
      amountCents: -cc2Payment,
      date: day(month, 26),
    });

    // Retirement/investment contributions + simulated growth — modest,
    // not maxed out, given how much of the paycheque the mortgage takes.
    const rrspContribution = cents(400);
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catRrsp,
      payeeName: 'RRSP',
      memo: null,
      amountCents: -rrspContribution,
      date: day(month, 27),
    });
    const rrspGrowth = Math.round(rrspBalance * rand(-0.01, 0.02));
    rrspBalance += rrspContribution + rrspGrowth;
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: rrspId,
      categoryId: null,
      payeeName: '',
      memo: 'Market growth',
      amountCents: rrspGrowth,
      date: day(month, 28),
    });

    const tfsaContribution = cents(300);
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catTfsa,
      payeeName: 'TFSA',
      memo: null,
      amountCents: -tfsaContribution,
      date: day(month, 27),
    });
    const tfsaGrowth = Math.round(tfsaBalance * rand(-0.01, 0.02));
    tfsaBalance += tfsaContribution + tfsaGrowth;
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: tfsaId,
      categoryId: null,
      payeeName: '',
      memo: 'Market growth',
      amountCents: tfsaGrowth,
      date: day(month, 28),
    });

    const investContribution = cents(200);
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: catInvest,
      payeeName: 'Non-Registered Investments',
      memo: null,
      amountCents: -investContribution,
      date: day(month, 27),
    });
    const investGrowth = Math.round(investBalance * rand(-0.015, 0.025));
    investBalance += investContribution + investGrowth;
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: investId,
      categoryId: null,
      payeeName: '',
      memo: 'Market growth',
      amountCents: investGrowth,
      date: day(month, 28),
    });

    // Sweep whatever's left in Chequing past a comfortable cushion into
    // Savings, which also earns a bit of interest on its own.
    const savingsTransfer = cents(rand(150, 350));
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: checkingId,
      categoryId: null,
      payeeName: 'High-Interest Savings',
      memo: null,
      amountCents: -savingsTransfer,
      date: day(month, 28),
    });
    const savingsInterest = Math.round(savingsBalance * rand(0.002, 0.004));
    savingsBalance += savingsTransfer + savingsInterest;
    await transactionsRepo.createTransaction(db, boardId, {
      accountId: savingsId,
      categoryId: null,
      payeeName: '',
      memo: 'Interest',
      amountCents: savingsInterest,
      date: day(month, 28),
    });

    // Budget — assign roughly what the month spent, plus a small buffer.
    const assignments: [number, number][] = [
      [catHouse, house.principalCents + house.interestCents],
      [catCarLoan, carLoan.principalCents + carLoan.interestCents],
      [catCarLease, carLease.principalCents],
      [catStudentLoan, studentLoan.principalCents + studentLoan.interestCents],
      [catLocDraw, cents(100)],
      [catPropertyTax, cents(370)],
      [catHomeInsurance, cents(145)],
      [catUtilities, cents(230)],
      [catHomeMaintenance, cents(200)],
      [catGroceries, cents(800)],
      [catDining, cents(400)],
      [catCoffee, cents(50)],
      [catTransport, cents(240)],
      [catShopping, cents(400)],
      [catSubscriptions, cents(60)],
      [catTravel, cents(350)],
      [catHobbies, cents(120)],
      [catGym, cents(60)],
      [catCharity, cents(80)],
      [catRrsp, rrspContribution],
      [catTfsa, tfsaContribution],
      [catInvest, investContribution],
    ];
    for (const [categoryId, base] of assignments) {
      await budgetsRepo.setAssignedCents(db, boardId, categoryId, month, Math.round(base * inflation));
    }
  }

  return boardId;
}
