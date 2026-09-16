import type { AccountWithBalance } from '../db/repositories/accountsRepo';
import { monthlyPaymentCents } from './amortization';

// What a calculator field can pull off a real account. Pure so the mapping
// stays testable — LinkableNumberField only does the picking and the wiring.
export type LinkableQuantity =
  | 'balance'
  | 'rateBps'
  | 'termMonths'
  | 'remainingTermMonths'
  | 'originalPrincipal'
  | 'housePrice'
  | 'monthlyPayment';

function wholeMonthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return Math.max(0, to.getDate() < from.getDate() ? months - 1 : months);
}

// Returns null when this account can't supply the quantity, which is the
// signal to hide the link rather than show a field that fills with 0.
//
// `termMonths` is the ORIGINAL contract term — a "remaining term" field must
// ask for 'remainingTermMonths' instead or it silently pulls a number that is
// years too long.
export function accountValueFor(
  quantity: LinkableQuantity,
  { account, balanceCents }: AccountWithBalance,
  currentRateBps: number | null,
  todayIso: string,
): number | null {
  switch (quantity) {
    case 'balance':
      // Debts are stored negative; a calculator wants the amount owed.
      return Math.abs(balanceCents);
    case 'rateBps':
      return currentRateBps;
    case 'termMonths':
      return account.termMonths;
    case 'remainingTermMonths': {
      if (account.termMonths == null || account.originationDate == null) return null;
      const elapsed = wholeMonthsBetween(account.originationDate, todayIso);
      return Math.max(0, account.termMonths - elapsed);
    }
    case 'originalPrincipal':
      return account.originalPrincipalCents;
    case 'housePrice':
      return account.originalHousePriceCents;
    case 'monthlyPayment': {
      if (account.originalPrincipalCents == null || account.termMonths == null || currentRateBps == null) return null;
      return monthlyPaymentCents(account.originalPrincipalCents, currentRateBps, account.termMonths);
    }
  }
}

// Calculator fields hold raw text, so a pulled value has to come back in the
// same shape the user would have typed: dollars not cents, percent not basis
// points, a whole number of months.
export function linkedValueToFieldText(quantity: LinkableQuantity, value: number): string {
  switch (quantity) {
    case 'rateBps':
      return String(value / 100);
    case 'termMonths':
    case 'remainingTermMonths':
      return String(value);
    default:
      return String(value / 100);
  }
}
