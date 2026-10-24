// What a viewing checks, as ticks rather than free text: each item is
// unchecked, fine, or a concern. Stored as `item=ok|concern` pairs in one
// column (see migration 045), unknown items kept as they are.

export const CHECKLIST_ITEMS = [
  'roof',
  'foundation',
  'furnace',
  'hotWater',
  'plumbing',
  'electrical',
  'windows',
  'moisture',
  'smell',
  'noise',
] as const;

export type ChecklistItem = (typeof CHECKLIST_ITEMS)[number];
export type ChecklistMark = 'ok' | 'concern';

export function parseChecklist(
  stored: string | null,
): Record<string, ChecklistMark> {
  const marks: Record<string, ChecklistMark> = {};
  for (const pair of (stored ?? '').split(',')) {
    const [item, mark] = pair.split('=').map((s) => s.trim());
    if (item && (mark === 'ok' || mark === 'concern')) marks[item] = mark;
  }
  return marks;
}

export function formatChecklist(
  marks: Record<string, ChecklistMark>,
): string | null {
  const pairs = Object.entries(marks).map(([item, mark]) => `${item}=${mark}`);
  return pairs.length > 0 ? pairs.join(',') : null;
}

/** Unchecked → fine → concern → unchecked. */
export function cycleMark(stored: string | null, item: string): string | null {
  const marks = parseChecklist(stored);
  const next: ChecklistMark | undefined =
    marks[item] == null ? 'ok' : marks[item] === 'ok' ? 'concern' : undefined;
  if (next) marks[item] = next;
  else delete marks[item];
  return formatChecklist(marks);
}

export function checklistConcerns(stored: string | null): number {
  return Object.values(parseChecklist(stored)).filter((m) => m === 'concern')
    .length;
}
