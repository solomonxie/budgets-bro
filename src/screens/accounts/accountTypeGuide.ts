import type { AccountType } from '../../domain/types';
import type { TranslationKey } from '../../i18n';

// What each account type is called, and the two paragraphs explaining it.
// Shared by the account page's ⓘ and the edit form's "Learn more" section,
// which say the same thing in the two places someone asks the question.
export const TYPE_LABEL_KEY: Record<AccountType, TranslationKey> = {
  cash: 'accountModal.typeCash',
  savings: 'accountModal.typeSavings',
  tracking: 'accountModal.typeTracking',
  asset: 'accountModal.typeAsset',
  giving: 'accountModal.typeGiving',
  loan: 'accountModal.typeLoan',
  mortgage: 'accountModal.typeMortgage',
  credit_card: 'accountModal.typeCreditCard',
};

export function howItWorksKey(type: AccountType): TranslationKey {
  return `accountGuide.${type}.how` as TranslationKey;
}

export function whatItIsForKey(type: AccountType): TranslationKey {
  return `accountGuide.${type}.helps` as TranslationKey;
}

export function trackingKindKey(kind: string): TranslationKey {
  return `trackingKind.${kind}` as TranslationKey;
}
