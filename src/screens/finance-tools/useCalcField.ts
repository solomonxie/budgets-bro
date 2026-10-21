import { useCallback, useState } from 'react';
import { parseMoneyToCents } from '../../domain/money';
import { useCalcForm } from './calcForm';

// Every calculator field is the same shape: raw text the user typed (or that
// LinkableNumberField pulled off an account), plus whichever reading of it
// the math wants. Keeping the text as the source of truth is what lets a
// half-typed "6." stay on screen instead of snapping to 6.
export interface CalcField {
  text: string;
  set: (text: string) => void;
  linkedAccountId: number | null;
  link: (accountId: number | null) => void;
  /** Dollars as typed → cents. Tolerates separators and a currency symbol. */
  cents: number;
  /** Percent as typed → basis points. 6.5 → 650. */
  bps: number;
  number: number;
  /** Whole months/years. */
  int: number;
  filled: boolean;
}

// With a `key`, inside a tool's CalcFormProvider, the text is remembered
// between visits (see calcForm).
export function useCalcField(initial = '', key?: string): CalcField {
  const form = useCalcForm();
  const [localText, setLocalText] = useState(initial);
  const remembered = key != null && form != null;
  const text = remembered ? (form.values[key] ?? initial) : localText;
  const formSet = form?.set;
  const [linkedAccountId, setLinkedAccountId] = useState<number | null>(null);

  // Stable so LinkableNumberField's prefill effect doesn't see a new
  // callback on every render of the screen around it.
  const set = useCallback(
    (next: string) =>
      remembered && formSet ? formSet(key!, next) : setLocalText(next),
    [remembered, formSet, key],
  );
  const link = useCallback((accountId: number | null) => setLinkedAccountId(accountId), []);

  const number = Number.parseFloat(text.replace(/[,\s$¥￥€£%]/g, ''));
  const safe = Number.isFinite(number) ? number : 0;

  return {
    text,
    set,
    linkedAccountId,
    link,
    cents: parseMoneyToCents(text),
    bps: Math.round(safe * 100),
    number: safe,
    int: Math.round(safe),
    filled: text.trim() !== '',
  };
}

// Years typed, months needed — the only unit conversion common enough across
// the calculators to be worth naming.
export function monthsFromYears(field: CalcField): number {
  return Math.round(field.number * 12);
}
