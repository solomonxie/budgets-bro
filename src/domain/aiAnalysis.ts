import { formatMoney } from './money';

// Pure data-shaping for AI Analysis (Backlog) — no DB/React/network
// dependency, same split as recurrence.ts/investmentGrowth.ts. The actual
// DB reads live in AiAnalysisScreen (one-shot, only on "Run Analysis" —
// no reactive hook needed for a request that isn't continuously displayed).

export interface CategoryVarianceRow {
  categoryId: number;
  name: string;
  assignedCents: number;
  spentCents: number;
}

export interface CategoryTrendRow {
  categoryId: number;
  name: string;
  month: string; // 'YYYY-MM'
  spentCents: number;
}

export interface AnalysisContext {
  month: string;
  netWorthCents: number;
  assetsCents: number;
  debtsCents: number;
  variance: CategoryVarianceRow[];
  trend: CategoryTrendRow[];
}

// Privacy Mode's trade: round every dollar figure to the nearest $10 and
// swap each category's real name for a stable "Category N" label (assigned
// alphabetically, so the same category reads as the same label across the
// variance and trend sections) — the model still sees enough shape to spot
// patterns/outliers without literally being told what the money is for or
// its exact balance.
export function redactForPrivacy(context: AnalysisContext): AnalysisContext {
  const names = Array.from(new Set([...context.variance.map((v) => v.name), ...context.trend.map((r) => r.name)])).sort();
  const anonLabel = new Map(names.map((name, i) => [name, `Category ${i + 1}`]));
  const round = (cents: number) => Math.round(cents / 1000) * 1000;
  return {
    ...context,
    netWorthCents: round(context.netWorthCents),
    assetsCents: round(context.assetsCents),
    debtsCents: round(context.debtsCents),
    variance: context.variance.map((v) => ({
      ...v,
      name: anonLabel.get(v.name) ?? v.name,
      assignedCents: round(v.assignedCents),
      spentCents: round(v.spentCents),
    })),
    trend: context.trend.map((r) => ({ ...r, name: anonLabel.get(r.name) ?? r.name, spentCents: round(r.spentCents) })),
  };
}

// Plain-text data block appended to the prompt, not JSON — a short table
// reads more naturally to a chat model and costs fewer tokens than
// repeating key names on every row.
export function formatContextForPrompt(context: AnalysisContext): string {
  const lines: string[] = [
    `Month: ${context.month}`,
    `Net worth: ${formatMoney(context.netWorthCents)} (assets ${formatMoney(context.assetsCents)}, debts ${formatMoney(context.debtsCents)})`,
    '',
    'Budget vs actual this month, by category:',
  ];
  for (const v of context.variance) {
    lines.push(`- ${v.name}: assigned ${formatMoney(v.assignedCents)}, spent ${formatMoney(v.spentCents)}`);
  }

  lines.push('', 'Spending by category over recent months:');
  const seriesByName = new Map<string, string[]>();
  for (const row of context.trend) {
    const series = seriesByName.get(row.name) ?? [];
    series.push(`${row.month}: ${formatMoney(row.spentCents)}`);
    seriesByName.set(row.name, series);
  }
  for (const [name, series] of seriesByName) {
    lines.push(`- ${name} — ${series.join(', ')}`);
  }

  return lines.join('\n');
}
