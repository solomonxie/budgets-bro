import { formatContextForPrompt, redactForPrivacy } from './aiAnalysis';
import type { AnalysisContext } from './aiAnalysis';

const context: AnalysisContext = {
  month: '2026-09',
  netWorthCents: 1_234_567,
  assetsCents: 2_000_000,
  debtsCents: 765_433,
  variance: [
    { categoryId: 1, name: 'Groceries', assignedCents: 50_000, spentCents: 48_213 },
    { categoryId: 2, name: 'Dining Out', assignedCents: 20_000, spentCents: 27_654 },
  ],
  trend: [
    { categoryId: 1, name: 'Groceries', month: '2026-08', spentCents: 45_000 },
    { categoryId: 1, name: 'Groceries', month: '2026-09', spentCents: 48_213 },
    { categoryId: 2, name: 'Dining Out', month: '2026-08', spentCents: 18_000 },
    { categoryId: 2, name: 'Dining Out', month: '2026-09', spentCents: 27_654 },
  ],
};

describe('redactForPrivacy', () => {
  it('rounds every dollar figure to the nearest $10', () => {
    const redacted = redactForPrivacy(context);
    expect(redacted.netWorthCents).toBe(1_235_000);
    expect(redacted.variance[0].spentCents).toBe(48_000);
    expect(redacted.trend[0].spentCents).toBe(45_000);
  });

  it('replaces category names with stable, alphabetically-assigned labels', () => {
    const redacted = redactForPrivacy(context);
    // "Dining Out" < "Groceries" alphabetically, so it gets label 1.
    expect(redacted.variance.find((v) => v.categoryId === 2)?.name).toBe('Category 1');
    expect(redacted.variance.find((v) => v.categoryId === 1)?.name).toBe('Category 2');
    // Same category gets the same label in both sections.
    const groceriesLabel = redacted.variance.find((v) => v.categoryId === 1)?.name;
    expect(redacted.trend.filter((r) => r.categoryId === 1).every((r) => r.name === groceriesLabel)).toBe(true);
  });

  it('never mutates the original context', () => {
    const before = JSON.stringify(context);
    redactForPrivacy(context);
    expect(JSON.stringify(context)).toBe(before);
  });
});

describe('formatContextForPrompt', () => {
  it('includes the month, net worth, and every category row', () => {
    const text = formatContextForPrompt(context);
    expect(text).toContain('2026-09');
    expect(text).toContain('$12,345.67');
    expect(text).toContain('Groceries: assigned $500, spent $482.13');
    expect(text).toContain('Dining Out — 2026-08: $180, 2026-09: $276.54');
  });
});
