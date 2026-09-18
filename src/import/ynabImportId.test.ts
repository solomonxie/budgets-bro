import { makeOccurrenceCounter, ynabImportId } from './ynabImportId';

describe('ynabImportId', () => {
  it('builds the key the importer has always written', () => {
    expect(ynabImportId('Chequing', '2026-03-04', 'Whole Foods', 0)).toBe('ynab:Chequing|2026-03-04|Whole Foods|#0');
  });

  it('keeps an empty payee in the key rather than collapsing it', () => {
    expect(ynabImportId('Chequing', '2026-03-04', '', 0)).toBe('ynab:Chequing|2026-03-04||#0');
  });
});

describe('makeOccurrenceCounter', () => {
  it('numbers identical rows in the order they appear', () => {
    const next = makeOccurrenceCounter();
    expect(next('Chequing', '2026-03-04', 'Whole Foods')).toBe(0);
    expect(next('Chequing', '2026-03-04', 'Whole Foods')).toBe(1);
    expect(next('Chequing', '2026-03-04', 'Whole Foods')).toBe(2);
  });

  it('counts each natural key separately', () => {
    const next = makeOccurrenceCounter();
    expect(next('Chequing', '2026-03-04', 'Whole Foods')).toBe(0);
    expect(next('Savings', '2026-03-04', 'Whole Foods')).toBe(0);
    expect(next('Chequing', '2026-03-05', 'Whole Foods')).toBe(0);
    expect(next('Chequing', '2026-03-04', 'Whole Foods')).toBe(1);
  });
});
