import { en } from './en';
import { zh } from './zh';

// TranslationKey (keyof typeof en) plus `tsc --noEmit` already guarantee zh.ts
// defines every key. What that can't catch is a key added to zh.ts with the
// English string pasted in — which ships an untranslated label. Scoped to the
// finance-tools namespaces because the older dictionary predates this guard.
const GUARDED = /^(financeTools|calc[A-Z])/;

// Strings that are legitimately identical in both languages — acronyms, and
// the Chinese currency units the 提前还贷 calculator labels its amount toggle
// with, which are already Chinese in the English dictionary.
const IDENTICAL_BY_DESIGN = new Set<string>([
  '%',
  'LPR',
  'DTI',
  'PMI',
  'HOA',
  'RRSP',
  '万',
  '元',
]);

describe('translations', () => {
  it('defines the same keys in both dictionaries', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('leaves no finance-tools string untranslated in zh', () => {
    const untranslated = Object.keys(en)
      .filter((key) => GUARDED.test(key))
      .filter((key) => {
        const source = en[key as keyof typeof en] as string;
        return (
          zh[key as keyof typeof zh] === source &&
          !IDENTICAL_BY_DESIGN.has(source)
        );
      });
    expect(untranslated).toEqual([]);
  });

  it('keeps every {placeholder} from en in the zh string', () => {
    const mismatched = Object.keys(en).filter((key) => {
      const source = en[key as keyof typeof en] as string;
      const target = zh[key as keyof typeof zh] as string;
      const placeholders = (s: string) =>
        (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      return placeholders(source) !== placeholders(target);
    });
    expect(mismatched).toEqual([]);
  });
});
